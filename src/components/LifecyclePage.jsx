import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, TrendingUp, Shield, Lightbulb, Menu, X, Download, Filter } from 'lucide-react';
import Phase2Results from './Phase2Results';
import Phase3Results from './Phase3Results';
import Phase1FilterPanel from './Phase1filterpanel';
import "../styles/phase3.css";
import LifecycleReportView from './LifecycleReportView';

/**
 * DESIGN SYSTEM GUIDE
 * ===================
 * 
 * BRAND & TOKENS
 * --------------
 * Company: Positive Impact Technology
 * Tagline: Technology That Elevates Purpose
 * Mission: Deliver simple, reliable, and affordable technology solutions
 * 
 * COLORS
 * ------
 * Primary Navy: #002D62 (headers, primary text, emphasis)
 * Accent Teal: #008080 (CTAs, active states, success indicators)
 * Background Off-White: #F8F8F8 (page background)
 * White: #FFFFFF (cards, input backgrounds)
 * 
 * TYPOGRAPHY
 * ----------
 * Font Stack: Proxima Nova, Inter, system-ui
 * Headings: Bold UPPERCASE
 * Body: Regular sentence case
 * Accents: Light italic for quotes/emphasis
 * 
 * PERSONALITY
 * -----------
 * Trusted, approachable, human-centered, practical innovation, purpose-driven
 * Classic, trustworthy, minimal with strong navy/teal contrast
 * 
 * LAYOUT
 * ------
 * Auto-sizing layout: Input section fits content, Results section takes remaining space
 * Responsive breakpoints: 1280px desktop → 375px mobile
 * Grid system: Tailwind utilities with consistent padding and margins
 * Equal margins throughout for visual balance
 */

