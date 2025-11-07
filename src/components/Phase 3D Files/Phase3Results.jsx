import React, { useState, useEffect } from 'react';
import { 
  Calendar, AlertTriangle, CheckCircle, Clock, Database, Download, 
  FileText, RefreshCw, Search, Filter, ChevronDown, ChevronRight,
  Brain, Shield, AlertCircle, BarChart2, Zap, Target, TrendingUp,
  Info, Package, Eye, Settings
} from 'lucide-react';
import JobProgress from './JobProgress';
import DataSourcesModal from './DataSourcesModal';
import { Activity, Loader } from 'lucide-react';

const API_BASE_URL = 'http://localhost:3001';

const Phase3Results = ({ phase2JobId, isActive, customerName, onComplete }) => {
  // State Management
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
        
        // Update stats with filter info
        setStats(prev => ({
          ...prev,
          filteredCount: data.filteredItems || 0,
          originalCount: data.originalItems || 0
        }));
      } else {
        console.error('Failed to initialize Phase 3:', data.error);
        alert(data.error || 'Failed to initialize Phase 3');
      }
    } catch (error) {
      console.error('Error initializing Phase 3:', error);
      alert('Error initializing Phase 3: ' + error.message);
    } finally {
      setInitializing(false);
    }
  };

  const fetchResults = async () => {
    if (!phase3JobId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/phase3/results/${phase3JobId}`);
      const data = await response.json();
      
      if (data.job) {
        setJob(data.job);
        
        // Check research status
        if (data.job.status === 'research_complete' || data.job.status === 'completed') {
          setResearchStatus('completed');
        } else if (data.job.status === 'researching') {
          setResearchStatus('running');
        } else {
          setResearchStatus('idle');
        }
      }
      
      if (data.products) {
        setProducts(data.products);
        calculateStats(data.products);
        
        // Check if products have AI-enhanced lifecycle data
        const hasAIData = data.products.some(p => p.ai_enhanced);
        if (hasAIData) {
          setResearchStatus('completed');
        }
      }

      // Notify parent if complete
      if (data.job?.status === 'completed' && onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Failed to fetch results:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (productList) => {
    const stats = {
      totalProducts: productList.length,
      aiEnhanced: 0,
      currentProducts: 0,
      avgConfidence: 0,
      highRiskCount: 0,
      criticalRiskCount: 0,
      requiresReview: 0,
      withDates: 0,
      withAllDates: 0,
      filteredCount: productList.length,
      originalCount: job?.original_count || productList.length
    };

    let totalConfidence = 0;

    productList.forEach(product => {
      // Count AI enhanced products
      if (product.ai_enhanced) {
        stats.aiEnhanced++;
      }

      // Count current products
      if (product.is_current_product) {
        stats.currentProducts++;
      }

      // Count risk levels
      if (product.risk_level === 'high') {
        stats.highRiskCount++;
      } else if (product.risk_level === 'critical') {
        stats.criticalRiskCount++;
      }

      // Count review requirements
      if (product.requires_review) {
        stats.requiresReview++;
      }

      // Count products with dates
      const hasAnyDate = product.end_of_sale_date || product.last_day_of_support_date || 
                        product.end_of_life_date || product.end_of_sw_maintenance_date ||
                        product.end_of_sw_vulnerability_maintenance_date;
      if (hasAnyDate) {
        stats.withDates++;
      }

      // Count products with all key dates
      const hasAllDates = product.end_of_sale_date && product.last_day_of_support_date &&
                         product.end_of_sw_vulnerability_maintenance_date;
      if (hasAllDates) {
        stats.withAllDates++;
      }

      // Sum confidence scores
      totalConfidence += (product.overall_confidence || 0);
    });

    // Calculate average confidence
    if (productList.length > 0) {
      stats.avgConfidence = Math.round(totalConfidence / productList.length);
    }

    setStats(stats);
  };

  const runAIResearch = async () => {
  if (!phase3JobId) {
    console.error('No Phase 3 job ID available');
    return;
  }
  
  console.log(`Starting AI research for job: ${phase3JobId}`);
  setResearchStatus('running');
  setResearchProgress({
    total: products.length,
    processed: 0,
    successful: 0,
    failed: 0,
    current: 0,
    currentProduct: 'Initializing...',
    message: 'Starting AI research...'
  });

  try {
    // CRITICAL FIX: Set up SSE connection FIRST, before starting research
    // This ensures we don't miss any progress updates
    const sseUrl = API_BASE_URL 
      ? `${API_BASE_URL}/api/phase3/research-progress/${phase3JobId}`
      : `/api/phase3/research-progress/${phase3JobId}`;
    
    console.log(`Setting up SSE connection to: ${sseUrl}`);
    const eventSource = new EventSource(sseUrl);
    
    // Track if connection is ready
    let connectionReady = false;
    let researchStarted = false;
    
    // Set up all event handlers before starting research
    eventSource.onopen = () => {
      console.log(`✅ SSE connection opened for job: ${phase3JobId}`);
      connectionReady = true;
      
      // Start the research only after SSE is connected
      if (!researchStarted) {
        researchStarted = true;
        startResearch();
      }
    };
    
    eventSource.onmessage = (event) => {
      try {
        const progress = JSON.parse(event.data);
        console.log('Progress update:', progress);
        
        // Update the progress state with all the data
        setResearchProgress(prevProgress => ({
          ...progress,
          percentComplete: progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0
        }));
        
        // Check if research is complete
        if (progress.processed === progress.total && progress.total > 0) {
          console.log('Research complete!');
          eventSource.close();
          setResearchStatus('completed');
          
          // Refresh results after a short delay
          setTimeout(() => {
            fetchResults();
          }, 1000);
        }
      } catch (error) {
        console.error('Error parsing progress update:', error, event.data);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      
      // Check if connection was never established
      if (!connectionReady) {
        console.error('Failed to establish SSE connection');
        eventSource.close();
        setResearchStatus('idle');
        alert('Failed to connect to progress updates. Please check if the server is running.');
        return;
      }
      
      // If we lost connection after some processing
      setResearchProgress(prevProgress => {
        if (prevProgress.processed > 0) {
          console.log('Connection lost but some items were processed');
          setResearchStatus('completed');
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
    const startResearch = async () => {
      try {
        console.log('Starting research process...');
        const postUrl = API_BASE_URL 
          ? `${API_BASE_URL}/api/phase3/run-research`
          : `/api/phase3/run-research`;
          
        // Don't await - let it run in background while we listen to SSE
        fetch(postUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: phase3JobId })
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Research failed with status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          console.log('Research backend completed:', data);
        })
        .catch(error => {
          console.error('Research backend error:', error);
          eventSource.close();
          setResearchStatus('idle');
          alert('Research failed. Please check the console for details.');
        });
      } catch (error) {
        console.error('Failed to start research:', error);
        eventSource.close();
        setResearchStatus('idle');
        alert('Failed to start AI research. Please check the console.');
      }
    };
    
    // If connection opens immediately (synchronous), start research
    // Otherwise it will start in the onopen handler
    if (connectionReady && !researchStarted) {
      researchStarted = true;
      startResearch();
    }
    
    // Fallback: If connection doesn't open within 3 seconds, try starting anyway
    setTimeout(() => {
      if (!researchStarted) {
        console.warn('SSE connection timeout - starting research anyway');
        researchStarted = true;
        startResearch();
      }
    }, 3000);
    
  } catch (error) {
    console.error('Failed to initialize AI research:', error);
    setResearchStatus('idle');
    alert('Failed to start AI research. Please check the console.');
  }
};

// Also update the progress display in the render section.
// Find the research status display (around lines 280-320) and replace with:

{researchStatus === 'running' && (
  <div className="flex items-center space-x-4">
    <div className="flex items-center space-x-2">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-600 border-t-transparent"></div>
      <div className="flex flex-col">
        <span className="font-medium text-purple-600">
          Researching {researchProgress.processed}/{researchProgress.total}
        </span>
        <span className="text-sm text-gray-600">
          Current: {researchProgress.currentProduct || 'Loading...'}
        </span>
      </div>
    </div>
    <div className="flex-1 max-w-md">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600">
          {researchProgress.message || `Processing ${researchProgress.current} of ${researchProgress.total}`}
        </span>
        <span className="text-xs font-medium text-purple-600">
          {researchProgress.percentComplete || 0}%
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-gradient-to-r from-purple-600 to-indigo-600 h-2 rounded-full transition-all duration-300"
          style={{ 
            width: `${researchProgress.percentComplete || 0}%`
          }}
        />
      </div>
      <div className="flex justify-between mt-1 text-xs text-gray-500">
        <span>âœ… {researchProgress.successful || 0} successful</span>
        <span>âŒ {researchProgress.failed || 0} failed</span>
      </div>
    </div>
  </div>
)}

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
        // Switch to report view
        setViewMode('report');
        // You could display the report data here
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
      const response = await fetch(`${API_BASE_URL}/api/reports/export/lifecycle-report-excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: phase3JobId,
          eolYearBasis,
          customerName
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lifecycle_report_${customerName || 'export'}_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export Excel:', error);
    }
  };

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

    // Apply risk filter
    if (filterRisk !== 'all') {
      filtered = filtered.filter(p => p.risk_level === filterRisk);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      // Handle null/undefined values
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      // Handle numeric sorting
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // Handle string sorting
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredProducts(filtered);
  };

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

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Premium Header with AI Badge */}
      <div className="p-6 border-b bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-t-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Brain className="h-8 w-8" />
            <div>
              <h2 className="text-2xl font-bold">PHASE 3: AI-POWERED LIFECYCLE ANALYSIS</h2>
              <p className="text-purple-100 mt-1">
                Enhanced lifecycle research with Google AI and confidence scoring
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="bg-white bg-opacity-20 px-3 py-1 rounded-full text-sm">
              Premium Feature
            </span>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-5 gap-4 mt-6">
          <div className="bg-white bg-opacity-20 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <div>
                <div className="text-2xl font-bold">{stats.totalProducts}</div>
                <div className="text-xs text-purple-200">Products</div>
              </div>
            </div>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Brain className="h-5 w-5" />
              <div>
                <div className="text-2xl font-bold">{stats.aiEnhanced}</div>
                <div className="text-xs text-purple-200">AI Enhanced</div>
              </div>
            </div>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <div>
                <div className="text-2xl font-bold">{stats.avgConfidence}%</div>
                <div className="text-xs text-purple-200">Avg Confidence</div>
              </div>
            </div>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <div>
                <div className="text-2xl font-bold">{stats.withDates}</div>
                <div className="text-xs text-purple-200">With Dates</div>
              </div>
            </div>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <div className="text-2xl font-bold">{stats.criticalRiskCount + stats.highRiskCount}</div>
                <div className="text-xs text-purple-200">High Risk</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Applied Notice */}
        {job?.filter_name && job.filter_name !== 'No filter' && (
          <div className="mt-4 p-2 bg-yellow-500 bg-opacity-20 rounded-lg">
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

      {/* AI Research Control Panel */}
      <div className="p-6 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {researchStatus === 'idle' && (
              <button
                onClick={runAIResearch}
                disabled={loading || products.length === 0}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg 
                         font-medium hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 
                         disabled:cursor-not-allowed flex items-center space-x-2 transition-all
                         transform hover:scale-105 shadow-lg"
              >
                <Zap className="h-5 w-5" />
                <span>Start AI Research</span>
              </button>
            )}

            {researchStatus === 'running' && (
            <div className="p-4 rounded-lg bg-gradient-to-r from-teal-50 to-cyan-50 border-2 border-teal-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold flex items-center" style={{ color: '#008080' }}>
                  <Activity className="inline mr-2 animate-pulse" size={20} />
                  AI RESEARCH IN PROGRESS
                </h3>
                <span className="text-2xl font-bold" style={{ color: '#002D62' }}>
                  {researchProgress.current || researchProgress.processed} OF {researchProgress.total}
                </span>
              </div>
              
              {/* Progress Bar */}
              <div className="mb-4">
                <div className="w-full h-8 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all duration-500 ease-out flex items-center justify-center text-white font-bold"
                    style={{ 
                      width: `${Math.max(5, (researchProgress.processed / researchProgress.total) * 100)}%`,
                      backgroundColor: '#008080'
                    }}
                  >
                    {Math.round((researchProgress.processed / researchProgress.total) * 100)}%
                  </div>
                </div>
              </div>

              {/* Current Product Being Researched */}
              {researchProgress.currentProduct && (
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Loader className="animate-spin" size={16} style={{ color: '#008080' }} />
                      <div>
                        <p className="text-xs font-bold uppercase text-gray-500">CURRENTLY RESEARCHING</p>
                        <p className="font-bold" style={{ color: '#002D62' }}>
                          {researchProgress.currentProduct}
                        </p>
                        {researchProgress.message && (
                          <p className="text-sm text-gray-600 mt-1">{researchProgress.message}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        <span className="text-green-600 font-bold">{researchProgress.successful || 0}</span> Successful
                      </p>
                      {researchProgress.failed > 0 && (
                        <p className="text-sm text-gray-500">
                          <span className="text-red-600 font-bold">{researchProgress.failed}</span> Failed
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Progress Stats Grid */}
              <div className="grid grid-cols-4 gap-3 mt-3">
                <div className="text-center">
                  <p className="text-xs font-bold uppercase text-gray-500">TOTAL</p>
                  <p className="text-lg font-bold" style={{ color: '#002D62' }}>
                    {researchProgress.total}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold uppercase text-gray-500">PROCESSED</p>
                  <p className="text-lg font-bold" style={{ color: '#008080' }}>
                    {researchProgress.processed}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold uppercase text-gray-500">SUCCESSFUL</p>
                  <p className="text-lg font-bold text-green-600">
                    {researchProgress.successful || 0}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold uppercase text-gray-500">FAILED</p>
                  <p className="text-lg font-bold text-red-600">
                    {researchProgress.failed || 0}
                  </p>
                </div>
              </div>
            </div>
          )}

            {researchStatus === 'completed' && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-green-600">
                  <CheckCircle className="h-6 w-6" />
                  <span className="font-medium">Research Complete</span>
                </div>
                <button
                  onClick={runAIResearch}
                  className="px-4 py-2 border border-purple-600 text-purple-600 rounded-lg 
                           hover:bg-purple-50 flex items-center space-x-2 transition-all"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Re-run Research</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode(viewMode === 'table' ? 'report' : 'table')}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 
                       flex items-center space-x-2 transition-all"
            >
              <Eye className="h-4 w-4" />
              <span>{viewMode === 'table' ? 'Report View' : 'Table View'}</span>
            </button>
            
            <button
              onClick={generateLifecycleReport}
              disabled={reportGenerating || products.length === 0}
              className="px-4 py-2 bg-navy text-white rounded-lg hover:bg-opacity-90 
                       disabled:opacity-50 flex items-center space-x-2 transition-all"
              style={{ backgroundColor: '#002D62' }}
            >
              <FileText className="h-4 w-4" />
              <span>Generate Report</span>
            </button>

            <button
              onClick={exportToExcel}
              disabled={products.length === 0}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 
                       disabled:opacity-50 flex items-center space-x-2 transition-all"
            >
              <Download className="h-4 w-4" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Report Options */}
        {viewMode === 'report' && (
          <div className="mt-4 p-4 bg-white rounded-lg border">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End of Life Year Basis:
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  value="lastDayOfSupport"
                  checked={eolYearBasis === 'lastDayOfSupport'}
                  onChange={(e) => setEolYearBasis(e.target.value)}
                />
                <span>Last Day of Support</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  value="endOfSwVulnerability"
                  checked={eolYearBasis === 'endOfSwVulnerability'}
                  onChange={(e) => setEolYearBasis(e.target.value)}
                />
                <span>End of SW Vulnerability</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  value="endOfSale"
                  checked={eolYearBasis === 'endOfSale'}
                  onChange={(e) => setEolYearBasis(e.target.value)}
                />
                <span>End of Sale</span>
              </label>
            </div>
          </div>
        )}
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
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="total_quantity">Quantity</option>
            <option value="overall_confidence">Confidence</option>
            <option value="risk_level">Risk Level</option>
            <option value="product_id">Product ID</option>
            <option value="manufacturer">Manufacturer</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 border rounded-lg hover:bg-gray-50"
          >
            {sortOrder === 'asc' ? 'â†‘' : 'â†“'}
          </button>
        </div>

        <div className="mt-2 text-sm text-gray-600">
          Showing {filteredProducts.length} of {products.length} products
        </div>
      </div>

      {/* Main Content Area */}
      {loading || initializing ? (
        <div className="p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {initializing ? 'Initializing Phase 3 Analysis...' : 'Loading results...'}
          </p>
        </div>
      ) : products.length === 0 ? (
        <div className="p-12 text-center">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No products found</p>
          <p className="text-sm text-gray-500 mt-2">
            Phase 2 analysis needs to be completed first
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Manufacturer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Risk
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  End of Sale
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  End SW Maint
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  End SW Vuln
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Support
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  AI
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <React.Fragment key={product.product_id}>
                  <tr 
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => toggleProductExpansion(product.product_id)}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center space-x-2">
                        {expandedProducts.has(product.product_id) ? 
                          <ChevronDown className="h-4 w-4 text-gray-400" /> : 
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        }
                        <div>
                          <div className="font-medium text-gray-900">
                            {product.product_id}
                          </div>
                          <div className="text-sm text-gray-500">
                            {product.description || '-'}
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
                    <td className="px-4 py-4 text-center text-sm">
                      {formatDate(product.end_of_sale_date)}
                    </td>
                    <td className="px-4 py-4 text-center text-sm">
                      {formatDate(product.end_of_sw_maintenance_date)}
                    </td>
                    <td className="px-4 py-4 text-center text-sm">
                      {formatDate(product.end_of_sw_vulnerability_maintenance_date)}
                    </td>
                    <td className="px-4 py-4 text-center text-sm">
                      {formatDate(product.last_day_of_support_date)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`font-medium ${getConfidenceColor(product.overall_confidence)}`}>
                          {product.overall_confidence || 0}%
                        </span>
                        {product.requires_review && (
                          <span className="text-xs text-orange-600 mt-1">Review</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {product.ai_enhanced && (
                        <Brain className="h-4 w-4 text-purple-600 mx-auto" />
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
                                <span className="text-gray-500">Support Coverage:</span>
                                <span>{product.support_coverage_percent || 0}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Current Product:</span>
                                <span>{product.is_current_product ? 'Yes' : 'No'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Confidence Details */}
                          <div className="bg-white p-4 rounded-lg border">
                            <h4 className="font-medium text-gray-900 mb-2">Confidence Scores</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-500">Overall:</span>
                                <div className="flex items-center space-x-2">
                                  <div className="w-24 bg-gray-200 rounded-full h-2">
                                    <div 
                                      className="bg-purple-600 h-2 rounded-full"
                                      style={{ width: `${product.overall_confidence || 0}%` }}
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
                                      className="bg-purple-600 h-2 rounded-full"
                                      style={{ width: `${product.lifecycle_confidence || 0}%` }}
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
                            {product.data_sources && product.data_sources.length > 0 ? (
                              <div className="space-y-1">
                                {product.data_sources.map((source, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">{source.type || 'Unknown'}</span>
                                    <span className={`text-xs px-2 py-1 rounded ${
                                      source.reliability === 'high' ? 'bg-green-100 text-green-700' :
                                      source.reliability === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {source.reliability || 'Unknown'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">No data sources available</p>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProductForSources(product);
                                setShowDataSourceModal(true);
                              }}
                              className="mt-2 text-xs text-purple-600 hover:text-purple-700 font-medium"
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
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