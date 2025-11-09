import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Calendar, AlertTriangle, CheckCircle, Clock, Database, Download, 
  FileText, RefreshCw, Search, Filter, ChevronDown, ChevronRight,
  Brain, Shield, AlertCircle, BarChart2, Zap, Target, TrendingUp,
  Info, Package, Eye, Settings, Loader, Activity, CheckCircle2
} from 'lucide-react';
import JobProgress from './JobProgress';
import DataSourcesModal from './DataSourcesModal';
import "../styles/phase3.css";

const API_BASE_URL = '';

const Phase3Results = ({ phase2JobId, isActive, customerName, onComplete, onResearchComplete, onPhase3Initialize }) => {
  // ============= EXISTING STATE MANAGEMENT =============
  const [phase3JobId, setPhase3JobId] = useState(null);
  const [job, setJob] = useState(null);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRisk, setFilterRisk] = useState('all');
  const [sortBy, setSortBy] = useState('total_quantity');
  const [sortOrder, setSortOrder] = useState('desc');
  const [expandedProducts, setExpandedProducts] = useState(new Set());
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [showDataSourceModal, setShowDataSourceModal] = useState(false);
  const [selectedProductForSources, setSelectedProductForSources] = useState(null);
  const [researchStatus, setResearchStatus] = useState('idle');
  const [researchProgress, setResearchProgress] = useState({
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    current: 0
  });
  const [reportGenerating, setReportGenerating] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'report'
  const [eolYearBasis, setEolYearBasis] = useState('lastDayOfSupport');
  const [useCacheEnabled, setUseCacheEnabled] = useState(true);

  // ============= NEW REAL-TIME UPDATE STATE =============
  const [currentResearchProduct, setCurrentResearchProduct] = useState(null);
  const [recentlyUpdatedProducts, setRecentlyUpdatedProducts] = useState(new Map());
  const [updateHistory, setUpdateHistory] = useState([]);
  const [datesFoundCount, setDatesFoundCount] = useState(0);
  const [researchingProductId, setResearchingProductId] = useState(null);
  const [flashingCells, setFlashingCells] = useState(new Map());
  const tableRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const eventSourceRef = useRef(null);
  
  const [stats, setStats] = useState({
    totalProducts: 0,
    aiEnhanced: 0,
    currentProducts: 0,
    avgConfidence: 0,
    highRiskCount: 0,
    criticalRiskCount: 0,
    requiresReview: 0,
    withDates: 0,
    withAllDates: 0,
    filteredCount: 0,
    originalCount: 0
  });
  // Add after other state declarations:
  const [cacheStats, setCacheStats] = useState({
    hits: 0,
    misses: 0,
    hitRate: 0,
    enabled: true,
    avgTimeMs: 0
  });

  // ============= LIFECYCLE EFFECTS =============
  // Initialize Phase 3 when component becomes active
  useEffect(() => {
    if (isActive && phase2JobId && !phase3JobId) {
      initializePhase3();
    }
  }, [isActive, phase2JobId]);

  // Fetch results when Phase 3 job is created
  useEffect(() => {
    if (phase3JobId) {
      fetchResults();
    }
  }, [phase3JobId]);

  // Apply filters when data or filters change
  useEffect(() => {
    filterAndSortProducts();
  }, [products, searchTerm, filterStatus, filterRisk, sortBy, sortOrder]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // ============= INITIALIZATION FUNCTIONS =============
  const initializePhase3 = async () => {
    if (!phase2JobId) {
      console.error('No Phase 2 job ID provided');
      return;
    }

    setInitializing(true);
    try {
      console.log('Initializing Phase 3 with Phase 2 job:', phase2JobId);
      
      const response = await fetch(`${API_BASE_URL}/api/phase3/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase2JobId })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log('Phase 3 initialized successfully:', data);
        setPhase3JobId(data.phase3JobId);
        
        // Pass the job ID back to parent
        if (onPhase3Initialize) {
          onPhase3Initialize(data.phase3JobId);
        }
        
        // Update stats with filter info
        setStats(prev => ({
          ...prev,
          filteredCount: data.filteredItems || 0,
          originalCount: data.originalItems || 0
        }));
        
        if (onComplete) {
          onComplete();
        }
      } else {
        console.error('Failed to initialize Phase 3:', data.error);
        alert(data.error || 'Failed to initialize Phase 3');
      }
    } catch (error) {
      console.error('Error initializing Phase 3:', error);
      alert('Error initializing Phase 3. Please check the console.');
    } finally {
      setInitializing(false);
    }
  };

   useEffect(() => {
    if (researchStatus !== 'running' || !phase3JobId) return;
    
    const checkCompletionStatus = async () => {
      try {
        const url = API_BASE_URL 
          ? `${API_BASE_URL}/api/phase3/results/${phase3JobId}`
          : `/api/phase3/results/${phase3JobId}`;
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          
          // Check if job is marked as completed in database
          if (data.job && (data.job.status === 'completed' || data.job.status === 'research_complete')) {
            console.log('✅ Completion detected via status polling!');
            
            // Only trigger completion if we haven't already
            if (researchStatus === 'running') {
              handleResearchCompletion({
                total: data.products?.length || researchProgress.total,
                processed: data.products?.length || researchProgress.processed,
                successful: data.job.successful_products || researchProgress.successful,
                failed: data.job.failed_products || researchProgress.failed,
                datesFound: data.job.dates_found || researchProgress.datesFound,
                message: 'Research completed'
              });
            }
          }
        }
      } catch (error) {
        console.error('Status polling error:', error);
      }
    };
    
    // Check every 5 seconds
    const interval = setInterval(checkCompletionStatus, 5000);
    
    return () => clearInterval(interval);
  }, [researchStatus, phase3JobId]); 

  const CacheToggle = () => (
  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
    <label className="flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={useCacheEnabled}
        onChange={(e) => setUseCacheEnabled(e.target.checked)}
        className="mr-2 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
        disabled={researchStatus === 'running'}
      />
      <span className="text-sm font-medium text-gray-700">
        Use Cached Research
      </span>
    </label>
    <div className="flex items-center text-xs text-gray-500">
      <Info className="h-3 w-3 mr-1" />
      <span>
        {useCacheEnabled 
          ? "Will use previously cached AI research results when available"
          : "Will perform fresh AI research for all products (slower)"}
      </span>
    </div>
  </div>
);

  // ============= DATA FETCHING FUNCTIONS =============
  const fetchResults = async () => {
    if (!phase3JobId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/phase3/results/${phase3JobId}`);
      const data = await response.json();
      
      if (response.ok) {
        setJob(data.job);
        setProducts(data.products || []);
        
        // Calculate stats
        const products = data.products || [];
        const newStats = {
          totalProducts: products.length,
          aiEnhanced: products.filter(p => p.ai_enhanced).length,
          currentProducts: products.filter(p => p.lifecycle_status === 'Current').length,
          avgConfidence: products.length > 0 
            ? Math.round(products.reduce((sum, p) => sum + (p.overall_confidence || 0), 0) / products.length)
            : 0,
          highRiskCount: products.filter(p => p.risk_level === 'high').length,
          criticalRiskCount: products.filter(p => p.risk_level === 'critical').length,
          requiresReview: products.filter(p => p.requires_review).length,
          withDates: products.filter(p => 
            p.end_of_sale_date || p.last_day_of_support_date || p.end_of_sw_maintenance_date
          ).length,
          withAllDates: products.filter(p => 
            p.end_of_sale_date && p.last_day_of_support_date
          ).length,
          filteredCount: data.job?.filtered_count || products.length,
          originalCount: data.job?.original_count || products.length
        };
        
        setStats(newStats);
      }
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============= AI RESEARCH FUNCTIONS =============
  const runAIResearch = async () => {
    if (!phase3JobId) {
      console.error('No Phase 3 job ID available');
      return;
    }

    console.log('Starting AI research for job:', phase3JobId);
    setResearchStatus('researching');
    setUpdateHistory([]);
    setDatesFoundCount(0);
    
    // Set up enhanced SSE connection
    setupEnhancedSSEConnection();
  };

  // ============= ENHANCED SSE CONNECTION WITH REAL-TIME UPDATES =============
  const setupEnhancedSSEConnection = () => {
    const sseUrl = API_BASE_URL 
      ? `${API_BASE_URL}/api/phase3/research-progress/${phase3JobId}`
      : `/api/phase3/research-progress/${phase3JobId}`;
    
    console.log(`Setting up enhanced SSE connection to: ${sseUrl}`);
    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;
    
    let connectionReady = false;
    let researchStarted = false;
    
    eventSource.onopen = () => {
      console.log(`Ã¢Å“â€¦ SSE connection opened for job: ${phase3JobId}`);
      connectionReady = true;
      
      if (!researchStarted) {
        researchStarted = true;
        startResearch();
      }
    };
    
  // Helper function to handle research completion
  const handleResearchCompletion = (progress) => {
    console.log('📍 Handling research completion');
    
    // Close SSE if still open
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    // Update status
    setResearchStatus('completed');
    setResearchingProductId(null);
    
    // Update final progress
    if (progress) {
      setResearchProgress({
        total: progress.total,
        processed: progress.processed || progress.total,
        successful: progress.successful,
        failed: progress.failed,
        datesFound: progress.datesFound,
        percentComplete: 100,
        message: progress.message || 'Research completed'
      });
    }
    
    // Call completion callback
    if (onResearchComplete) {
      console.log('✅ Calling onResearchComplete callback from handleResearchCompletion');
      onResearchComplete();
    }
    
    // Fetch final results
    setTimeout(() => {
      fetchResults();
    }, 500);
  };

  // Around line 500-600, where your other functions like handleResearch are
  const CacheStatsDisplay = () => {
    if (!cacheStats || (cacheStats.hits === 0 && cacheStats.misses === 0)) {
      return null;
    }
    
    return (
      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center">
            <Database className="h-4 w-4 mr-1 text-blue-600" />
            <span className="font-medium">Cache Stats:</span>
          </div>
          <div className="text-green-600">
            Hits: {cacheStats.hits}
          </div>
          <div className="text-orange-600">
            Misses: {cacheStats.misses}
          </div>
          <div className="text-blue-600 font-semibold">
            Hit Rate: {cacheStats.hitRate}%
          </div>
        </div>
      </div>
    );
  };

    eventSource.onmessage = (event) => {
      try {
        const progress = JSON.parse(event.data);
        // ADD: Update cache stats if present
        if (progress.cacheStats) {
          setCacheStats(progress.cacheStats);
        }      
        console.log('Enhanced progress update:', progress);
        
        // ENHANCED: Check for dedicated completion message
        if (progress.type === 'RESEARCH_COMPLETE' || progress.completed === true) {
          console.log('🎯 COMPLETION DETECTED via SSE message');
          console.log('Completion data:', progress);
          
          // Close SSE connection immediately
          if (eventSource) {
            eventSource.close();
            eventSourceRef.current = null;
          }
          
          // Update states
          setResearchStatus('completed');
          setResearchingProductId(null);
          
          // Update final progress
          setResearchProgress({
            total: progress.total,
            processed: progress.processed || progress.total,
            successful: progress.successful,
            failed: progress.failed,
            datesFound: progress.datesFound,
            percentComplete: 100,
            message: progress.message || 'Research completed'
          });
          
          // Call the completion callback
          if (onResearchComplete) {
            console.log('✅ Calling onResearchComplete callback');
            onResearchComplete();
          }
          
          // ADD THIS: Scroll to top when complete
          window.scrollTo({
            top: 0,
            behavior: 'smooth'
          });

          // Fetch final results
          setTimeout(() => {
            fetchResults();
          }, 500);
          
          return; // Exit early for completion
        }
        
        // Update basic progress state
        setResearchProgress(prevProgress => ({
          ...progress,
          percentComplete: progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0
        }));
        // Update basic progress state
  setResearchProgress(prevProgress => ({
    ...progress,
    percentComplete: progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0
  }));
  
  // ADD THIS: Update cache stats if present
  if (progress.cacheStats) {
    setCacheStats(progress.cacheStats);
  }
        // Handle current research product highlighting
        if (progress.researchingProduct) {
          setResearchingProductId(progress.researchingProduct);
          setCurrentResearchProduct(progress.researchingProduct);
          
          // Auto-scroll to current product
          scrollToProduct(progress.researchingProduct);
        } else {
          setResearchingProductId(null);
        }
        
        // Handle updated product data for real-time table updates
        if (progress.updatedProduct) {
          const updatedProduct = progress.updatedProduct;
          
          // Update the products array with new data
          setProducts(prevProducts => {
            return prevProducts.map(product => {
              if (product.product_id === updatedProduct.product_id) {
                // Merge the updates
                return {
                  ...product,
                  ...updatedProduct
                };
              }
              return product;
            });
          });
          
          // Add to recently updated products for visual feedback
          setRecentlyUpdatedProducts(prev => {
            const newMap = new Map(prev);
            newMap.set(updatedProduct.product_id, {
              timestamp: new Date(),
              success: true,
              datesFound: updatedProduct.foundDates
            });
            
            // Remove old entries after 3 seconds
            setTimeout(() => {
              setRecentlyUpdatedProducts(current => {
                const updated = new Map(current);
                updated.delete(updatedProduct.product_id);
                return updated;
              });
            }, 3000);
            
            return newMap;
          });
          
          // Flash cells that got new dates
          if (updatedProduct.foundDates) {
            flashDateCells(updatedProduct.product_id, updatedProduct.foundDates);
          }
        }
        
        // Handle failed product
        if (progress.failedProduct) {
          setRecentlyUpdatedProducts(prev => {
            const newMap = new Map(prev);
            newMap.set(progress.failedProduct.product_id, {
              timestamp: new Date(),
              success: false,
              error: progress.failedProduct.error
            });
            
            setTimeout(() => {
              setRecentlyUpdatedProducts(current => {
                const updated = new Map(current);
                updated.delete(progress.failedProduct.product_id);
                return updated;
              });
            }, 3000);
            
            return newMap;
          });
        }
        
        // Update history and dates found count
        if (progress.updateHistory) {
          setUpdateHistory(progress.updateHistory);
        }
        if (progress.datesFound !== undefined) {
          setDatesFoundCount(progress.datesFound);
        }
        
        // ENHANCED: Multiple completion detection methods
        // Method 1: Check the completed flag
        if (progress.completed === true) {
          console.log('✅ Research complete detected via completed flag!');
          handleResearchCompletion(progress);
          return;
        }
        
        // Method 2: Check if all products are processed
        if (progress.processed === progress.total && progress.total > 0) {
          console.log('✅ Research complete detected via processed count!');
          // Wait a bit for final message or proceed
          setTimeout(() => {
            if (researchStatus === 'running') {
              handleResearchCompletion(progress);
            }
          }, 1500);
        }
        
        // Method 3: Check for completion message pattern
        if (progress.message && progress.message.toLowerCase().includes('research completed')) {
          console.log('✅ Research complete detected via message content!');
          setTimeout(() => {
            if (researchStatus === 'running') {
              handleResearchCompletion(progress);
            }
          }, 1000);
        }
        
      } catch (error) {
        console.error('Error parsing enhanced progress update:', error, event.data);
      }
    };

    
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      
      if (!connectionReady) {
        console.error('Failed to establish SSE connection');
        eventSource.close();
        setResearchStatus('idle');
        alert('Failed to connect to progress updates. Please check if the server is running.');
        return;
      }
      
      setResearchProgress(prevProgress => {
        if (prevProgress.processed > 0) {
          console.log('Connection lost but some items were processed');
          setResearchStatus('completed');
          
          // Call the completion callback
          if (onResearchComplete) {
            onResearchComplete();
          }
          
          fetchResults();
        } else {
          setResearchStatus('idle');
          alert('Lost connection to research progress. Please check the console.');
        }
        return prevProgress;
      });
      
      eventSource.close();
    };
    
    // Function to start the actual research
    // Function to start the actual research
        const startResearch = async () => {
          try {
            console.log(`Starting research process... (Cache ${useCacheEnabled ? 'ENABLED' : 'DISABLED'})`);
            
            // Define URL first (BEFORE using it)
            const postUrl = API_BASE_URL 
              ? `${API_BASE_URL}/api/phase3/run-research`
              : `/api/phase3/run-research`;
            
            // Single response declaration with cache parameter
            const response = await fetch(postUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                jobId: phase3JobId,
                useCache: useCacheEnabled  // Pass cache preference
              })
            });
            
            const data = await response.json();
            
            if (!response.ok || !data.success) {
              console.error('Failed to start research:', data.error);
              setResearchStatus('idle');
              alert(data.error || 'Failed to start research');
            }
          } catch (error) {
            console.error('Error starting research:', error);
            setResearchStatus('idle');
            alert('Failed to start research. Please check the console.');
          }
        };
      };

  // ============= REAL-TIME UPDATE HELPER FUNCTIONS =============
  const scrollToProduct = (productId) => {
    if (!tableRef.current) return;
    
    // Debounce scrolling
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      const row = document.getElementById(`product-row-${productId}`);
      if (row) {
        row.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }, 100);
  };

  const flashDateCells = (productId, foundDates) => {
    const cellsToFlash = [];
    if (foundDates.end_of_sale) cellsToFlash.push(`${productId}-eos`);
    if (foundDates.end_of_sw_maintenance) cellsToFlash.push(`${productId}-eosm`);
    if (foundDates.end_of_sw_vulnerability) cellsToFlash.push(`${productId}-eosv`);
    if (foundDates.last_day_of_support) cellsToFlash.push(`${productId}-ldos`);
    
    setFlashingCells(prev => {
      const newMap = new Map(prev);
      cellsToFlash.forEach(cellId => {
        newMap.set(cellId, true);
      });
      
      // Remove flash after animation
      setTimeout(() => {
        setFlashingCells(current => {
          const updated = new Map(current);
          cellsToFlash.forEach(cellId => {
            updated.delete(cellId);
          });
          return updated;
        });
      }, 1000);
      
      return newMap;
    });
  };

  // ============= REPORT GENERATION FUNCTIONS =============
  const generateLifecycleReport = async () => {
    if (!phase3JobId) return;
    
    setReportGenerating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/reports/lifecycle-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: phase3JobId,
          eolYearBasis,
          customerName
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setViewMode('report');
        console.log('Report generated:', data);
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setReportGenerating(false);
    }
  };

  const exportToExcel = async () => {
    if (!phase3JobId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/phase3/export-results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: phase3JobId
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `phase3_results_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        // Handle non-OK response
        const errorData = await response.json().catch(() => ({ error: 'Failed to export report' }));
        console.error('Export failed:', errorData);
        alert(`Failed to export Excel: ${errorData.error || errorData.message || 'Unknown error occurred'}`);
      }
    } catch (error) {
      console.error('Failed to export Excel:', error);
      alert(`Failed to export Excel: ${error.message || 'Network error occurred'}`);
    }
  };

  // ============= FILTERING AND SORTING FUNCTIONS =============
  const filterAndSortProducts = () => {
    let filtered = [...products];

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.product_id?.toLowerCase().includes(search) ||
        p.description?.toLowerCase().includes(search) ||
        p.manufacturer?.toLowerCase().includes(search) ||
        p.product_category?.toLowerCase().includes(search)
      );
    }

    // Apply lifecycle status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(p => p.lifecycle_status === filterStatus);
    }

    // Apply risk level filter
    if (filterRisk !== 'all') {
      filtered = filtered.filter(p => p.risk_level === filterRisk);
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue = a[sortBy] || '';
      let bValue = b[sortBy] || '';
      
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredProducts(filtered);
  };

  // ============= UTILITY FUNCTIONS =============
  const formatDate = (date) => {
    if (!date) return '-';
    try {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return date;
    }
  };

  const getRiskLevelColor = (risk) => {
    switch (risk) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getLifecycleStatusColor = (status) => {
    switch (status) {
      case 'End of Life': return 'text-red-600 bg-red-50';
      case 'End of Support': return 'text-orange-600 bg-orange-50';
      case 'End of Sale': return 'text-yellow-600 bg-yellow-50';
      case 'Current': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    if (confidence >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const toggleProductExpansion = (productId) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  };

  // ============= ENHANCED PROGRESS PANEL COMPONENT =============
  const renderEnhancedProgressPanel = () => {
    if (researchStatus !== 'researching') return null;
    
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Loader className="h-5 w-5 text-purple-600 animate-spin" />
            <h3 className="text-lg font-medium">AI Research in Progress</h3>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              {researchProgress.processed} of {researchProgress.total} products
            </span>
            <span className="text-sm font-medium " style={{ color: '#008080' }}>
              {researchProgress.percentComplete || 0}%
            </span>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
          <div 
            className="h-3 rounded-full transition-all duration-500 progress-bar-fill"
            style={{ background: 'linear-gradient(to right, #008080, #002D62)', width: `${researchProgress.percentComplete || 0}%` }}
          />
        </div>
        {/* ADD THIS: Cache Statistics Display */}
        {(cacheStats.hits > 0 || cacheStats.misses > 0) && <CacheStatsDisplay />}
   
        {/* Current product being researched */}
        {currentResearchProduct && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-yellow-600 animate-pulse" />
              <span className="text-sm font-medium text-yellow-800">
                Currently researching: {currentResearchProduct}
              </span>
            </div>
          </div>
        )}
        
        {/* Statistics */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {researchProgress.successful || 0}
            </div>
            <div className="text-xs text-gray-500">Successful</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {researchProgress.failed || 0}
            </div>
            <div className="text-xs text-gray-500">Failed</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold " style={{ color: '#008080' }}>
              {datesFoundCount || 0}
            </div>
            <div className="text-xs text-gray-500">With Dates</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-600">
              {researchProgress.processed || 0}
            </div>
            <div className="text-xs text-gray-500">Processed</div>
          </div>
        </div>
        
        {/* Recent update history */}
        {updateHistory && updateHistory.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Updates</h4>
            <div className="space-y-1">
              {updateHistory.map((update, index) => (
                <div key={index} className="flex items-center space-x-2 text-xs update-history-item">
                  {update.success ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-red-500" />
                  )}
                  <span className="text-gray-600">
                    {update.product_id}: {update.success ? 
                      `Found ${update.datesFound} dates` : 
                      'Failed to research'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============= ENHANCED TABLE ROW RENDERING WITH REAL-TIME UPDATES =============
  const renderEnhancedProductRow = (product) => {
    const isBeingResearched = researchingProductId === product.product_id;
    const recentUpdate = recentlyUpdatedProducts.get(product.product_id);
    const isRecentlyUpdated = !!recentUpdate;
    
    // Determine row classes based on state
    let rowClasses = "hover:bg-gray-50 cursor-pointer transition-all duration-300";
    
    if (isBeingResearched) {
      rowClasses += " research-highlight";
    } else if (isRecentlyUpdated && recentUpdate.success) {
      rowClasses += " success-pulse";
    } else if (isRecentlyUpdated && !recentUpdate.success) {
      rowClasses += " failure-pulse";
    }
    
    const getCellClass = (fieldName) => {
      const cellId = `${product.product_id}-${fieldName}`;
      if (flashingCells.has(cellId)) {
        return "date-cell-flash";
      }
      return "";
    };
    
    return (
      <React.Fragment key={product.product_id}>
        <tr 
          id={`product-row-${product.product_id}`}
          className={rowClasses}
          onClick={() => toggleProductExpansion(product.product_id)}
        >
          <td className="px-4 py-4">
            <div className="flex items-center space-x-2">
              {expandedProducts.has(product.product_id) ? 
                <ChevronDown className="h-4 w-4 text-gray-400" /> : 
                <ChevronRight className="h-4 w-4 text-gray-400" />
              }
              <div className="flex items-center space-x-2">
                {isBeingResearched && (
                  <Loader className="h-4 w-4 text-yellow-500 animate-spin" />
                )}
                {isRecentlyUpdated && recentUpdate.success && (
                  <CheckCircle2 className="h-4 w-4 text-green-500 animate-fade-in" />
                )}
                {isRecentlyUpdated && !recentUpdate.success && (
                  <AlertCircle className="h-4 w-4 text-red-500 animate-fade-in" />
                )}
                <div>
                  <div className="font-medium text-gray-900">
                    {product.product_id}
                  </div>
                  <div className="text-sm text-gray-500">
                    {product.description || '-'}
                  </div>
                  {isBeingResearched && (
                    <div className="text-xs text-yellow-600 mt-1 animate-pulse">
                      Researching...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </td>
          <td className="px-4 py-4 text-sm text-gray-900">
            {product.manufacturer || '-'}
          </td>
          <td className="px-4 py-4 text-sm text-gray-900">
            {product.product_category || '-'}
          </td>
          <td className="px-4 py-4 text-center">
            <span className="font-medium">{product.total_quantity || 0}</span>
          </td>
          <td className="px-4 py-4 text-center">
            <span className={`px-2 py-1 text-xs rounded-full ${getLifecycleStatusColor(product.lifecycle_status)}`}>
              {product.lifecycle_status || 'Unknown'}
            </span>
          </td>
          <td className="px-4 py-4 text-center">
            <span className={`px-2 py-1 text-xs rounded-full border ${getRiskLevelColor(product.risk_level)}`}>
              {product.risk_level || 'none'}
            </span>
          </td>
          <td className={`px-4 py-4 text-center text-sm ${getCellClass('eos')}`}>
            {formatDate(product.end_of_sale_date)}
          </td>
          <td className={`px-4 py-4 text-center text-sm ${getCellClass('eosm')}`}>
            {formatDate(product.end_of_sw_maintenance_date)}
          </td>
          <td className={`px-4 py-4 text-center text-sm ${getCellClass('eosv')}`}>
            {formatDate(product.end_of_sw_vulnerability_maintenance_date)}
          </td>
          <td className={`px-4 py-4 text-center text-sm ${getCellClass('ldos')}`}>
            {formatDate(product.last_day_of_support_date)}
          </td>
          <td className="px-4 py-4 text-center">
            <div className="flex flex-col items-center">
              <span className={`font-medium ${getConfidenceColor(product.overall_confidence)} confidence-update`}>
                {product.overall_confidence || 0}%
              </span>
              {product.requires_review && (
                <span className="text-xs text-orange-600 mt-1 review-pulse">Review</span>
              )}
            </div>
          </td>
          <td className="px-4 py-4 text-center">
            {product.ai_enhanced && (
              <Brain className="h-4 w-4 mx-auto ai-enhanced-glow" style={{ color: '#008080' }} />
            )}
          </td>
        </tr>
        
        {/* Expanded Details Row */}
        {expandedProducts.has(product.product_id) && (
          <tr className="bg-gray-50">
            <td colSpan={12} className="px-4 py-4">
              <div className="grid grid-cols-3 gap-4">
                {/* Additional Information */}
                <div className="bg-white p-4 rounded-lg border">
                  <h4 className="font-medium text-gray-900 mb-2">Additional Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Product Type:</span>
                      <span>{product.product_type || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Date Introduced:</span>
                      <span>{formatDate(product.date_introduced)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">End of Life:</span>
                      <span>{formatDate(product.end_of_life_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Is Current:</span>
                      <span>{product.is_current_product ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>

                {/* Confidence Scores */}
                <div className="bg-white p-4 rounded-lg border">
                  <h4 className="font-medium text-gray-900 mb-2">Confidence Scores</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Overall:</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="h-2 rounded-full" style={{ backgroundColor: '#008080', width: `${product.overall_confidence || 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{product.overall_confidence || 0}%</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Lifecycle:</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="h-2 rounded-full" style={{ backgroundColor: '#008080', width: `${product.lifecycle_confidence || 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{product.lifecycle_confidence || 0}%</span>
                      </div>
                    </div>
                    {product.manufacturer_confidence && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Manufacturer:</span>
                        <span className="text-sm font-medium">{product.manufacturer_confidence}%</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Data Sources */}
                <div className="bg-white p-4 rounded-lg border">
                  <h4 className="font-medium text-gray-900 mb-2">Data Sources</h4>
                  {product.data_sources && (
                    <div className="space-y-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProductForSources(product);
                          setShowDataSourceModal(true);
                        }}
                        className="mt-2 text-xs font-medium hover:opacity-90" style={{ color: '#008080' }}
                      >
                        View Details
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  // Cache Statistics Display Component
const CacheStatsDisplay = () => {
  if (!cacheStats || (cacheStats.hits === 0 && cacheStats.misses === 0)) {
    return null; // Don't show if no stats yet
  }
  
  return (
    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 text-sm">
          {/* Cache Icon and Label */}
          <div className="flex items-center text-blue-700 font-medium">
            <Database className="h-4 w-4 mr-1" />
            <span>Cache Performance:</span>
          </div>
          
          {/* Hit Count */}
          <div className="flex items-center">
            <span className="text-green-600 font-semibold">
              ✓ Hits: {cacheStats.hits}
            </span>
          </div>
          
          {/* Miss Count */}
          <div className="flex items-center">
            <span className="text-orange-600 font-semibold">
              ✗ Misses: {cacheStats.misses}
            </span>
          </div>
          
          {/* Hit Rate */}
          <div className="flex items-center">
            <span className="text-blue-700 font-bold">
              Hit Rate: {cacheStats.hitRate || 0}%
            </span>
          </div>
          
          {/* Average Time */}
          {cacheStats.avgTimeMs > 0 && (
            <div className="flex items-center text-gray-600">
              <Clock className="h-3 w-3 mr-1" />
              <span>Avg: {cacheStats.avgTimeMs}ms</span>
            </div>
          )}
        </div>
        
        {/* Visual Hit Rate Bar */}
        <div className="flex items-center space-x-2">
          <div className="w-24 h-4 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${cacheStats.hitRate || 0}%` }}
            />
          </div>
          <span className="text-xs text-gray-600">
            {cacheStats.hitRate || 0}%
          </span>
        </div>
      </div>
    </div>
  );
};

  // ============= MAIN RENDER =============
  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="text-white p-6 shadow-lg" style={{ backgroundColor: '#002D62' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <Brain className="h-8 w-8" />
              <span>Phase 3: AI-Enhanced Lifecycle Analysis</span>
            </h1>
            <p className="text-gray-200 mt-2">
              Comprehensive product lifecycle intelligence powered by AI research
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-200">Customer</div>
            <div className="text-xl font-semibold">{customerName || 'Unknown'}</div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium mt-2 ${
              researchStatus === 'researching' ? 'bg-yellow-100 text-yellow-800' :
              researchStatus === 'completed' ? 'bg-green-100 text-green-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {researchStatus === 'researching' ? 'AI Research Active' :
               researchStatus === 'completed' ? 'Research Complete' :
               'Ready for Research'}
            </span>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-5 gap-4 mt-6">
          <div className="bg-white bg-opacity-10 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <div>
                <div className="text-2xl font-bold">{stats.totalProducts}</div>
                <div className="text-xs text-gray-200">Products</div>
              </div>
            </div>
          </div>
          <div className="bg-white bg-opacity-10 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Brain className="h-5 w-5" />
              <div>
                <div className="text-2xl font-bold">{stats.aiEnhanced}</div>
                <div className="text-xs text-gray-200">AI Enhanced</div>
              </div>
            </div>
          </div>
          <div className="bg-white bg-opacity-10 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <div>
                <div className="text-2xl font-bold">{stats.avgConfidence}%</div>
                <div className="text-xs text-gray-200">Avg Confidence</div>
              </div>
            </div>
          </div>
          <div className="bg-white bg-opacity-10 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <div>
                <div className="text-2xl font-bold">{stats.withDates}</div>
                <div className="text-xs text-gray-200">With Dates</div>
              </div>
            </div>
          </div>
          <div className="bg-white bg-opacity-10 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <div className="text-2xl font-bold">{stats.criticalRiskCount + stats.highRiskCount}</div>
                <div className="text-xs text-gray-200">High Risk</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Applied Notice */}
        {job?.filter_name && job.filter_name !== 'No filter' && (
          <div className="mt-4 p-2 bg-yellow-100 bg-opacity-20 rounded-lg">
            <div className="flex items-center space-x-2 text-sm">
              <Filter className="h-4 w-4" />
              <span>Filter Applied: <strong>{job.filter_name}</strong></span>
              <span className="ml-2">
                ({stats.filteredCount} of {stats.originalCount} products)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Progress Panel */}
      <div className="p-6">
        {renderEnhancedProgressPanel()}
      </div>

      {/* AI Research Control Panel */}
      <div className="p-6 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {researchStatus === 'idle' && (
              <button
                onClick={runAIResearch}
                disabled={loading || products.length === 0}
                className="px-6 py-3 text-white rounded-lg font-medium hover:opacity-90 
                         disabled:opacity-50 disabled:cursor-not-allowed 
                         flex items-center space-x-2 transition-all transform hover:scale-105 shadow-lg"
                style={{ backgroundColor: '#008080' }}
              >
                <Zap className="h-5 w-5" />
                <span>Start AI Research</span>
              </button>
            )}

            {/* Cache Control Toggle */}
            <div className="mb-4">
              <CacheToggle />
            </div>

            {researchStatus === 'completed' && (
              <div className="flex items-center space-x-3 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Research Complete</span>
              </div>
            )}

            <button
              onClick={fetchResults}
              disabled={loading}
              className="px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg 
                       hover:bg-gray-50 disabled:opacity-50 flex items-center space-x-2 transition-all"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="flex items-center space-x-4">

            <button
              onClick={exportToExcel}
              disabled={products.length === 0}
              className="px-4 py-2 text-white rounded-lg hover:opacity-90
              style={{ backgroundColor: '#008080' }}
                       disabled:opacity-50 flex items-center space-x-2 transition-all"
            >
              <Download className="h-4 w-4" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search products, manufacturers, categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="all">All Status</option>
            <option value="Current">Current</option>
            <option value="End of Sale">End of Sale</option>
            <option value="End of Support">End of Support</option>
            <option value="End of Life">End of Life</option>
            <option value="Unknown">Unknown</option>
          </select>

          <select
            value={filterRisk}
            onChange={(e) => setFilterRisk(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="all">All Risk Levels</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="none">None</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="total_quantity">Quantity</option>
            <option value="product_id">Product ID</option>
            <option value="manufacturer">Manufacturer</option>
            <option value="lifecycle_status">Status</option>
            <option value="risk_level">Risk</option>
            <option value="overall_confidence">Confidence</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 border rounded-lg hover:bg-gray-100"
          >
            {sortOrder === 'asc' ? 'Ã¢â€ â€˜' : 'Ã¢â€ â€œ'}
          </button>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredProducts.length} of {products.length} products
        </div>
      </div>

      {/* Main Table with Enhanced Rows */}
      {loading && !products.length ? (
        <div className="flex items-center justify-center p-12">
          <Loader className="h-8 w-8 animate-spin" style={{ color: '#008080' }} />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center p-12">
          <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No products found</p>
        </div>
      ) : (
        <div className="overflow-x-auto" ref={tableRef}>
          <table className="min-w-full divide-y divide-gray-200 table-container">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#002D62' }}>
                  Product
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#002D62' }}>
                  Manufacturer
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#002D62' }}>
                  Category
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider" style={{ color: '#002D62' }}>
                  Qty
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider" style={{ color: '#002D62' }}>
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider" style={{ color: '#002D62' }}>
                  Risk
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider" style={{ color: '#002D62' }}>
                  End of Sale
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider" style={{ color: '#002D62' }}>
                  End of SW Maint
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider" style={{ color: '#002D62' }}>
                  End of SW Vuln
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider" style={{ color: '#002D62' }}>
                  Last Day Support
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider" style={{ color: '#002D62' }}>
                  Confidence
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider" style={{ color: '#002D62' }}>
                  AI
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map(product => renderEnhancedProductRow(product))}
            </tbody>
          </table>
        </div>
      )}

      {/* Data Source Modal */}
      {showDataSourceModal && selectedProductForSources && (
        <DataSourcesModal
          product={selectedProductForSources}
          onClose={() => {
            setShowDataSourceModal(false);
            setSelectedProductForSources(null);
          }}
        />
      )}
    </div>
  );
};

export default Phase3Results;