const LifecyclePage = () => {
  const [selectedFilterId, setSelectedFilterId] = useState(null);
  const [phase1Results, setPhase1Results] = useState(null);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  // State management for interactive elements
  const [activePhase, setActivePhase] = useState(null);
  const [completedPhases, setCompletedPhases] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [formData, setFormData] = useState({
    customerName: ''
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const fileInputRef = useRef(null);

  // Additional state for backend integration
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisJobId, setAnalysisJobId] = useState(null);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [analysisError, setAnalysisError] = useState(null);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [dataRows, setDataRows] = useState(null);
  const [phase2JobId, setPhase2JobId] = useState(null);
  const [phase3JobId, setPhase3JobId] = useState(null);
  const [phase3ResearchComplete, setPhase3ResearchComplete] = useState(false);

  const phases = [
    { id: 1, name: 'Phase 1', icon: FileText },
    { id: 2, name: 'Phase 2', icon: TrendingUp },
    { id: 3, name: 'Phase 3', icon: CheckCircle },
    { id: 4, name: 'Lifecycle Report', icon: Download }
  ];

    // Add this handler function for Phase 2 completion (add it with other handlers)
  const handlePhase2Complete = (phase2JobId) => {
    console.log('Phase 2 complete, job ID:', phase2JobId);
    
    // Mark Phase 2 as complete
    setCompletedPhases(prev => {
      if (!prev.includes(2)) {
        return [...prev, 2];
      }
      return prev;
    });
    
    // Store the Phase 2 job ID for Phase 3
    setPhase2JobId(phase2JobId);
  };

  // File handling functions
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xlsb'))) {
      setUploadedFile(file);
      setAnalysisError(null);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedFile(file);
      setAnalysisError(null);
    }
  };

  const handleFilterChange = (filterId) => {
    setSelectedFilterId(filterId);
    console.log('Phase 1 filter selected:', filterId);
  };

  // Backend API integration for Phase 1
  const runPhase1Analysis = async () => {
    setIsAnalyzing(true);
    setAnalysisStatus('Uploading file...');
    setAnalysisError(null);
    
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('file', uploadedFile);
      formDataToSend.append('customerName', formData.customerName || 'Unknown Customer');
      
      // Add the selected filter ID if one is selected
      if (selectedFilterId && selectedFilterId !== 'no-filter') {
        formDataToSend.append('filterSetId', selectedFilterId);
      }

      const response = await fetch('/api/phase1/upload', {
        method: 'POST',
        body: formDataToSend
      });

      if (!response.ok) {
        let errorMessage = `Server error: ${response.status}`;
        try {
          const errorData = await response.json();
          console.error('Backend error response:', JSON.stringify(errorData, null, 2));
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          try {
            const errorText = await response.text();
            console.error('Backend error text:', errorText);
            errorMessage = errorText || errorMessage;
          } catch (e) {
            console.error('Could not parse error response');
          }
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      const jobId = data.job_id || data.jobId;
      
      if (!jobId) {
        throw new Error('No job ID received from server');
      }
      
      setAnalysisJobId(jobId);
      setDataRows(data.rows_uploaded || 1247);
      setAnalysisStatus('Processing file...');
      
      // Poll for status
      const checkStatus = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/phase1/status/${jobId}`);
          
          if (!statusRes.ok) {
            clearInterval(checkStatus);
            throw new Error('Status check failed');
          }
          
          const status = await statusRes.json();
          
          if (status.status === 'completed' || status.status === 'complete') {
            clearInterval(checkStatus);
            setCompletedPhases(prev => [...prev, 1]);
            setActivePhase(1);
            setIsAnalyzing(false);
            setAnalysisStatus('');
            
            setPhase1Results(status);
            
            if (status.results) {
              setAnalysisResults(status.results);
            }
            
            fetchDetailedResults(jobId);
          } else if (status.status === 'failed' || status.status === 'error') {
            clearInterval(checkStatus);
            setIsAnalyzing(false);
            setAnalysisError(status.error || 'Analysis failed');
          }
        } catch (error) {
          clearInterval(checkStatus);
          setIsAnalyzing(false);
          setAnalysisError('Failed to check status: ' + error.message);
        }
      }, 2000);
      
      setTimeout(() => {
        clearInterval(checkStatus);
        if (isAnalyzing) {
          setIsAnalyzing(false);
          setAnalysisError('Analysis timeout - please try again');
        }
      }, 60000);
      
    } catch (error) {
      console.error('Phase 1 analysis error:', error);
      setIsAnalyzing(false);
      setAnalysisError(error.message);
    }
  };

  const normalizeSupport = (value) => {
    if (!value || value === '-') return '-';
    const lowerValue = value.toString().toLowerCase().trim();
    
    // Priority checks for specific values
    if (lowerValue === 'covered') {
      return 'Active';
    }
    
    if (lowerValue === 'not covered' || lowerValue === 'notcovered') {
      return 'Expired';
    }
    
    if (lowerValue === 'active' || 
        lowerValue === 'yes' ||
        lowerValue === 'y' ||
        lowerValue === 'maintenance' ||
        lowerValue === 'under support' ||
        lowerValue === 'supported') {
      return 'Active';
    }
    
    if (lowerValue.includes('covered') && 
        !lowerValue.includes('not') && 
        !lowerValue.includes('no ')) {
      return 'Active';
    }
    
    if (lowerValue.includes('active') && 
        !lowerValue.includes('inactive') &&
        !lowerValue.includes('not')) {
      return 'Active';
    }
    
    if (lowerValue.includes('not covered') || 
        lowerValue.includes('no coverage') || 
        lowerValue.includes('expired') ||
        lowerValue === 'no' ||
        lowerValue === 'n' ||
        lowerValue === 'none' ||
        lowerValue === 'ended') {
      return 'Expired';
    }
    
    return value;
  };

  const fetchDetailedResults = async (jobId) => {
    try {
      setIsLoadingResults(true);
      console.log('Fetching results for job:', jobId);
      
      const response = await fetch(`/api/phase1/results/${jobId}`);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        console.error('Response not OK:', response.status);
        throw new Error('Failed to fetch results');
      }
      
      const detailedData = await response.json();
      console.log('Detailed data received:', detailedData);
      
      if (detailedData.products) {
        detailedData.products = detailedData.products.map(product => {
          const normalizedProduct = {
            ...product,
            category: product.category || product['Business Entity'] || product.business_entity || '-',
            description: product.description || product['Product Description'] || product.product_description || '-',
            support_coverage: normalizeSupport(
              product.support_coverage || 
              product.Coverage || 
              product.coverage || 
              product['Support Coverage'] || 
              product['Covered line status'] || 
              product['Covered Line Status'] || 
              product.covered_line_status || 
              product.CoveredLineStatus ||
              '-'
            ),
            end_of_sale: product.end_of_sale || 
                         product['End of Product Sale'] || 
                         product.end_of_product_sale || 
                         product['End of Sale'] || 
                         '-',
            last_day_support: product.last_day_support || 
                             product['Last Date of Support'] || 
                             product.last_date_of_support || 
                             product['Last Support'] || 
                             product.last_support || 
                             '-',
            asset_type: product.asset_type || 
                        product['Asset Type'] || 
                        product.AssetType || 
                        '-',
            ship_date: product.ship_date || 
                       product['Ship Date'] || 
                       product.ShipDate || 
                       product.ship_dt || 
                       '-'
          };
          
          return normalizedProduct;
        });
      }
      
      setPhase1Results(prevResults => {
        const newResults = {
          ...prevResults,
          detailed: detailedData
        };
        console.log('Updated phase1Results:', newResults);
        return newResults;
      });
    } catch (error) {
      console.error('Error fetching detailed results:', error);
    } finally {
      setIsLoadingResults(false);
    }
  };

  const handleExport = async () => {
    console.log('🔍 Lifecycle Report Export triggered');
    console.log('🔍 phase3JobId:', phase3JobId);
    console.log('🔍 phase3ResearchComplete:', phase3ResearchComplete);
    
    if (!phase3JobId || !phase3ResearchComplete) {
      console.error('❌ Cannot export:', { phase3JobId, phase3ResearchComplete });
      alert(`Cannot generate report: ${!phase3JobId ? 'No Phase 3 Job ID' : 'Research not complete'}`);
      return;
    }
    try {
      // Call the lifecycle report endpoint
      const response = await fetch(`/api/phase3/reports/export/lifecycle-report-excel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId: phase3JobId,
          customerName: formData.customerName || 'Unknown Customer',
          eolYearBasis: 'lastDayOfSupport'
        })
      });
      
      if (!response.ok) {
        throw new Error('Lifecycle report generation failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lifecycle_report_${formData.customerName || 'export'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Lifecycle report generation failed:', error);
      alert('Lifecycle report generation failed. Please try again.');
    }
  };

  const handlePhaseClick = async (phaseId) => {
    // Lifecycle Report handling
    if (phaseId === 4) {
      if (!phase3ResearchComplete) {
        alert('Please complete Phase 3 research first');
        return;
      }
      
      if (!phase3JobId) {
        alert('Phase 3 Job ID not found. Please reinitialize Phase 3.');
        return;
      }
      
      // Set Phase 4 as active to display the report view
      setActivePhase(4);
      return;
    }

    // Phase 1 handling
    if (phaseId === 1) {
      if (!uploadedFile) {
        alert('Please upload a file first');
        return;
      }
      
      // If Phase 1 is already completed, just show the results
      if (completedPhases.includes(1)) {
        setActivePhase(1);
        return;
      }
      
      // Run Phase 1 analysis
      await runPhase1Analysis();
    } 
    // Phase 2 handling
    else if (phaseId === 2) {
      if (!completedPhases.includes(1)) {
        alert('Please complete Phase 1 first');
        return;
      }
      
      // Set Phase 2 as active
      setActivePhase(2);
      
      // Mark Phase 1 job for Phase 2 to use
      if (!completedPhases.includes(2)) {
        setPhase2JobId(analysisJobId);
      }
    } 
    // Phase 3 handling  
    else if (phaseId === 3) {
  if (!completedPhases.includes(1) && !completedPhases.includes(2)) {
    alert('Please complete Phase 1 or Phase 2 first');
    return;
  }
  
  // Phase 3 requires Phase 2 to mark data as ready
  if (!completedPhases.includes(2)) {
    alert('Please complete Phase 2 and click "Ready for Phase 3" first');
    return;
  }
  
  setActivePhase(3);
  setPhase3ResearchComplete(false); // Reset research completion status
  
  }

 };  

  const handleReset = () => {
    setActivePhase(null);
    setCompletedPhases([]);
    setUploadedFile(null);
    setFormData({ customerName: '' });
    setMobileMenuOpen(false);
    setAnalysisJobId(null);
    setAnalysisStatus('');
    setAnalysisError(null);
    setAnalysisResults(null);
    setDataRows(null);
    setPhase1Results(null);
    setPhase2JobId(null);
    setPhase3JobId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Phase1ResultsTable Component Definition
  const Phase1ResultsTable = ({ results, isLoadingResults }) => {
    if (!results) return null;

    const { products = [], summary = {} } = results.detailed || {};
    const analytics = results?.analytics || summary;
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    
    // SEARCH STATE
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState(products);
    
    // EXPORT STATE
    const [isExporting, setIsExporting] = useState(false);
    const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
    
    // Search effect
    React.useEffect(() => {
      if (searchTerm === '') {
        setSearchResults(products);
      } else {
        const filtered = products.filter(item => {
          const productId = (item.product_id || '').toLowerCase();
          const description = (item.description || '').toLowerCase();
          const search = searchTerm.toLowerCase();
          
          return productId.includes(search) || description.includes(search);
        });
        setSearchResults(filtered);
        setCurrentPage(1);
      }
    }, [searchTerm, products]);
    
    const totalItems = searchResults.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const currentItems = searchResults.slice(startIndex, endIndex);
    
    // EXPORT FUNCTIONS
    const exportToCSV = (data, filename) => {
      // Prepare CSV headers
      const headers = [
        'ID', 'Manufacturer', 'Category', 'Asset Type', 'Type', 
        'Product ID', 'Description', 'Ship Date', 'Quantity', 
        'Support Coverage', 'End of Sale', 'Last Support'
      ];
      
      // Convert data to CSV format
      const csvContent = [
        headers.join(','),
        ...data.map(item => [
          item.id || '',
          `"${(item.mfg || '-').replace(/"/g, '""')}"`,
          `"${(item.category || '-').replace(/"/g, '""')}"`,
          `"${(item.asset_type || '-').replace(/"/g, '""')}"`,
          `"${(item.type || '-').replace(/"/g, '""')}"`,
          `"${(item.product_id || '-').replace(/"/g, '""')}"`,
          `"${(item.description || '-').replace(/"/g, '""')}"`,
          item.ship_date || '-',
          item.qty || 0,
          item.support_coverage || '-',
          item.end_of_sale || '-',
          item.last_day_support || '-'
        ].join(','))
      ].join('\n');
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    
    const handleExportClick = (format, type = 'all') => {
      const dataToExport = type === 'filtered' ? searchResults : products;
      const filePrefix = type === 'filtered' ? 'phase1_filtered' : 'phase1_all';
      const filename = `${filePrefix}_${new Date().toISOString().split('T')[0]}.csv`;
      
      exportToCSV(dataToExport, filename);
      setExportDropdownOpen(false);
    };
    
    // Clear search function
    const clearSearch = () => {
      setSearchTerm('');
      setCurrentPage(1);
    };
    
    // Pagination functions
    const getPageNumbers = () => {
      const pages = [];
      const maxPagesToShow = 5;
      let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
      let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
      
      if (endPage - startPage < maxPagesToShow - 1) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      return pages;
    };
    
    const handleItemsPerPageChange = (newSize) => {
      setItemsPerPage(newSize);
      setCurrentPage(1);
    };
    
    const goToPage = (page) => {
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
      }
    };
    
    // Category Breakdown Component
    const CategoryBreakdown = ({ data, analytics }) => {
      const categoryData = React.useMemo(() => {
        if (analytics?.categories) {
          return Object.entries(analytics.categories)
            .map(([category, data]) => ({
              category,
              quantity: data.quantity || 0,
              count: data.count || 0
            }))
            .sort((a, b) => b.quantity - a.quantity);
        }
        
        const breakdown = {};
        data.forEach(item => {
          const cat = item.category || 'Uncategorized';
          if (!breakdown[cat]) {
            breakdown[cat] = { quantity: 0, count: 0 };
          }
          breakdown[cat].count++;
          breakdown[cat].quantity += parseInt(item.qty) || 0;
        });
        
        return Object.entries(breakdown)
          .map(([category, data]) => ({
            category,
            quantity: data.quantity,
            count: data.count
          }))
          .sort((a, b) => b.quantity - a.quantity);
      }, [data, analytics]);

      const totalQuantity = categoryData.reduce((sum, item) => sum + item.quantity, 0);

      return (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-bold uppercase mb-4" style={{ color: '#002D62' }}>
            CATEGORY BREAKDOWN - TOTAL QUANTITY
          </h3>
          
          <div className="space-y-3">
            {categoryData.map(({ category, quantity, count }) => (
              <div key={category} className="flex items-center">
                <div className="w-32 text-xs font-bold uppercase truncate pr-2" 
                     style={{ color: '#002D62' }}
                     title={category}>
                  {category}
                </div>
                
                <div className="flex-1">
                  <div className="w-full bg-gray-200 rounded-full h-8 relative">
                    <div 
                      className="h-8 rounded-full flex items-center justify-between px-3 transition-all"
                      style={{ 
                        width: totalQuantity > 0 ? `${(quantity / totalQuantity) * 100}%` : '0%',
                        backgroundColor: '#008080',
                        minWidth: quantity > 0 ? '60px' : '0'
                      }}
                    >
                      <span className="text-xs text-white font-bold">
                        {quantity.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-600">
              Total: {totalQuantity.toLocaleString()} units across all categories
            </p>
          </div>
        </div>
      );
    };

    // Manufacturer Breakdown Component
    const ManufacturerBreakdown = ({ data, analytics }) => {
      const manufacturerData = React.useMemo(() => {
        if (analytics?.manufacturerBreakdown || analytics?.manufacturers) {
          const mfgData = analytics.manufacturerBreakdown || analytics.manufacturers;
          return Object.entries(mfgData)
            .map(([manufacturer, data]) => ({
              manufacturer,
              quantity: data.quantity || 0,
              count: data.count || 0
            }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
        }
        
        const breakdown = {};
        data.forEach(item => {
          const mfg = item.mfg && item.mfg !== '-' ? item.mfg : 'Unknown';
          if (!breakdown[mfg]) {
            breakdown[mfg] = { quantity: 0, count: 0 };
          }
          breakdown[mfg].count++;
          breakdown[mfg].quantity += parseInt(item.qty) || 0;
        });
        
        return Object.entries(breakdown)
          .map(([manufacturer, data]) => ({
            manufacturer,
            quantity: data.quantity,
            count: data.count
          }))
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 10);
      }, [data, analytics]);

      const totalQuantity = manufacturerData.reduce((sum, item) => sum + item.quantity, 0);

      return (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-bold uppercase mb-4" style={{ color: '#002D62' }}>
            MANUFACTURER BREAKDOWN - TOP 10
          </h3>
          
          <div className="space-y-3">
            {manufacturerData.map(({ manufacturer, quantity, count }) => (
              <div key={manufacturer} className="flex items-center">
                <div className="w-32 text-xs font-bold uppercase truncate pr-2" 
                     style={{ color: '#002D62' }}
                     title={manufacturer}>
                  {manufacturer}
                </div>
                
                <div className="flex-1">
                  <div className="w-full bg-gray-200 rounded-full h-8 relative">
                    <div 
                      className="h-8 rounded-full flex items-center justify-between px-3 transition-all"
                      style={{ 
                        width: totalQuantity > 0 ? `${(quantity / totalQuantity) * 100}%` : '0%',
                        backgroundColor: '#008080',
                        minWidth: quantity > 0 ? '60px' : '0'
                      }}
                    >
                      <span className="text-xs text-white font-bold">
                        {quantity.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    };

    // Data Completeness Component
    const DataCompleteness = ({ data, analytics }) => {
      const fieldCompleteness = React.useMemo(() => {
        if (analytics?.completeness) {
          const filtered = {};
          Object.entries(analytics.completeness).forEach(([field, value]) => {
            if (field !== 'qty' && field !== 'total_value') {
              filtered[field] = value;
            }
          });
          return filtered;
        }
        
        const requiredFields = [
          'mfg', 
          'category', 
          'product_id', 
          'description', 
          'support_coverage', 
          'end_of_sale', 
          'last_day_support', 
          'asset_type', 
          'ship_date'
        ];
        
        const completeness = {};
        requiredFields.forEach(field => {
          const filled = data.filter(item => 
            item[field] && item[field] !== '-' && item[field] !== ''
          ).length;
          completeness[field] = Math.round((filled / data.length) * 100);
        });
        
        return completeness;
      }, [data, analytics]);

      const overallScore = Math.round(
        Object.values(fieldCompleteness).reduce((a, b) => a + b, 0) / 
        Object.keys(fieldCompleteness).length
      );

      const formatFieldName = (field) => {
        return field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      };

      return (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-bold uppercase mb-4" style={{ color: '#002D62' }}>
            DATA COMPLETENESS
          </h3>
          
          <div className="mb-4 p-4 rounded" style={{ backgroundColor: '#F9FAFB' }}>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold uppercase" style={{ color: '#002D62' }}>
                OVERALL SCORE
              </span>
              <span className="text-2xl font-bold" style={{ color: '#008080' }}>
                {overallScore}%
              </span>
            </div>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${overallScore}%`,
                  backgroundColor: '#008080'
                }}
              />
            </div>
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {Object.entries(fieldCompleteness).map(([field, percent]) => (
              <div 
                key={field} 
                className="flex justify-between items-center py-2 border-b" 
                style={{ borderColor: '#E5E7EB' }}
              >
                <span className="text-xs font-bold uppercase" style={{ color: '#002D62' }}>
                  {formatFieldName(field)}
                </span>
                <div className="flex items-center">
                  <div className="w-24 bg-gray-200 rounded-full h-1.5 mr-2">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${percent}%`,
                        backgroundColor: percent > 80 ? '#008080' : percent > 50 ? '#6B7280' : '#EF4444'
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium" style={{ color: '#6B7280' }}>
                    {percent}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    };

    // Lifecycle Status Component
    const LifecycleStatus = ({ data, analytics }) => {
      const lifecycleData = React.useMemo(() => {
        if (analytics?.lifecycle) {
          return Object.entries(analytics.lifecycle).map(([category, stats]) => ({
            category,
            totalQty: stats.totalQty || 0,
            endOfSale: stats.endOfSale || 0,
            endOfSWVuln: stats.endOfSWVuln || 0,
            lastDaySupport: stats.lastDaySupport || 0
          }));
        }
        
        const categories = {};
        const currentDate = new Date();
        
        data.forEach(item => {
          const cat = item.category || 'Uncategorized';
          if (!categories[cat]) {
            categories[cat] = {
              totalQty: 0,
              endOfSale: 0,
              endOfSWVuln: 0,
              lastDaySupport: 0
            };
          }
          
          categories[cat].totalQty += parseInt(item.qty) || 0;
          
          if (item.end_of_sale && item.end_of_sale !== '-') {
            try {
              const eosDate = new Date(item.end_of_sale);
              if (!isNaN(eosDate.getTime()) && eosDate <= currentDate) {
                categories[cat].endOfSale++;
              }
            } catch (e) {}
          }
          
          if (item.last_day_support && item.last_day_support !== '-') {
            try {
              const ldosDate = new Date(item.last_day_support);
              if (!isNaN(ldosDate.getTime()) && ldosDate <= currentDate) {
                categories[cat].lastDaySupport++;
              }
            } catch (e) {}
          }
        });
        
        return Object.entries(categories).map(([category, stats]) => ({
          category,
          totalQty: stats.totalQty,
          endOfSale: stats.endOfSale,
          endOfSWVuln: stats.endOfSWVuln,
          lastDaySupport: stats.lastDaySupport
        }));
      }, [data, analytics]);

      return (
        <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
          <h3 className="text-lg font-bold uppercase mb-4" style={{ color: '#002D62' }}>
            LIFECYCLE STATUS BY CATEGORY
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200" style={{ backgroundColor: '#F9FAFB' }}>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase" style={{ color: '#002D62' }}>
                    Category
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase" style={{ color: '#002D62' }}>
                    Total Qty
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase" style={{ color: '#002D62' }}>
                    End of Sale
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase" style={{ color: '#002D62' }}>
                    End of SW Vuln
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase" style={{ color: '#002D62' }}>
                    Last Day Support
                  </th>
                </tr>
              </thead>
              <tbody>
                {lifecycleData.map((row, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium" style={{ color: '#002D62' }}>
                      {row.category}
                    </td>
                    <td className="px-4 py-3 text-center font-medium">
                      {row.totalQty.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.endOfSale > 0 && (
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600 font-medium">
                          {row.endOfSale}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.endOfSWVuln > 0 && (
                        <span className="px-2 py-1 text-xs rounded-full font-medium"
                          style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                          {row.endOfSWVuln}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.lastDaySupport > 0 && (
                        <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 font-medium">
                          {row.lastDaySupport}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    };
    
    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">  {/* <- THIS WAS MISSING */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="text-xs font-bold uppercase mb-1" style={{ color: '#002D62' }}>
              TOTAL ITEMS
            </div>
            <div className="text-2xl font-bold" style={{ color: '#008080' }}>
              {summary.filtered_items || summary.total_items || 0}
            </div>
            {summary.original_items && (
              <div className="text-xs text-gray-500 mt-1">
                {summary.original_items} original
                <br />
                {summary.items_excluded} excluded
              </div>
            )}
          </div>
          
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="text-xs font-bold uppercase mb-1" style={{ color: '#002D62' }}>
              ACTIVE SUPPORT
            </div>
            <div className="text-2xl font-bold" style={{ color: '#008080' }}>
              {summary.active_support || 0}
            </div>
            <div className="text-xs" style={{ color: '#6B7280' }}>
              {summary.total_items > 0 ? Math.round((summary.active_support / summary.total_items) * 100) : 0}%
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="text-xs font-bold uppercase mb-1" style={{ color: '#002D62' }}>
              END OF SALE
            </div>
            <div className="text-2xl font-bold" style={{ color: '#008080' }}>
              {summary.total_end_of_sale || 0}
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="text-xs font-bold uppercase mb-1" style={{ color: '#002D62' }}>
              END OF SW VULN
            </div>
            <div className="text-2xl font-bold" style={{ color: '#008080' }}>
              {summary.total_end_of_sw_vuln || 0}
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="text-xs font-bold uppercase mb-1" style={{ color: '#002D62' }}>
              LAST DAY SUPPORT
            </div>
            <div className="text-2xl font-bold" style={{ color: '#008080' }}>
              {summary.total_last_day_support || 0}
            </div>
          </div>
        </div>
        
        {/* Analytics Components Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CategoryBreakdown data={products} analytics={analytics} />
          <ManufacturerBreakdown data={products} analytics={analytics} />
        </div>
        
        <div className="grid grid-cols-1 gap-6">
          <DataCompleteness data={products} analytics={analytics} />
        </div>
        
        <LifecycleStatus data={products} analytics={analytics} />

        {/* Data Table with Search and Export */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            {/* Header and Controls Row */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <h3 className="text-lg font-bold uppercase" style={{ color: '#002D62' }}>
                PHASE 1 - INVENTORY ANALYSIS
              </h3>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
                {/* Search Input */}
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search Product ID or Description..."
                    className="w-full px-3 py-2 pr-8 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:border-transparent"
                    style={{ focusRingColor: '#008080' }}
                  />
                  {searchTerm && (
                    <button
                      onClick={clearSearch}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label="Clear search"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                
                {/* Export Button Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: '#008080' }}
                  >
                    <Download size={16} />
                    {isExporting ? 'Exporting...' : 'Export'}
                  </button>
                  
                  {exportDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                      <div className="py-1">
                        <div className="px-4 py-2 text-xs font-bold uppercase border-b border-gray-200" 
                             style={{ color: '#002D62' }}>
                          Export Options
                        </div>
                        <button
                          onClick={() => handleExportClick('csv', 'all')}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Export All ({products.length} items)
                        </button>
                        {searchTerm && (
                          <button
                            onClick={() => handleExportClick('csv', 'filtered')}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            Export Filtered ({searchResults.length} items)
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Items per page selector */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold uppercase" style={{ color: '#002D62' }}>
                    Show:
                  </label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                    className="px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:border-transparent"
                    style={{ focusRingColor: '#008080' }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                  <span className="text-xs text-gray-600">per page</span>
                </div>
              </div>
            </div>
            
            {/* Search Results Count */}
            {searchTerm && (
              <div className="mt-3 text-sm" style={{ color: '#6B7280' }}>
                Found <span className="font-bold" style={{ color: '#002D62' }}>{searchResults.length}</span> items matching "{searchTerm}"
              </div>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200" style={{ backgroundColor: '#F9FAFB' }}>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase" style={{ color: '#002D62' }}>
                    Mfg
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase" style={{ color: '#002D62' }}>
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase" style={{ color: '#002D62' }}>
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase" style={{ color: '#002D62' }}>
                    Product ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase" style={{ color: '#002D62' }}>
                    Description
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase" style={{ color: '#002D62' }}>
                    Qty
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase" style={{ color: '#002D62' }}>
                    Support
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase" style={{ color: '#002D62' }}>
                    End of Sale
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase" style={{ color: '#002D62' }}>
                    Last Support
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length > 0 ? (
                  currentItems.map((product, index) => (
                    <tr key={startIndex + index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {product.mfg || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {product.category || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {product.type || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {product.product_id || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {product.description || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-center font-medium text-gray-900">
                        {product.qty || 0}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          product.support_coverage === 'Active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {product.support_coverage || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-700">
                        {product.end_of_sale || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-700">
                        {product.last_day_support || '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="px-6 py-8 text-center text-sm text-gray-500">
                      {isLoadingResults ? 'Loading results...' : 
                       searchTerm ? 'No items match your search criteria' : 'No data available'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {searchResults.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200" style={{ backgroundColor: '#F9FAFB' }}>
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-sm text-gray-600">
                  Showing {startIndex + 1}-{endIndex} of {totalItems} {searchTerm ? 'filtered' : ''} items
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 text-sm rounded transition-all ${
                      currentPage === 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                    aria-label="Previous page"
                  >
                    Previous
                  </button>
                  
                  {currentPage > 3 && totalPages > 5 && (
                    <>
                      <button
                        onClick={() => goToPage(1)}
                        className="px-3 py-1 text-sm rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all"
                        aria-label="Go to page 1"
                      >
                        1
                      </button>
                      {currentPage > 4 && <span className="text-gray-400">...</span>}
                    </>
                  )}
                  
                  {getPageNumbers().map((page) => (
                    <button
                      key={page}
                      onClick={() => goToPage(page)}
                      className={`px-3 py-1 text-sm rounded transition-all ${
                        page === currentPage
                          ? 'text-white shadow-sm'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                      style={page === currentPage ? { backgroundColor: '#008080' } : {}}
                      aria-label={`Go to page ${page}`}
                      aria-current={page === currentPage ? 'page' : undefined}
                    >
                      {page}
                    </button>
                  ))}
                  
                  {currentPage < totalPages - 2 && totalPages > 5 && (
                    <>
                      {currentPage < totalPages - 3 && <span className="text-gray-400">...</span>}
                      <button
                        onClick={() => goToPage(totalPages)}
                        className="px-3 py-1 text-sm rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all"
                        aria-label={`Go to page ${totalPages}`}
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                  
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 text-sm rounded transition-all ${
                      currentPage === totalPages
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                    aria-label="Next page"
                  >
                    Next
                  </button>
                </div>
                
                <div className="text-sm font-medium" style={{ color: '#002D62' }}>
                  Total Quantity: {(summary.total_quantity || 0).toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }; // Closes Phase1ResultsTable component

  // Main component return
  return (
    <div className="min-h-screen flex flex-col bg-gray-50" style={{ backgroundColor: '#F8F8F8' }}>
      {/* Header - Sticky Navigation */}
      <header className="sticky top-0 z-50 shadow-md" style={{ backgroundColor: '#002D62' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-white font-bold text-xl uppercase tracking-wide">
                Life Cycle Analysis
              </h1>
            </div>

            <nav className="hidden md:flex items-center space-x-8">
              <a href="/lifecycle" className="text-white hover:text-gray-200 transition-colors border-b-2" style={{ borderColor: '#008080' }}>
                Lifecycle
              </a>
              <a href="/docs" className="text-white hover:text-gray-200 transition-colors border-b-2 border-transparent hover:border-gray-400">
                Docs
              </a>
              <a href="/support" className="text-white hover:text-gray-200 transition-colors border-b-2 border-transparent hover:border-gray-400">
                Support
              </a>
              <a href="/pricing" className="text-white hover:text-gray-200 transition-colors border-b-2 border-transparent hover:border-gray-400">
                Pricing
              </a>
            </nav>

            <div className="hidden md:flex items-center space-x-4">
              {completedPhases.length > 0 && (
                <button 
                  onClick={handleReset}
                  className="px-4 py-2 text-red-400 hover:text-red-300 transition-colors text-sm"
                  aria-label="Reset analysis"
                >
                  Reset
                </button>
              )}
              <button 
                className="px-4 py-2 border-2 text-white hover:bg-white hover:bg-opacity-10 transition-all transform hover:scale-105"
                style={{ borderColor: '#008080' }}
              >
                Contact
              </button>
              <button 
                className="px-4 py-2 text-white transition-all transform hover:scale-105 hover:shadow-lg"
                style={{ backgroundColor: '#008080' }}
              >
                Get Started
              </button>
            </div>

            <button
              className="md:hidden text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-700">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <a href="/lifecycle" className="block px-3 py-2 text-white hover:bg-gray-700 rounded">Lifecycle</a>
              <a href="/docs" className="block px-3 py-2 text-white hover:bg-gray-700 rounded">Docs</a>
              <a href="/support" className="block px-3 py-2 text-white hover:bg-gray-700 rounded">Support</a>
              <a href="/pricing" className="block px-3 py-2 text-white hover:bg-gray-700 rounded">Pricing</a>
              <div className="border-t border-gray-700 mt-2 pt-2">
                <button 
                  onClick={handleReset}
                  className="block w-full text-left px-3 py-2 text-red-400 hover:bg-gray-700 rounded"
                >
                  Reset Analysis
                </button>
              </div>
              <div className="flex space-x-2 px-3 py-2">
                <button className="flex-1 px-4 py-2 border-2 text-white" style={{ borderColor: '#008080' }}>
                  Contact
                </button>
                <button className="flex-1 px-4 py-2 text-white" style={{ backgroundColor: '#008080' }}>
                  Get Started
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-rows-1 lg:grid-rows-[auto_1fr] gap-4 min-h-[calc(100vh-9rem)]">
          {/* Input Section */}
          <section className="bg-white rounded-lg shadow-sm">
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: '#002D62' }}>
                  Data File *
                </label>
                <div 
                  className={`relative border rounded-lg transition-all cursor-pointer group ${
                    isDragging ? 'border-2 shadow-lg' : 'border'
                  } ${uploadedFile ? 'bg-teal-50 border-teal-500' : 'bg-white hover:bg-gray-50'}`}
                  style={{ 
                    borderColor: isDragging ? '#008080' : uploadedFile ? '#008080' : '#e5e7eb'
                  }}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  aria-label="File upload - click or drag to upload CSV or XLSX file"
                >
                  <div className="flex items-center px-4 py-3">
                    <div className="flex-shrink-0">
                      {uploadedFile ? (
                        <CheckCircle size={20} style={{ color: '#008080' }} />
                      ) : (
                        <Upload size={20} className="text-gray-400 group-hover:text-gray-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 ml-3">
                      <p className="text-sm font-medium" style={{ color: uploadedFile ? '#008080' : '#002D62' }}>
                        {uploadedFile ? uploadedFile.name : 'Choose file or drag here'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {uploadedFile ? `${(uploadedFile.size / 1024).toFixed(1)} KB` : 'CSV, XLSX, or XLSB up to 10MB'}
                      </p>
                    </div>
                    {uploadedFile && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadedFile(null);
                          setCompletedPhases([]);
                          setActivePhase(null);
                          setAnalysisResults(null);
                          setAnalysisJobId(null);
                          setDataRows(null);
                        }}
                        className="flex-shrink-0 ml-2 text-gray-400 hover:text-red-500 transition-colors"
                        aria-label="Remove file"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xlsb"
                    onChange={handleFileSelect}
                    className="hidden"
                    aria-label="File input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="customerName" className="block text-xs font-bold uppercase mb-2" style={{ color: '#002D62' }}>
                    Customer Name *
                  </label>
                  <input
                    id="customerName"
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    placeholder="Enter customer organization name"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                    required
                    aria-required="true"
                  />
                  {/* Phase 1 Exclusion Filters */}
                  <Phase1FilterPanel 
                    onFilterChange={handleFilterChange}
                    currentFilterId={selectedFilterId}
                    uploadedFile={uploadedFile}
                  />
                  {uploadedFile && completedPhases.length === 0 && !isAnalyzing && (
                    <p className="text-xs text-teal-600 mt-1" role="status">
                      Ready! Click Phase 1 below to start analysis
                    </p>
                  )}
                  {isAnalyzing && (
                    <p className="text-xs text-teal-600 mt-1" role="status">
                      {analysisStatus}
                    </p>
                  )}
                  {analysisError && (
                    <p className="text-xs text-red-600 mt-1" role="alert">
                      {analysisError}
                    </p>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      isAnalyzing ? 'bg-yellow-100 text-yellow-700' :
                      completedPhases.length > 0 ? 'bg-green-100 text-green-700' : 
                      uploadedFile ? 'bg-yellow-100 text-yellow-700' : 
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {isAnalyzing ? 'Processing' : completedPhases.length > 0 ? 'Complete' : uploadedFile ? 'Ready' : 'Waiting'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-xs text-gray-500">File Status</p>
                      <p className="text-sm font-semibold" style={{ color: uploadedFile ? '#008080' : '#999' }}>
                        {uploadedFile ? '✓ Loaded' : 'Empty'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Data Rows</p>
                      <p className="text-sm font-semibold" style={{ color: uploadedFile ? '#002D62' : '#999' }}>
                        {dataRows || (uploadedFile ? '✓' : '✓')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Phases Done</p>
                      <p className="text-sm font-semibold" style={{ color: completedPhases.length > 0 ? '#002D62' : '#999' }}>
                        {completedPhases.length > 0 ? `${completedPhases.length}/3` : '✓'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Results Section */}
          <section className="bg-white rounded-lg shadow-sm">
            <div className="p-6">
              <h2 className="text-lg font-bold uppercase mb-4" style={{ color: '#002D62' }}>
                Analysis
              </h2>

              <div className="flex flex-wrap gap-2 mb-4">
                {phases.map((phase) => {
                  const Icon = phase.icon;
                  const isActive = phase.id === activePhase;
                  const isCompleted = completedPhases.includes(phase.id);
                  const canRun = uploadedFile && formData.customerName && 
                                 (phase.id === 1 || completedPhases.includes(phase.id - 1));
                  const isExport = phase.id === 4;
                  
                  return (
                    <button
                      key={phase.id}
                      onClick={() => handlePhaseClick(phase.id)}
                      className={`flex items-center px-4 py-2 rounded-full transition-all ${
                        isExport 
                          ? phase3ResearchComplete
                            ? 'text-white hover:opacity-90 shadow-md' 
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                          : isActive 
                            ? 'text-white shadow-md transform scale-105' 
                            : isCompleted
                              ? 'bg-teal-100 text-teal-800 hover:bg-teal-200'
                              : canRun
                                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md font-medium'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                      }`}
                      style={{ 
                        backgroundColor: isExport 
                          ? phase3ResearchComplete ? '#002D62' : undefined 
                          : isActive ? '#008080' : undefined,
                        color: (isExport && phase3ResearchComplete) || isActive ? 'white' : undefined
                      }}
                      disabled={isAnalyzing || (isExport ? !phase3ResearchComplete : (!uploadedFile || !formData.customerName || (phase.id > 1 && !completedPhases.includes(phase.id - 1))))}
                      aria-pressed={isActive && !isExport ? 'true' : undefined}
                      aria-label={`${phase.name} ${
                        isActive && !isExport ? '(active)' : 
                        isCompleted ? '(completed)' : 
                        canRun && !isExport ? '(ready to run)' : 
                        isExport && phase3ResearchComplete ? '(ready)' : 
                        ''
                      }`}
                      title={
                        isExport && !phase3ResearchComplete
                          ? 'Complete Phase 3 AI Research before generating lifecycle report'
                          : !canRun && !isExport 
                            ? phase.id === 1 
                              ? 'Upload file and enter customer name first' 
                              : `Complete Phase ${phase.id - 1} first`
                            : undefined
                      }
                    >
                      <Icon size={16} className="mr-2" />
                      {phase.name}
                      {isCompleted && !isExport && !isActive && (
                        <CheckCircle size={14} className="ml-1" />
                      )}
                    </button>
                  );
                })}
              </div>

              {activePhase ? (
                <>
                  {/* Analysis Results Cards - Only show for Phase 1 */}
                  {/* Filter Statistics Display - Add this BEFORE line 1593 */}
                  {analysisResults?.summary?.appliedFilter && activePhase === 1 && (
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start space-x-3">
                        <Filter className="h-5 w-5 text-blue-500 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-bold text-[#002D62] uppercase">
                            FILTER APPLIED: {analysisResults.summary.appliedFilter.name}
                          </h4>
                          <p className="text-xs text-gray-600 mt-1">
                            {analysisResults.summary.appliedFilter.description}
                          </p>
                          {analysisResults?.summary?.filterStats && (
                            <div className="mt-2 grid grid-cols-3 gap-4 text-xs">
                              <div>
                                <span className="font-semibold">Original Items:</span> {analysisResults.summary.filterStats.originalCount}
                              </div>
                              <div>
                                <span className="font-semibold">After Filter:</span> {analysisResults.summary.filterStats.filteredCount}
                              </div>
                              <div>
                                <span className="font-semibold">Excluded:</span> {analysisResults.summary.filterStats.excludedCount} ({analysisResults.summary.filterStats.excludedPercentage}%)
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Analysis Results Cards - Only show for Phase 1 (existing code) */}
                  {analysisResults && activePhase === 1 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      {analysisResults.opportunities && (
                        <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center mb-3">
                            <Lightbulb size={24} style={{ color: '#008080' }} />
                            <h3 className="ml-2 font-bold uppercase" style={{ color: '#002D62' }}>
                              Opportunities
                            </h3>
                          </div>
                          <ul className="space-y-2">
                            {analysisResults.opportunities.map((item, index) => (
                              <li key={index} className="text-sm text-gray-700 flex items-start">
                                <span className="mr-2" style={{ color: '#008080' }}>•</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {analysisResults.risks && (
                        <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center mb-3">
                            <AlertCircle size={24} style={{ color: '#008080' }} />
                            <h3 className="ml-2 font-bold uppercase" style={{ color: '#002D62' }}>
                              Risks
                            </h3>
                          </div>
                          <ul className="space-y-2">
                            {analysisResults.risks.map((item, index) => (
                              <li key={index} className="text-sm text-gray-700 flex items-start">
                                <span className="mr-2" style={{ color: '#008080' }}>•</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {analysisResults.findings && (
                        <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center mb-3">
                            <Shield size={24} style={{ color: '#008080' }} />
                            <h3 className="ml-2 font-bold uppercase" style={{ color: '#002D62' }}>
                              Key Findings
                            </h3>
                          </div>
                          <ul className="space-y-2">
                            {analysisResults.findings.map((item, index) => (
                              <li key={index} className="text-sm text-gray-700 flex items-start">
                                <span className="mr-2" style={{ color: '#008080' }}>•</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Phase-specific content */}
                  {activePhase === 1 ? (
                    // Phase 1 Results
                    <div className="border rounded-lg p-6" style={{ backgroundColor: '#F8F8F8' }}>
                      <h3 className="text-lg font-bold uppercase mb-4" style={{ color: '#002D62' }}>
                        PHASE 1 ANALYTICS VISUALIZATION
                      </h3>
                      
                      {isAnalyzing ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200" 
                               style={{ borderTopColor: '#008080' }}></div>
                          <p className="mt-4 text-sm text-gray-600">Processing your data...</p>
                        </div>
                      ) : phase1Results ? (
                        <Phase1ResultsTable results={phase1Results} isLoadingResults={isLoadingResults} />
                      ) : (
                        <div className="text-center py-12 text-gray-500">
                          <FileText size={48} className="mx-auto mb-4 opacity-50" />
                          <p>Run Phase 1 analysis to see results here</p>
                        </div>
                      )}
                    </div>
                  ) : activePhase === 2 ? (
                    // Phase 2 Results
                    <div className="border rounded-lg p-6" style={{ backgroundColor: '#F8F8F8' }}>
                      <Phase2Results 
                        phase1JobId={analysisJobId}
                        isActive={activePhase === 2}
                        onComplete={(phase2JobId) => {  // Receive phase2JobId as parameter
                          // Mark Phase 2 as complete and enable Phase 3
                          setCompletedPhases(prev => {
                            if (!prev.includes(2)) {
                              return [...prev, 2];
                            }
                            return prev;
                          });
                          // Keep Phase 2 job ID for Phase 3 (not analysisJobId!)
                          setPhase2JobId(phase2JobId);  // Use the passed phase2JobId
                        }}
                      />
                    </div>
                  ) : activePhase === 3 ? (
                    // Phase 3 - AI Lifecycle Research
                    <Phase3Results 
                      phase2JobId={phase2JobId}
                      phase3JobId={phase3JobId}
                      customerName={formData.customerName} 
                      isActive={activePhase === 3}
                      onComplete={() => {
                        setCompletedPhases(prev => {
                          if (!prev.includes(3)) {
                            return [...prev, 3];
                          }
                          return prev;
                        });
                      }}
                      onPhase3Initialize={(jobId) => {
                        console.log('📍 Phase 3 initialized with jobId:', jobId);
                        setPhase3JobId(jobId);
                      }}
                      onResearchComplete={() => {
                        console.log('✅ Research complete callback triggered');
                        setPhase3ResearchComplete(true);
                      }}
                    />
                  ) : activePhase === 4 ? (
                    // Lifecycle Report Display
                    <LifecycleReportView 
                      phase3JobId={phase3JobId}
                      customerName={formData.customerName}
                      onExport={handleExport}
                    />
                  ) : null}
                </>
              ) : (
                // No analysis results yet
                <div className="flex items-center justify-center h-48 border-2 border-dashed border-gray-200 rounded-lg">
                  <div className="text-center">
                    <FileText size={48} className="mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600 mb-2">No analysis results yet</p>
                    <p className="text-sm text-gray-500">
                      {!uploadedFile 
                        ? 'Upload a file to begin'
                        : 'Click a Phase button above to run analysis'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-4" style={{ backgroundColor: '#002D62' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center text-white text-xs">
            <span className="mb-2 sm:mb-0">© Positive Impact Technology™</span>
            <nav className="flex items-center space-x-2">
              <a href="/privacy" className="hover:text-gray-300 transition-colors text-sm">Privacy</a>
              <span className="text-gray-400">|</span>
              <a href="/about" className="hover:text-gray-300 transition-colors text-sm">About</a>
              <span className="text-gray-400">|</span>
              <a href="/support" className="hover:text-gray-300 transition-colors text-sm">Support</a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LifecyclePage;