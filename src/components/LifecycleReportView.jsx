import React, { useState, useEffect } from 'react';
import { 
  Download, FileText, BarChart2, AlertTriangle, Clock, 
  Shield, Package, Factory, CheckCircle, TrendingUp,
  ChevronRight, Loader, AlertCircle, Info
} from 'lucide-react';

const LifecycleReportView = ({ phase3JobId, customerName, onExport }) => {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('detailed');
  const [generatingExcel, setGeneratingExcel] = useState(false);

  // Tab definitions matching Excel sheets
  const tabs = [
    { id: 'detailed', name: 'Detailed Analysis', icon: BarChart2 },
    { id: 'timeline', name: 'Lifecycle Timeline', icon: Clock },
    { id: 'eol', name: 'EOL Products', icon: AlertCircle },
    { id: 'category', name: 'Category Analysis', icon: Package },
    { id: 'manufacturer', name: 'Manufacturer Analysis', icon: Factory },
  ];

  useEffect(() => {
    fetchReportData();
  }, [phase3JobId]);

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/phase3/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: phase3JobId,
          eolYearBasis: 'lastDayOfSupport',
          customerName: customerName || 'Organization'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

    const data = await response.json();

    // Detailed debug logging
    console.log('=== BACKEND RESPONSE STRUCTURE ===');
    console.log('Full response:', data);
    console.log('Has success?', data.success);
    console.log('Has report?', !!data.report);

    if (data.report) {
    console.log('Report keys:', Object.keys(data.report));
    console.log('Has statistics?', !!data.report.statistics);
    console.log('Has products?', !!data.report.products);
    
    if (data.report.statistics) {
        console.log('Statistics keys:', Object.keys(data.report.statistics));
        console.log('Has riskDistribution?', !!data.report.statistics.riskDistribution);
        
        if (data.report.statistics.riskDistribution) {
        console.log('Risk Distribution:', data.report.statistics.riskDistribution);
        }
    }
    }

    // If there's an error in the response, show it
    if (!data.success) {
    console.error('Backend returned error:', data.error, data.details);
    setError(data.error || 'Backend error');
    return;
    }

    // Extract the report data from the wrapped response
    if (data.success && data.report) {
    setReportData(data.report);
    } else {
    console.error('Unexpected response format');
    setError('Invalid response format from server');
    }

    } catch (err) {
      console.error('Error fetching report:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExcelDownload = async () => {
    setGeneratingExcel(true);
    try {
      await onExport();
    } finally {
      setGeneratingExcel(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader className="animate-spin h-12 w-12 mx-auto mb-4" style={{ color: '#008080' }} />
          <p className="text-gray-600">Generating Lifecycle Report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <AlertCircle className="text-red-500 mr-3" size={24} />
          <div>
            <h3 className="text-red-800 font-bold">Error Loading Report</h3>
            <p className="text-red-600">{error}</p>
            <button 
              onClick={fetchReportData}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return <div>No report data available</div>;
  }

  const { statistics, products, insights, recommendations } = reportData;

  return (
    <div className="h-full flex flex-col">
      {/* Header with Download Button */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: '#002D62' }}>
            Lifecycle Analysis Report
          </h2>
          <p className="text-gray-600 mt-1">
            {customerName || 'Organization'} - Generated {new Date().toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={handleExcelDownload}
          disabled={generatingExcel}
          className="flex items-center px-6 py-3 rounded-lg font-medium transition-all"
          style={{
            backgroundColor: generatingExcel ? '#6B7280' : '#008080',
            color: 'white',
            cursor: generatingExcel ? 'not-allowed' : 'pointer'
          }}
        >
          {generatingExcel ? (
            <>
              <Loader className="animate-spin mr-2" size={20} />
              Generating Excel...
            </>
          ) : (
            <>
              <Download className="mr-2" size={20} />
              Download Excel Report
            </>
          )}
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b mb-4 overflow-x-auto">
        <nav className="flex space-x-6 min-w-max">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center px-3 py-3 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab.id 
                  ? 'border-teal-500 text-teal-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              <tab.icon size={18} className="mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {activeTab === 'detailed' && <DetailedAnalysisTab products={products} />}
          {activeTab === 'timeline' && <TimelineTab products={products} statistics={statistics} />}
          {activeTab === 'eol' && <EOLProductsTab products={products} />}
          {activeTab === 'category' && <CategoryAnalysisTab statistics={statistics} />}
          {activeTab === 'manufacturer' && <ManufacturerAnalysisTab statistics={statistics} />}
        </div>
      </div>
    </div>
  );
};

// Tab Components

// ============================================
// PRESERVED BUT UNUSED TAB COMPONENTS
// The following 4 components are preserved but not displayed:
// - ExecutiveSummaryTab
// - RiskAssessmentTab  
// - DataQualityTab
// - RecommendationsTab
// They have been removed from the UI but kept in code for potential future restoration
// ============================================

const ExecutiveSummaryTab = ({ statistics = {}, insights = [] }) => {
  const formatNumber = (num) => {
    if (!num) return 0;
    return num.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard 
          label="Total Products" 
          value={formatNumber(statistics.totalProducts)} 
        />
        <MetricCard 
          label="Total Quantity" 
          value={formatNumber(statistics.totalQuantity)} 
        />
        <MetricCard 
          label="Critical Risk" 
          value={formatNumber(statistics.criticalRiskCount)} 
          alert={true} 
        />
        <MetricCard 
          label="Data Quality Score" 
          value={`${statistics.dataQualityScore || 0}/100`} 
        />
      </div>

      {/* Risk Summary */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-bold mb-4" style={{ color: '#002D62' }}>Risk Overview</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-600 mb-2">Products by Risk Level</p>
            <div className="space-y-2">
              <RiskBar 
                level="Critical" 
                count={statistics.criticalRiskCount || 0} 
                percentage={statistics.criticalRiskPercentage || 0} 
                color="#DC3545" 
              />
              <RiskBar 
                level="High" 
                count={statistics.highRiskCount || 0} 
                percentage={statistics.highRiskPercentage || 0} 
                color="#FD7E14" 
              />
              <RiskBar 
                level="Medium" 
                count={statistics.mediumRiskCount || 0} 
                percentage={statistics.mediumRiskPercentage || 0} 
                color="#FFC107" 
              />
              <RiskBar 
                level="Low" 
                count={statistics.lowRiskCount || 0} 
                percentage={statistics.lowRiskPercentage || 0} 
                color="#28A745" 
              />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">Key Insights</p>
            <div className="space-y-2">
              {insights?.slice(0, 3).map((insight, index) => (
                <InsightCard key={index} insight={insight} />
              )) || <p className="text-gray-500">No insights available</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DetailedAnalysisTab = ({ products }) => (
  <div className="bg-white rounded-lg border">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product ID</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Manufacturer</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">EOL Date</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {products?.slice(0, 50).map((product, index) => (
            <tr key={index} className="hover:bg-gray-50">
              <td className="px-6 py-4 text-sm font-medium">{product.product_id}</td>
              <td className="px-6 py-4 text-sm">{product.description}</td>
              <td className="px-6 py-4 text-sm">{product.manufacturer}</td>
              <td className="px-6 py-4 text-sm">{product.product_category}</td>
              <td className="px-6 py-4 text-sm">{product.total_quantity}</td>
              <td className="px-6 py-4 text-sm">
                {product.last_day_of_support_date ? 
                  new Date(product.last_day_of_support_date).toLocaleDateString() : 'N/A'}
              </td>
              <td className="px-6 py-4">
                <RiskBadge level={product.risk_level} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const RiskAssessmentTab = ({ statistics = {}, products = [] }) => (
  <div className="space-y-6">
    {/* Risk Distribution */}
    <div className="bg-white rounded-lg border p-6">
      <h3 className="text-lg font-bold mb-4" style={{ color: '#002D62' }}>Risk Distribution</h3>
      <div className="space-y-3">
        <RiskBar 
          level="Critical" 
          count={statistics.criticalRiskCount || 0} 
          percentage={statistics.criticalRiskPercentage || 0} 
          color="#DC3545" 
        />
        <RiskBar 
          level="High" 
          count={statistics.highRiskCount || 0} 
          percentage={statistics.highRiskPercentage || 0} 
          color="#FD7E14" 
        />
        <RiskBar 
          level="Medium" 
          count={statistics.mediumRiskCount || 0} 
          percentage={statistics.mediumRiskPercentage || 0} 
          color="#FFC107" 
        />
        <RiskBar 
          level="Low" 
          count={statistics.lowRiskCount || 0} 
          percentage={statistics.lowRiskPercentage || 0} 
          color="#28A745" 
        />
      </div>
    </div>

    {/* Lifecycle Status */}
    <div className="bg-white rounded-lg border p-6">
      <h3 className="text-lg font-bold mb-4" style={{ color: '#002D62' }}>Lifecycle Status</h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-4 bg-green-50 rounded">
          <p className="text-sm text-gray-600">Current</p>
          <p className="text-2xl font-bold text-green-700">{statistics.currentCount || 0}</p>
        </div>
        <div className="text-center p-4 bg-yellow-50 rounded">
          <p className="text-sm text-gray-600">Approaching EOL</p>
          <p className="text-2xl font-bold text-yellow-700">{statistics.approachingEOLCount || 0}</p>
        </div>
        <div className="text-center p-4 bg-red-50 rounded">
          <p className="text-sm text-gray-600">End of Life</p>
          <p className="text-2xl font-bold text-red-700">{statistics.eolCount || 0}</p>
        </div>
      </div>
    </div>

    {/* Critical Products Table - Use products directly */}
    {products && products.filter(p => p.risk_level === 'critical').length > 0 && (
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-bold mb-4" style={{ color: '#002D62' }}>
          Critical Products Requiring Immediate Attention
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days to EOL</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.filter(p => p.risk_level === 'critical').slice(0, 10).map((product, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium">{product.product_id}</td>
                  <td className="px-4 py-3 text-sm">{product.description}</td>
                  <td className="px-4 py-3 text-sm">{product.total_quantity}</td>
                  <td className="px-4 py-3 text-sm text-red-600 font-medium">
                    {product.days_until_ldos || 'EOL'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="text-red-600 font-medium">Replace Immediately</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>
);

const TimelineTab = ({ products = [], statistics = {} }) => {
  console.log('TimelineTab received:', { 
    productCount: products.length,
    firstProduct: products[0] 
  });

  if (!products || products.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No products available for timeline view
      </div>
    );
  }
  
  // ============ DATE RANGE LOGIC - MUST BE AT TOP ============
  // Determine the dynamic date range based on data
  const currentYear = new Date().getFullYear();
  let dataMinYear = currentYear;
  let dataMaxYear = currentYear;
  
  products.forEach(product => {
    // Check purchase years from year_quantities
    if (product.year_quantities) {
      Object.keys(product.year_quantities).forEach(yearStr => {
        const year = parseInt(yearStr);
        if (!isNaN(year) && product.year_quantities[yearStr] > 0) {
          dataMinYear = Math.min(dataMinYear, year);
          dataMaxYear = Math.max(dataMaxYear, year);
        }
      });
    }
    
    // Check LDOS year
    if (product.last_day_of_support_date) {
      const ldosYear = new Date(product.last_day_of_support_date).getFullYear();
      if (!isNaN(ldosYear)) {
        dataMaxYear = Math.max(dataMaxYear, ldosYear);
      }
    }
    
    if (product.end_of_sale_date) {
      const eosYear = new Date(product.end_of_sale_date).getFullYear();
      if (!isNaN(eosYear)) {
        dataMinYear = Math.min(dataMinYear, eosYear);
      }
    }
  });
  
  // Apply business rules
  const minYear = Math.min(dataMinYear, currentYear - 10);
  const maxYear = Math.max(dataMaxYear + 2, currentYear + 5);
  
  // Build year columns array
  const yearColumns = [];
  for (let year = minYear; year <= maxYear; year++) {
    yearColumns.push(year);
  }
  
  // Update the header to show the dynamic range
  const headerText = dataMinYear < currentYear - 10 
    ? `Lifecycle Timeline (${minYear} - ${maxYear}) - Showing from First Purchase`
    : `Lifecycle Timeline (${minYear} - ${maxYear})`;
  
  console.log('Timeline range:', {
    dataMinYear,
    dataMaxYear,
    displayMinYear: minYear,
    displayMaxYear: maxYear,
    totalYears: yearColumns.length
  });
  
  // ============ HELPER FUNCTIONS - MUST BE BEFORE RETURN ============
  
  // Helper function to format LDOS date with month abbreviation
  const formatLDOSInYear = (ldosDate, year) => {
    if (!ldosDate) return '';
    const date = new Date(ldosDate);
    if (date.getFullYear() === year) {
      const monthName = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      const day = date.getDate();
      return `${monthName} ${day}`;
    }
    return '';
  };
  
  // Helper to get cell background color based on lifecycle status
  const getCellColor = (product, year) => {
    const ldosYear = product.last_day_of_support_date ? 
      new Date(product.last_day_of_support_date).getFullYear() : null;
    const eosYear = product.end_of_sale_date ? 
      new Date(product.end_of_sale_date).getFullYear() : null;
    
    if (ldosYear && year >= ldosYear) {
      return '#FFEBEE'; // Light red for EOL
    } else if (eosYear && year >= eosYear) {
      return '#FFF9C4'; // Light yellow for EOS
    }
    return 'transparent';
  };
  
  // Style for table cells with light gray borders
  const cellStyle = {
    border: '1px solid #D3D3D3',
    padding: '8px',
    fontSize: '12px',
    whiteSpace: 'nowrap'
  };
  
  const headerStyle = {
    ...cellStyle,
    backgroundColor: '#002D62',
    color: 'white',
    fontWeight: 'bold',
    position: 'sticky',
    top: 0,
    zIndex: 10
  };
  
  const fixedColumnStyle = {
    ...cellStyle,
    position: 'sticky',
    backgroundColor: 'white',
    zIndex: 5
  };
  
  // ============ MAIN RENDER - MUST BE LAST ============
  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 border-b">
        <h3 className="text-lg font-bold" style={{ color: '#002D62' }}>
          {headerText}
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Product lifecycle timeline with yearly quantity distribution
        </p>
      </div>
      
      {/* Scrollable container */}
      <div className="overflow-auto" style={{ maxHeight: '600px' }}>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {/* Fixed columns headers */}
              <th style={{ ...headerStyle, left: 0, minWidth: '150px' }}>
                Manufacturer
              </th>
              <th style={{ ...headerStyle, left: '150px', minWidth: '150px' }}>
                Category
              </th>
              <th style={{ ...headerStyle, left: '300px', minWidth: '120px' }}>
                Product ID
              </th>
              <th style={{ ...headerStyle, minWidth: '250px' }}>
                Description
              </th>
              <th style={{ ...headerStyle, minWidth: '80px', textAlign: 'right' }}>
                Total Qty
              </th>
              <th style={{ ...headerStyle, minWidth: '80px', textAlign: 'center' }}>
                EOS Year
              </th>
              <th style={{ ...headerStyle, minWidth: '80px', textAlign: 'center' }}>
                LDOS Year
              </th>
              
              {/* Year columns */}
              {yearColumns.map(year => (
                <th 
                  key={year} 
                  style={{ 
                    ...headerStyle, 
                    minWidth: '80px', 
                    textAlign: 'center',
                    backgroundColor: year === currentYear ? '#004D8C' : '#002D62'
                  }}
                >
                  {year}
                  {year === currentYear && (
                    <div style={{ fontSize: '10px', fontWeight: 'normal' }}>
                      (Current)
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          
          <tbody>
            {products.map((product, index) => {
              const eosYear = product.end_of_sale_date ? 
                new Date(product.end_of_sale_date).getFullYear() : '';
              const ldosYear = product.last_day_of_support_date ? 
                new Date(product.last_day_of_support_date).getFullYear() : '';
              
              return (
                <tr key={`${product.product_id}-${index}`}>
                  {/* Fixed columns */}
                  <td style={{ 
                    ...fixedColumnStyle, 
                    left: 0,
                    backgroundColor: index % 2 === 0 ? 'white' : '#F9F9F9'
                  }}>
                    {product.manufacturer || '-'}
                  </td>
                  <td style={{ 
                    ...fixedColumnStyle, 
                    left: '150px',
                    backgroundColor: index % 2 === 0 ? 'white' : '#F9F9F9'
                  }}>
                    {product.product_category || '-'}
                  </td>
                  <td style={{ 
                    ...fixedColumnStyle, 
                    left: '300px',
                    backgroundColor: index % 2 === 0 ? 'white' : '#F9F9F9',
                    fontWeight: 'medium'
                  }}>
                    {product.product_id}
                  </td>
                  <td style={cellStyle} title={product.description}>
                    {product.description ? 
                      (product.description.length > 40 ? 
                        product.description.substring(0, 40) + '...' : 
                        product.description) : '-'
                    }
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold' }}>
                    {product.total_quantity?.toLocaleString() || 0}
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>
                    {eosYear || '-'}
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold' }}>
                    {ldosYear || '-'}
                  </td>
                  
                  {/* Year columns with quantities and LDOS date */}
                  {yearColumns.map(year => {
                    const yearStr = year.toString();
                    const yearQty = product.year_quantities?.[yearStr] || 0;
                    
                    const ldosDateInYear = formatLDOSInYear(
                      product.last_day_of_support_date, 
                      year
                    );
                    const cellBgColor = getCellColor(product, year);
                    
                    return (
                      <td 
                        key={year}
                        style={{
                          ...cellStyle,
                          backgroundColor: cellBgColor,
                          textAlign: 'center',
                          fontWeight: ldosDateInYear ? 'bold' : 'normal'
                        }}
                      >
                        {/* Show quantity if exists */}
                        {yearQty > 0 && (
                          <div style={{ fontSize: '11px' }}>
                            {yearQty.toLocaleString()}
                          </div>
                        )}
                        {/* Show LDOS date (MON DD) if this is the LDOS year */}
                        {ldosDateInYear && (
                          <div style={{ 
                            fontSize: '10px', 
                            color: '#DC3545',
                            fontWeight: 'bold',
                            marginTop: yearQty > 0 ? '2px' : '0'
                          }}>
                            {ldosDateInYear}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          
          {/* Footer with summary */}
          <tfoot>
            <tr>
              <td colSpan={4} style={{ 
                ...headerStyle, 
                backgroundColor: '#E8EEF4',
                color: '#002D62',
                textAlign: 'left'
              }}>
                Total Products: {products.length}
              </td>
              <td style={{ 
                ...headerStyle, 
                backgroundColor: '#E8EEF4',
                color: '#002D62',
                textAlign: 'right'
              }}>
                {products.reduce((sum, p) => sum + (p.total_quantity || 0), 0).toLocaleString()}
              </td>
              <td colSpan={2 + yearColumns.length} style={{ 
                ...headerStyle, 
                backgroundColor: '#E8EEF4'
              }}></td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      {/* Legend */}
      <div className="p-4 border-t bg-gray-50">
        <div className="flex items-center gap-6 text-sm">
          <span className="font-semibold">Legend:</span>
          <div className="flex items-center gap-2">
            <div style={{ 
              width: '20px', 
              height: '20px', 
              backgroundColor: '#FFEBEE',
              border: '1px solid #D3D3D3'
            }}></div>
            <span>Past End of Life</span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ 
              width: '20px', 
              height: '20px', 
              backgroundColor: '#FFF9C4',
              border: '1px solid #D3D3D3'
            }}></div>
            <span>Past End of Sale</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-red-600 font-bold">MON DD</span>
            <span>Last Day of Support Date</span>
          </div>
        </div>
      </div>
    </div>
  );  // SINGLE CLOSING FOR RETURN STATEMENT
};  // CLOSING FOR TimelineTab FUNCTION

const EOLProductsTab = ({ products }) => {
  const eolProducts = products.filter(p => {
    if (!p.last_day_of_support_date) return false;
    return new Date(p.last_day_of_support_date) <= new Date();
  }).sort((a, b) => {
    const dateA = new Date(a.last_day_of_support_date);
    const dateB = new Date(b.last_day_of_support_date);
    return dateA - dateB;
  });

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 bg-red-50 border-b">
        <h3 className="text-lg font-bold text-red-800">
          {eolProducts.length} Products at or Past End of Life
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">EOL Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Past EOL</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {eolProducts.map((product, index) => {
              const daysPast = Math.abs(Math.floor((new Date() - new Date(product.last_day_of_support_date)) / (1000 * 60 * 60 * 24)));
              
              return (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium">{product.product_id}</td>
                  <td className="px-4 py-3 text-sm">{product.description}</td>
                  <td className="px-4 py-3 text-sm">{product.total_quantity}</td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(product.last_day_of_support_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-red-600 font-medium">{daysPast}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                      CRITICAL
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {eolProducts.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No products currently at End of Life
          </div>
        )}
      </div>
    </div>
  );
};

const CategoryAnalysisTab = ({ statistics }) => {
  const categories = statistics.categoryBreakdown || [];
  
  if (!categories || categories.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-8">
        <p className="text-center text-gray-500">No category data available</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-1">Total Categories</h4>
          <p className="text-2xl font-bold text-navy">{categories.length}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-1">Categories with Critical Risk</h4>
          <p className="text-2xl font-bold text-red-600">
            {categories.filter(c => c.critical_count > 0).length}
          </p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-1">Categories at EOL</h4>
          <p className="text-2xl font-bold text-orange-600">
            {categories.filter(c => c.eol_count > 0).length}
          </p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-1">Avg Confidence</h4>
          <p className="text-2xl font-bold text-teal-600">
            {Math.round(categories.reduce((sum, c) => sum + (c.avg_confidence || 0), 0) / categories.length)}%
          </p>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="text-lg font-bold" style={{ color: '#002D62' }}>
            Category Risk Analysis
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Products</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total Qty</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">% of Total</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Risk Distribution</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">EOL Count</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Confidence</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Priority</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {categories.map((category, index) => {
                const percentage = statistics.totalQuantity > 0 
                  ? ((category.total_quantity / statistics.totalQuantity) * 100).toFixed(1)
                  : 0;
                
                // Calculate priority based on critical and high risk counts
                const riskScore = (category.critical_count || 0) * 3 + (category.high_count || 0) * 2 + (category.medium_count || 0);
                const priority = riskScore > 5 ? 'HIGH' : riskScore > 2 ? 'MEDIUM' : 'LOW';
                const priorityColor = priority === 'HIGH' ? 'bg-red-100 text-red-800' : 
                                     priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' : 
                                     'bg-green-100 text-green-800';
                
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">
                      {category.product_category || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">{category.product_count}</td>
                    <td className="px-4 py-3 text-sm text-center font-medium">
                      {category.total_quantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">{percentage}%</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center space-x-2">
                        {category.critical_count > 0 && (
                          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                            C:{category.critical_count}
                          </span>
                        )}
                        {category.high_count > 0 && (
                          <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded">
                            H:{category.high_count}
                          </span>
                        )}
                        {category.medium_count > 0 && (
                          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                            M:{category.medium_count}
                          </span>
                        )}
                        {category.low_count > 0 && (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                            L:{category.low_count}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {category.eol_count > 0 ? (
                        <span className="text-red-600 font-medium">{category.eol_count}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {category.avg_confidence || 0}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${priorityColor}`}>
                        {priority}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const ManufacturerAnalysisTab = ({ statistics }) => {
  const manufacturers = statistics.manufacturerBreakdown || [];
  
  if (!manufacturers || manufacturers.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-8">
        <p className="text-center text-gray-500">No manufacturer data available</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-1">Total Manufacturers</h4>
          <p className="text-2xl font-bold text-navy">{manufacturers.length}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-1">Manufacturers with Critical Risk</h4>
          <p className="text-2xl font-bold text-red-600">
            {manufacturers.filter(m => m.critical_count > 0).length}
          </p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-1">Manufacturers with EOL Products</h4>
          <p className="text-2xl font-bold text-orange-600">
            {manufacturers.filter(m => m.eol_count > 0).length}
          </p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-1">AI Enhanced Products</h4>
          <p className="text-2xl font-bold text-teal-600">
            {manufacturers.reduce((sum, m) => sum + (m.ai_enhanced_count || 0), 0)}
          </p>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="text-lg font-bold" style={{ color: '#002D62' }}>
            Manufacturer Risk Analysis
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Manufacturer</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Products</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total Qty</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">% of Total</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Risk Distribution</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">EOL</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">AI Enhanced</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Confidence</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Priority</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {manufacturers.map((mfr, index) => {
                const percentage = statistics.totalQuantity > 0 
                  ? ((mfr.total_quantity / statistics.totalQuantity) * 100).toFixed(1)
                  : 0;
                
                // Calculate priority based on risk distribution
                const riskScore = (mfr.critical_count || 0) * 3 + (mfr.high_count || 0) * 2 + (mfr.medium_count || 0);
                const priority = riskScore > 5 ? 'HIGH' : riskScore > 2 ? 'MEDIUM' : 'LOW';
                const priorityColor = priority === 'HIGH' ? 'bg-red-100 text-red-800' : 
                                     priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' : 
                                     'bg-green-100 text-green-800';
                
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{mfr.manufacturer || 'Unknown'}</td>
                    <td className="px-4 py-3 text-sm text-center">{mfr.product_count}</td>
                    <td className="px-4 py-3 text-sm text-center font-medium">
                      {mfr.total_quantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">{percentage}%</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center space-x-1">
                        {mfr.critical_count > 0 && (
                          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                            C:{mfr.critical_count}
                          </span>
                        )}
                        {mfr.high_count > 0 && (
                          <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded">
                            H:{mfr.high_count}
                          </span>
                        )}
                        {mfr.medium_count > 0 && (
                          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                            M:{mfr.medium_count}
                          </span>
                        )}
                        {mfr.low_count > 0 && (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                            L:{mfr.low_count}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {mfr.eol_count > 0 ? (
                        <span className="text-red-600 font-medium">{mfr.eol_count}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {mfr.ai_enhanced_count > 0 ? (
                        <span className="text-teal-600 font-medium">{mfr.ai_enhanced_count}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">{mfr.avg_confidence || 0}%</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${priorityColor}`}>
                        {priority}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
const DataQualityTab = ({ statistics = {} }) => (
  <div className="space-y-6">
    {/* Overall Scores */}
    <div className="bg-white rounded-lg border p-6">
      <h3 className="text-lg font-bold mb-4" style={{ color: '#002D62' }}>Data Quality Metrics</h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-4 bg-blue-50 rounded">
          <p className="text-sm text-gray-600">Data Quality Score</p>
          <p className="text-3xl font-bold text-blue-700">{statistics.dataQualityScore || 0}</p>
          <p className="text-xs text-gray-500">out of 100</p>
        </div>
        <div className="text-center p-4 bg-green-50 rounded">
          <p className="text-sm text-gray-600">Average Confidence</p>
          <p className="text-3xl font-bold text-green-700">{statistics.avgConfidence || 0}%</p>
        </div>
        <div className="text-center p-4 bg-purple-50 rounded">
          <p className="text-sm text-gray-600">AI Enhanced</p>
          <p className="text-3xl font-bold text-purple-700">{statistics.aiEnhancedPercentage || 0}%</p>
        </div>
      </div>
    </div>

    {/* Enhancement Status */}
    <div className="bg-white rounded-lg border p-6">
      <h3 className="text-lg font-bold mb-4" style={{ color: '#002D62' }}>Enhancement Status</h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span>AI Enhanced Products</span>
          <span className="font-bold">{statistics.aiEnhancedCount || 0} / {statistics.totalProducts || 0}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="h-2 rounded-full bg-green-500" 
            style={{ width: `${statistics.aiEnhancedPercentage || 0}%` }}
          />
        </div>
      </div>
    </div>
  </div>
);

const RecommendationsTab = ({ recommendations = [] }) => {
  const defaultRecommendations = [
    {
      priority: 'immediate',
      title: 'Replace Critical Risk Products',
      description: 'Immediately begin replacement planning for all products at critical risk level',
      timeline: '0-3 months'
    },
    {
      priority: 'short',
      title: 'Address High Risk Items',
      description: 'Develop migration plans for high-risk products approaching end of life',
      timeline: '3-6 months'
    },
    {
      priority: 'medium',
      title: 'Improve Data Quality',
      description: 'Review and update products with low confidence scores',
      timeline: '6-12 months'
    },
    {
      priority: 'long',
      title: 'Establish Lifecycle Management Process',
      description: 'Implement regular reviews of product lifecycles to prevent future critical situations',
      timeline: 'Ongoing'
    }
  ];

  const displayRecommendations = recommendations.length > 0 ? recommendations : defaultRecommendations;

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'immediate': return '#DC3545';
      case 'short': return '#FD7E14';
      case 'medium': return '#FFC107';
      case 'long': return '#28A745';
      default: return '#6C757D';
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'immediate': return 'IMMEDIATE ACTION';
      case 'short': return 'SHORT TERM';
      case 'medium': return 'MEDIUM TERM';
      case 'long': return 'LONG TERM';
      default: return priority.toUpperCase();
    }
  };

  return (
    <div className="space-y-4">
      {displayRecommendations.map((rec, index) => (
        <div key={index} className="bg-white rounded-lg border p-6">
          <div className="flex items-start">
            <ChevronRight 
              size={20} 
              style={{ color: getPriorityColor(rec.priority) }} 
              className="mt-1 mr-3 flex-shrink-0"
            />
            <div className="flex-1">
              <div className="flex items-center mb-2">
                <span 
                  className="px-2 py-1 text-xs font-bold rounded"
                  style={{ 
                    backgroundColor: `${getPriorityColor(rec.priority)}20`,
                    color: getPriorityColor(rec.priority)
                  }}
                >
                  {getPriorityLabel(rec.priority)}
                </span>
                {rec.timeline && (
                  <span className="ml-3 text-sm text-gray-500">
                    {rec.timeline}
                  </span>
                )}
              </div>
              <h4 className="text-lg font-semibold mb-2" style={{ color: '#002D62' }}>
                {rec.title}
              </h4>
              <p className="text-gray-600">
                {rec.description}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Helper Components
const ScoreCard = ({ title, score, color, inverse = false }) => (
  <div className="bg-white rounded-lg border p-6 text-center">
    <h4 className="text-sm font-medium text-gray-500 mb-2">{title}</h4>
    <div className="relative inline-flex items-center justify-center">
      <svg className="w-32 h-32">
        <circle
          className="text-gray-200"
          strokeWidth="8"
          stroke="currentColor"
          fill="transparent"
          r="56"
          cx="64"
          cy="64"
        />
        <circle
          className="transform -rotate-90 origin-center"
          style={{ color }}
          strokeWidth="8"
          strokeDasharray={`${2 * Math.PI * 56}`}
          strokeDashoffset={`${2 * Math.PI * 56 * (1 - score / 100)}`}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r="56"
          cx="64"
          cy="64"
        />
      </svg>
      <span className="absolute text-2xl font-bold">{score}</span>
    </div>
  </div>
);

const MetricCard = ({ label, value, alert = false, warning = false }) => (
  <div className="p-3 bg-gray-50 rounded">
    <p className="text-xs text-gray-500 mb-1">{label}</p>
    <p className={`text-lg font-bold ${alert ? 'text-red-600' : warning ? 'text-yellow-600' : 'text-gray-900'}`}>
      {value}
    </p>
  </div>
);

const InsightCard = ({ insight }) => {
  const getIcon = () => {
    switch(insight.type) {
      case 'critical': return <AlertCircle className="text-red-500" size={20} />;
      case 'warning': return <AlertTriangle className="text-yellow-500" size={20} />;
      case 'success': return <CheckCircle className="text-green-500" size={20} />;
      default: return <Info className="text-blue-500" size={20} />;
    }
  };

  return (
    <div className="flex items-start p-3 bg-gray-50 rounded">
      <div className="mr-3 mt-0.5">{getIcon()}</div>
      <div>
        <p className="font-medium text-sm">{insight.title}</p>
        <p className="text-sm text-gray-600">{insight.message}</p>
      </div>
    </div>
  );
};

const RiskBadge = ({ level }) => {
  const getStyle = () => {
    switch(level) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded ${getStyle()}`}>
      {level?.toUpperCase() || 'NONE'}
    </span>
  );
};

const RiskBar = ({ level, count, percentage, color }) => (
  <div>
    <div className="flex justify-between mb-1">
      <span className="text-sm font-medium">{level}</span>
      <span className="text-sm text-gray-500">{count} ({percentage}%)</span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div 
        className="h-2 rounded-full" 
        style={{ width: `${percentage}%`, backgroundColor: color }}
      />
    </div>
  </div>
);

const QualityBar = ({ label, count, percentage, color }) => (
  <div>
    <div className="flex justify-between mb-1">
      <span className="text-sm font-medium">{label}</span>
      <span className="text-sm text-gray-500">{count} ({percentage}%)</span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div 
        className="h-2 rounded-full" 
        style={{ width: `${percentage}%`, backgroundColor: color }}
      />
    </div>
  </div>
);

const TimelineCard = ({ label, count, alert = false, warning = false, success = false, neutral = false }) => {
  const getStyle = () => {
    if (alert) return 'bg-red-50 border-red-200 text-red-800';
    if (warning) return 'bg-yellow-50 border-yellow-200 text-yellow-800';
    if (success) return 'bg-green-50 border-green-200 text-green-800';
    if (neutral) return 'bg-gray-50 border-gray-200 text-gray-800';
    return 'bg-blue-50 border-blue-200 text-blue-800';
  };

  return (
    <div className={`p-4 rounded-lg border ${getStyle()}`}>
      <p className="text-sm font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold">{count}</p>
    </div>
  );
};

const CompletionCard = ({ label, count, total, alert = false }) => {
  const percentage = ((count / total) * 100).toFixed(1);
  
  return (
    <div className={`p-4 rounded-lg border ${alert ? 'bg-red-50 border-red-200' : 'bg-gray-50'}`}>
      <p className="text-sm font-medium mb-1">{label}</p>
      <p className={`text-xl font-bold ${alert ? 'text-red-800' : 'text-gray-900'}`}>
        {count} ({percentage}%)
      </p>
    </div>
  );
};

const AttentionCard = ({ label, count }) => (
  <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
    <p className="text-sm font-medium text-yellow-800 mb-1">{label}</p>
    <p className="text-xl font-bold text-yellow-900">{count}</p>
  </div>
);

const getScoreColor = (score) => {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#FFC107';
  if (score >= 40) return '#FD7E14';
  return '#DC3545';
};

export default LifecycleReportView;