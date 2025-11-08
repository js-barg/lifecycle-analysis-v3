import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  AlertCircle, 
  Download,
  Save,
  Filter,
  X,
  Check,
  ChevronDown,
  Edit2,
  Calendar,
  Search,
  Star,
  Trash2,
  Copy,
  Settings,
  AlertTriangle,
  Package,
  Plus,
  Minus,
  CheckSquare,
  Square
} from 'lucide-react';

const Phase2Results = ({ phase1JobId, isActive, onComplete }) => {
  // Base URL for backend API - Backend is running on port 3001
  const API_BASE_URL = '';
  
  const [phase2Data, setPhase2Data] = useState(null);
  const [filteredItems, setFilteredItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [originalValue, setOriginalValue] = useState('');
  const [modifiedItems, setModifiedItems] = useState(new Set());
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [phase2JobId, setPhase2JobId] = useState(null);
  const [phase3Ready, setPhase3Ready] = useState(false);
  
  // Advanced filter states
  const [filters, setFilters] = useState({
    product_id: '',
    type: { include: [], exclude: [] },
    category: { include: [], exclude: [] },
    mfg: { include: [], exclude: [] },
    description: '',
    risk_level: { include: [], exclude: [] },
    support_status: { include: [], exclude: [] }
  });
  
  const [selectionFilterMode, setSelectionFilterMode] = useState('all'); // 'all', 'include-selected', 'exclude-selected'
  const [savedFilters, setSavedFilters] = useState([]);
  const [activeFilterId, setActiveFilterId] = useState(null);
  const [defaultFilterId, setDefaultFilterId] = useState(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showSaveFilterDialog, setShowSaveFilterDialog] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterDescription, setFilterDescription] = useState('');
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Sorting and pagination
  const [sortBy, setSortBy] = useState('risk_score');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Process Phase 2 analysis when component becomes active
  useEffect(() => {
    if (isActive && phase1JobId && !phase2Data) {
      runPhase2Analysis();
    }
  }, [isActive, phase1JobId]);

  // Apply filters when they change
  useEffect(() => {
    if (phase2Data?.items) {
      applyFilters();
    }
  }, [filters, phase2Data?.items, sortBy, sortOrder, selectedRows, selectionFilterMode]);

  // Load saved filters when data is loaded
  useEffect(() => {
    if (phase2Data?.jobId) {
      loadSavedFilters();
    }
  }, [phase2Data?.jobId]);

  const runPhase2Analysis = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/phase2/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase1JobId })
      });

      if (!response.ok) {
        throw new Error('Phase 2 analysis failed');
      }

      const { jobId } = await response.json();
      console.log('Phase 2 job created:', jobId);
      
      // IMPORTANT: Store the Phase 2 job ID
      setPhase2JobId(jobId);
      
      // Fetch results
      const resultsResponse = await fetch(`${API_BASE_URL}/api/phase2/results/${jobId}`);
      if (!resultsResponse.ok) {
        throw new Error('Failed to fetch Phase 2 results');
      }

      const results = await resultsResponse.json();
      setPhase2Data(results);
      setFilteredItems(results.items || []);
      
    } catch (err) {
      console.error('Phase 2 error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSavedFilters = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/phase2/filters`);
    if (response.ok) {
      const data = await response.json();
      
      // Normalize filter data to ensure consistent structure
      const normalizedFilters = (data.filters || []).map(filter => ({
        ...filter,
        filter_name: filter.filter_name || filter.name,
        name: filter.filter_name || filter.name
      }));
      
      setSavedFilters(normalizedFilters);
      console.log('Loaded filters:', normalizedFilters);
    }
  } catch (err) {
    console.error('Failed to load saved filters:', err);
  }
};

  const applyFilters = useCallback(() => {
    if (!phase2Data?.items) return;
    
    let filtered = [...phase2Data.items];
    
    // Row selection filter based on global mode
    if (selectionFilterMode === 'include-selected' && selectedRows.size > 0) {
      filtered = filtered.filter(item => selectedRows.has(item.id));
    } else if (selectionFilterMode === 'exclude-selected' && selectedRows.size > 0) {
      filtered = filtered.filter(item => !selectedRows.has(item.id));
    }
    
    // Text searches (partial match)
    if (filters.product_id) {
      filtered = filtered.filter(item => 
        item.product_id?.toLowerCase().includes(filters.product_id.toLowerCase())
      );
    }
    
    if (filters.description) {
      filtered = filtered.filter(item => 
        item.description?.toLowerCase().includes(filters.description.toLowerCase())
      );
    }
    
    // Advanced multi-select filters with include/exclude
    const applyAdvancedFilter = (items, field, filterConfig) => {
      let result = items;
      
      // Apply include filters
      if (filterConfig.include && filterConfig.include.length > 0) {
        result = result.filter(item => filterConfig.include.includes(item[field]));
      }
      
      // Apply exclude filters
      if (filterConfig.exclude && filterConfig.exclude.length > 0) {
        result = result.filter(item => !filterConfig.exclude.includes(item[field]));
      }
      
      return result;
    };
    
    filtered = applyAdvancedFilter(filtered, 'type', filters.type);
    filtered = applyAdvancedFilter(filtered, 'category', filters.category);
    filtered = applyAdvancedFilter(filtered, 'mfg', filters.mfg);
    filtered = applyAdvancedFilter(filtered, 'risk_level', filters.risk_level);
    filtered = applyAdvancedFilter(filtered, 'support_coverage', filters.support_status);
    
    // Sort
    filtered.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      // Handle null/undefined values
      if (aVal === null || aVal === undefined || aVal === '-') aVal = '';
      if (bVal === null || bVal === undefined || bVal === '-') bVal = '';
      
      // Numeric comparison for numbers
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      // String comparison
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    setFilteredItems(filtered);
    // Don't reset page if selections changed
    if (!selectedRows.size) {
      setCurrentPage(1);
    }
  }, [phase2Data?.items, filters, sortBy, sortOrder, selectedRows, selectionFilterMode]);

  const handleCellEdit = async (itemId, field, newValue, save = true) => {
    if (!save) {
      // Cancel edit
      setEditingCell(null);
      setEditValue('');
      setOriginalValue('');
      return;
    }
    
    try {
      console.log('Updating item:', { itemId, field, newValue, jobId: phase2Data.jobId });
      
      const response = await fetch(`${API_BASE_URL}/api/phase2/item/${phase2Data.jobId}/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: { [field]: newValue }
        })
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Update failed:', errorData);
        throw new Error(`Failed to update item: ${response.status}`);
      }

      const result = await response.json();
      console.log('Update result:', result);
      
      // Update local state
      setPhase2Data(prev => ({
        ...prev,
        items: prev.items.map(item => 
          item.id === itemId ? result.item : item
        ),
        summary: result.summary
      }));
      
      // Track modified item
      setModifiedItems(prev => new Set([...prev, itemId]));
      
      // Clear editing state
      setEditingCell(null);
      setEditValue('');
      setOriginalValue('');
      
    } catch (err) {
      console.error('Edit failed:', err);
      alert(`Failed to save changes: ${err.message}\n\nPlease check the browser console for more details.`);
      
      // Revert the edit
      setEditingCell(null);
      setEditValue('');
      setOriginalValue('');
    }
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const toggleRowSelection = (itemId) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const addToFilter = (field, value, mode = 'include') => {
    setFilters(prev => {
      const newFilters = { ...prev };
      if (typeof newFilters[field] === 'object' && newFilters[field].include) {
        // Advanced filter with include/exclude
        if (mode === 'include') {
          if (!newFilters[field].include.includes(value)) {
            newFilters[field].include = [...newFilters[field].include, value];
          }
          // Remove from exclude if present
          newFilters[field].exclude = newFilters[field].exclude.filter(v => v !== value);
        } else {
          if (!newFilters[field].exclude.includes(value)) {
            newFilters[field].exclude = [...newFilters[field].exclude, value];
          }
          // Remove from include if present
          newFilters[field].include = newFilters[field].include.filter(v => v !== value);
        }
      }
      return newFilters;
    });
  };

  const saveCurrentFilter = async () => {
  if (!filterName) {
    alert('Please enter a filter name');
    return;
  }
  
  // Check if there are any actual filters set
  const hasActiveFilters = 
    filters.product_id ||
    filters.description ||
    filters.type.include.length > 0 ||
    filters.type.exclude.length > 0 ||
    filters.category.include.length > 0 ||
    filters.category.exclude.length > 0 ||
    filters.mfg.include.length > 0 ||
    filters.mfg.exclude.length > 0 ||
    filters.risk_level.include.length > 0 ||
    filters.risk_level.exclude.length > 0 ||
    filters.support_status.include.length > 0 ||
    filters.support_status.exclude.length > 0 ||
    (selectedRows.size > 0 && selectionFilterMode !== 'all');
  
  if (!hasActiveFilters) {
    const proceed = confirm('No filter criteria are currently set. This will save an empty filter that shows all items. Continue?');
    if (!proceed) return;
  }
  
  try {
    // Convert selected row IDs to product IDs
    const selectedProductIds = [];
    if (selectedRows.size > 0 && phase2Data?.items) {
      phase2Data.items.forEach(item => {
        if (selectedRows.has(item.id)) {
          selectedProductIds.push(item.product_id);
        }
      });
    }
    
    // Create the filter configuration
    const filterConfig = {
      product_id: filters.product_id,
      type: filters.type,
      category: filters.category,
      mfg: filters.mfg,
      description: filters.description,
      risk_level: filters.risk_level,
      support_status: filters.support_status,
      selectionMode: selectionFilterMode,
      selectedProductIds: selectedProductIds,
      display: {
        sorting: { field: sortBy, order: sortOrder },
        itemsPerPage: itemsPerPage
      }
    };
    
    console.log('SAVING FILTER CONFIG:', JSON.stringify(filterConfig, null, 2));
    
    const response = await fetch(
      `${API_BASE_URL}/api/phase2/filters`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: filterName,
          filters: filterConfig,
          description: filterDescription
        })
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to save filter');
    }
    
    const result = await response.json();
    
    setSavedFilters(prev => [...prev, {
      ...result.filter,
      filter_name: filterName,
      name: filterName
    }]);
    
    setShowSaveFilterDialog(false);
    setFilterName('');
    setFilterDescription('');
    
    const filterSummary = hasActiveFilters 
      ? `with ${selectedProductIds.length} selections and filter criteria`
      : '(empty filter - shows all items)';
    
    alert(`Filter "${filterName}" saved ${filterSummary}`);
    
  } catch (err) {
    console.error('Save filter failed:', err);
    alert('Failed to save filter');
  }
};


{savedFilters.map(filter => (
  <button
    key={filter.filter_name || filter.name || filter.id}
    onClick={() => applySavedFilter(filter.filter_name || filter.name)}
    className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center justify-between"
  >
    <div className="flex items-center gap-2">
      {filter.is_default && <Star size={14} style={{ color: '#FCD34D' }} />}
      <span className="text-sm">{filter.filter_name || filter.name}</span>
    </div>
    {activeFilterId === (filter.filter_name || filter.name) && 
      <Check size={14} style={{ color: '#008080' }} />
    }
  </button>
))}

// Also, update the Saved Filters dropdown button onClick to pass the filter name correctly:
// In the dropdown where saved filters are displayed, update the onClick:

{savedFilters.map(filter => (
  <button
    key={filter.id || filter.filter_name}
    onClick={() => applySavedFilter(filter.filter_name || filter.name)}  // Pass the name, not ID
    className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center justify-between"
  >
    <div className="flex items-center gap-2">
      {filter.is_default && <Star size={14} style={{ color: '#FCD34D' }} />}
      <span className="text-sm">{filter.filter_name || filter.name}</span>
    </div>
    {(activeFilterId === filter.filter_name || activeFilterId === filter.name) && 
      <Check size={14} style={{ color: '#008080' }} />
    }
  </button>
))}

// Additional helper function to ensure filter compatibility
const normalizeFilterConfig = (filterConfig) => {
  // Ensure all required fields exist with proper structure
  return {
    product_id: filterConfig.product_id || '',
    type: {
      include: filterConfig.type?.include || [],
      exclude: filterConfig.type?.exclude || []
    },
    category: {
      include: filterConfig.category?.include || [],
      exclude: filterConfig.category?.exclude || []
    },
    mfg: {
      include: filterConfig.mfg?.include || [],
      exclude: filterConfig.mfg?.exclude || []
    },
    description: filterConfig.description || '',
    risk_level: {
      include: filterConfig.risk_level?.include || [],
      exclude: filterConfig.risk_level?.exclude || []
    },
    support_status: {
      include: filterConfig.support_status?.include || [],
      exclude: filterConfig.support_status?.exclude || []
    }
  };
};

// Updated version with better error handling and structure normalization:
const applySavedFilter = async (filterName) => {
  if (!filterName) {
    console.error('No filter name provided');
    return;
  }
  
  try {
    console.log('Loading filter:', filterName);
    const response = await fetch(
      `${API_BASE_URL}/api/phase2/filters/${encodeURIComponent(filterName)}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to load filter');
    }
    
    const data = await response.json();
    console.log('RAW FILTER DATA FROM SERVER:', JSON.stringify(data, null, 2));
    
    if (data.success && data.filter) {
      // Extract filter configuration - IT'S IN filter.config!
      let filterConfig = null;
      
      // Check all possible locations for the filter data
      if (data.filter.config) {
        // THIS IS THE CORRECT PATH FOR YOUR DATA
        filterConfig = data.filter.config;
      } else if (data.filter.filter_config) {
        filterConfig = typeof data.filter.filter_config === 'string' 
          ? JSON.parse(data.filter.filter_config) 
          : data.filter.filter_config;
      } else if (data.filter.filters) {
        filterConfig = data.filter.filters;
      } else {
        // Fallback - maybe the filter itself contains the config
        filterConfig = data.filter;
      }
      
      console.log('PARSED FILTER CONFIG:', JSON.stringify(filterConfig, null, 2));
      
      // Check if filter has any actual criteria
      const hasFilters = 
        filterConfig.product_id ||
        filterConfig.description ||
        (filterConfig.type?.include?.length > 0) ||
        (filterConfig.type?.exclude?.length > 0) ||
        (filterConfig.category?.include?.length > 0) ||
        (filterConfig.category?.exclude?.length > 0) ||
        (filterConfig.mfg?.include?.length > 0) ||
        (filterConfig.mfg?.exclude?.length > 0) ||
        (filterConfig.risk_level?.include?.length > 0) ||
        (filterConfig.risk_level?.exclude?.length > 0) ||
        (filterConfig.support_status?.include?.length > 0) ||
        (filterConfig.support_status?.exclude?.length > 0);
      
      const hasSelections = 
        filterConfig.selectedProductIds?.length > 0 && 
        filterConfig.selectionMode !== 'all';
      
      if (!hasFilters && !hasSelections) {
        console.warn('Filter appears empty but will apply selection mode:', filterConfig.selectionMode);
      } else {
        console.log(`Filter has ${filterConfig.selectedProductIds?.length || 0} selected products with mode: ${filterConfig.selectionMode}`);
      }
      
      // Apply the field filters
      setFilters({
        product_id: filterConfig.product_id || '',
        type: filterConfig.type || { include: [], exclude: [] },
        category: filterConfig.category || { include: [], exclude: [] },
        mfg: filterConfig.mfg || { include: [], exclude: [] },
        description: filterConfig.description || '',
        risk_level: filterConfig.risk_level || { include: [], exclude: [] },
        support_status: filterConfig.support_status || { include: [], exclude: [] }
      });
      
      // Apply selection mode
      setSelectionFilterMode(filterConfig.selectionMode || 'all');
      
      // CRITICAL: Map product_ids to current row IDs
      if (filterConfig.selectedProductIds && filterConfig.selectedProductIds.length > 0 && phase2Data?.items) {
        const newSelectedRows = new Set();
        let mappedCount = 0;
        
        // Create a map of product_id to row id for quick lookup
        const productIdToRowId = {};
        phase2Data.items.forEach(item => {
          productIdToRowId[item.product_id] = item.id;
        });
        
        // Map saved product IDs to current row IDs
        filterConfig.selectedProductIds.forEach(productId => {
          const rowId = productIdToRowId[productId];
          if (rowId !== undefined) {
            newSelectedRows.add(rowId);
            mappedCount++;
          }
        });
        
        console.log(`Mapped ${mappedCount} of ${filterConfig.selectedProductIds.length} product IDs to row IDs`);
        setSelectedRows(newSelectedRows);
        
        // Force immediate filtering with the new selections
        if (phase2Data?.items) {
          let filtered = [...phase2Data.items];
          
          // Apply the selection filter based on mode
          if (filterConfig.selectionMode === 'exclude-selected' && newSelectedRows.size > 0) {
            console.log(`Applying exclude-selected filter with ${newSelectedRows.size} selections`);
            filtered = filtered.filter(item => !newSelectedRows.has(item.id));
          } else if (filterConfig.selectionMode === 'include-selected' && newSelectedRows.size > 0) {
            console.log(`Applying include-selected filter with ${newSelectedRows.size} selections`);
            filtered = filtered.filter(item => newSelectedRows.has(item.id));
          }
          
          // Apply text filters
          if (filterConfig.product_id) {
            filtered = filtered.filter(item => 
              item.product_id?.toLowerCase().includes(filterConfig.product_id.toLowerCase())
            );
          }
          
          if (filterConfig.description) {
            filtered = filtered.filter(item => 
              item.description?.toLowerCase().includes(filterConfig.description.toLowerCase())
            );
          }
          
          // Apply advanced filters
          const applyAdvancedFilter = (items, field, filterCfg) => {
            let result = items;
            if (filterCfg?.include?.length > 0) {
              result = result.filter(item => filterCfg.include.includes(item[field]));
            }
            if (filterCfg?.exclude?.length > 0) {
              result = result.filter(item => !filterCfg.exclude.includes(item[field]));
            }
            return result;
          };
          
          filtered = applyAdvancedFilter(filtered, 'type', filterConfig.type);
          filtered = applyAdvancedFilter(filtered, 'category', filterConfig.category);
          filtered = applyAdvancedFilter(filtered, 'mfg', filterConfig.mfg);
          filtered = applyAdvancedFilter(filtered, 'risk_level', filterConfig.risk_level);
          filtered = applyAdvancedFilter(filtered, 'support_coverage', filterConfig.support_status);
          
          // Apply sorting
          const sortBy = filterConfig.display?.sorting?.field || 'risk_score';
          const sortOrder = filterConfig.display?.sorting?.order || 'desc';
          
          filtered.sort((a, b) => {
            let aVal = a[sortBy];
            let bVal = b[sortBy];
            
            if (aVal === null || aVal === undefined || aVal === '-') aVal = '';
            if (bVal === null || bVal === undefined || bVal === '-') bVal = '';
            
            if (typeof aVal === 'number' && typeof bVal === 'number') {
              return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
            }
            
            const comparison = String(aVal).localeCompare(String(bVal));
            return sortOrder === 'asc' ? comparison : -comparison;
          });
          
          // Update filtered items
          setFilteredItems(filtered);
          setCurrentPage(1);
          
          console.log(`✓ Filter "${filterName}" applied successfully!`);
          console.log(`  Mode: ${filterConfig.selectionMode}`);
          console.log(`  Selected items: ${newSelectedRows.size}`);
          console.log(`  Results: ${filtered.length} items shown (from ${phase2Data.items.length} total)`);
          
          if (filterConfig.selectionMode === 'exclude-selected') {
            console.log(`  Hidden: ${phase2Data.items.length - filtered.length} items`);
          }
        }
        
      } else {
        // No selections to restore
        setSelectedRows(new Set());
        console.log('No selections to restore or no matching products found');
      }
      
      // Apply display preferences
      if (filterConfig.display) {
        if (filterConfig.display.sorting) {
          setSortBy(filterConfig.display.sorting.field || 'risk_score');
          setSortOrder(filterConfig.display.sorting.order || 'desc');
        }
        if (filterConfig.display.itemsPerPage) {
          setItemsPerPage(filterConfig.display.itemsPerPage);
        }
      }
      
      setActiveFilterId(filterName);
      setShowFilterDropdown(false);
      
    } else {
      throw new Error('Invalid filter data structure');
    }
  } catch (err) {
    console.error('Failed to apply filter:', err);
    alert(`Failed to apply filter: ${err.message}`);
  }
};

  const clearFilters = () => {
    setFilters({
      product_id: '',
      type: { include: [], exclude: [] },
      category: { include: [], exclude: [] },
      mfg: { include: [], exclude: [] },
      description: '',
      risk_level: { include: [], exclude: [] },
      support_status: { include: [], exclude: [] }
    });
    setActiveFilterId(null);
    setSelectedRows(new Set());
    setSelectAll(false);
    setSelectionFilterMode('all');
  };

  const handleExport = async (exportType = 'filtered') => {
    if (!phase2Data?.jobId) return;
    
    try {
      // Build the export URL with proper parameters
      const baseUrl = `${API_BASE_URL}/api/phase2/export/${phase2Data.jobId}`;
      const params = new URLSearchParams();
      
      // For filtered export, we need to pass the current filter state
      if (exportType === 'filtered') {
        // Get the filtered item IDs
        const filteredIds = filteredItems.map(item => item.id);
        params.append('exportType', 'filtered');
        params.append('filteredIds', JSON.stringify(filteredIds));
        params.append('filterName', activeFilterId ? savedFilters.find(f => f.id === activeFilterId)?.name || 'Custom Filter' : 'Custom Filter');
      } else {
        params.append('exportType', 'all');
      }
      
      const response = await fetch(`${baseUrl}?${params.toString()}`);
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `enhanced_inventory_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export data. Please try again.');
    }
  };

  const handleAnalyze = async () => {
    if (!phase2Data?.jobId) return;
    
    setIsAnalyzing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/phase2/analyze-fields/${phase2Data.jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const result = await response.json();
      
      // Refresh the data to show analyzed results
      const resultsResponse = await fetch(`${API_BASE_URL}/api/phase2/results/${phase2Data.jobId}`);
      if (resultsResponse.ok) {
        const updatedResults = await resultsResponse.json();
        setPhase2Data(updatedResults);
        setFilteredItems(updatedResults.items || []);
      }
      
      setIsAnalyzed(true);
      alert(`Analysis complete! Updated ${result.updatedCount} items with missing fields.`);
      
    } catch (err) {
      console.error('Analysis failed:', err);
      alert('Failed to analyze data. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // In Phase2Results.jsx
const handleSaveForPhase3 = async () => {
    // Check for required data
    if (!phase2Data?.jobId) {
        console.error('No Phase 2 job ID found');
        alert('No Phase 2 data available. Please complete Phase 2 analysis first.');
        return;
    }
    
    // Use filtered items if available, otherwise use ALL items
    const itemsToSend = (filteredItems && filteredItems.length > 0) 
        ? filteredItems 
        : phase2Data.items;
    
    // Ensure we have items to send
    if (!itemsToSend || itemsToSend.length === 0) {
        alert('No items available for Phase 3.');
        return;
    }
    
    // Convert IDs to strings for consistency
    const filteredIds = itemsToSend.map(item => String(item.id));
    
    // Determine the filter name (remove reference to undefined activeFilterName)
    const filterName = savedFilters.find(f => f.id === activeFilterId)?.name || 
                      (itemsToSend.length < phase2Data.items.length ? 'Custom Filter' : 'All Items');
    
    console.log('Saving for Phase 3:', {
        jobId: phase2Data.jobId,
        itemCount: filteredIds.length,
        totalCount: phase2Data.items.length,
        filterName: filterName
    });
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/phase2/save-for-phase3/${phase2Data.jobId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filteredIds: filteredIds,
                filterName: filterName,  // Fixed: use filterName variable
                totalFiltered: itemsToSend.length,
                totalOriginal: phase2Data.items.length
            })
        });

        // Check response status
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Phase 3 save result:', result);
        
        // Update UI state to show Phase 3 is ready
        if (result.success && result.phase3Ready) {
            setPhase3Ready(true);
            
            // Show appropriate message
            if (itemsToSend.length < phase2Data.items.length) {
                alert(`✓ Successfully prepared ${result.itemsForPhase3} filtered items for Phase 3 analysis (from ${phase2Data.items.length} total)\n\nFilter: ${result.filterApplied}`);
            } else {
                alert(`✓ Successfully prepared all ${result.itemsForPhase3} items for Phase 3 analysis`);
            }
            
            // Store the phase2JobId for Phase 3 initialization
            localStorage.setItem('phase2JobIdForPhase3', phase2Data.jobId);

            // CRITICAL: Call the onComplete callback to activate Phase 3
            if (onComplete) {
                onComplete(phase2Data.jobId);

        } else {
            throw new Error('Failed to mark data as ready for Phase 3');
        }
      } 
    } catch (err) {
        console.error('Save for Phase 3 failed:', err);
        alert(`Failed to save for Phase 3: ${err.message}`);
    }
};

  // Get unique values for dropdowns
  const getUniqueValues = (field) => {
    if (!phase2Data?.items) return [];
    const values = new Set();
    phase2Data.items.forEach(item => {
      if (item[field] && item[field] !== '-') {
        values.add(item[field]);
      }
    });
    return Array.from(values).sort();
  };

  // Pagination Controls Component (reusable for top and bottom)
  const PaginationControls = () => (
    <div className="flex items-center justify-between p-4 bg-gray-50">
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">
          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length} items
        </span>
        <select
          value={itemsPerPage}
          onChange={(e) => setItemsPerPage(Number(e.target.value))}
          className="px-2 py-1 border rounded text-sm"
          style={{ borderColor: '#E5E7EB' }}
        >
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
          <option value={200}>200 per page</option>
        </select>
        <span className="text-sm font-medium" style={{ color: '#002D62' }}>
          {selectedRows.size > 0 && `(${selectedRows.size} rows selected total)`}
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1}
          className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
          style={{ borderColor: '#E5E7EB' }}
        >
          First
        </button>
        <button
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
          style={{ borderColor: '#E5E7EB' }}
        >
          Previous
        </button>
        
        <span className="px-3 text-sm">
          Page {currentPage} of {totalPages}
        </span>
        
        <button
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
          className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
          style={{ borderColor: '#E5E7EB' }}
        >
          Next
        </button>
        <button
          onClick={() => setCurrentPage(totalPages)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
          style={{ borderColor: '#E5E7EB' }}
        >
          Last
        </button>
      </div>
    </div>
  );

  // Pagination calculations - MUST be defined before any use
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;

  // Update selectAll state when selections change - MUST be after paginatedItems
  useEffect(() => {
    const visibleItemIds = paginatedItems.map(item => item.id);
    const allVisibleSelected = visibleItemIds.length > 0 && 
      visibleItemIds.every(id => selectedRows.has(id));
    setSelectAll(allVisibleSelected);
  }, [paginatedItems, selectedRows]);

  // Toggle select all function - MUST be after paginatedItems
  const toggleSelectAll = () => {
    if (selectAll) {
      // Only deselect items that are currently visible on the page
      const visibleItemIds = new Set(paginatedItems.map(item => item.id));
      setSelectedRows(prev => {
        const newSet = new Set(prev);
        visibleItemIds.forEach(id => newSet.delete(id));
        return newSet;
      });
      setSelectAll(false);
    } else {
      // Add all visible items to selection (keep existing selections)
      setSelectedRows(prev => {
        const newSet = new Set(prev);
        paginatedItems.forEach(item => newSet.add(item.id));
        return newSet;
      });
      setSelectAll(true);
    }
  };

  // Risk Badge Component
  const RiskBadge = ({ level }) => {
    const styles = {
      high: { bg: '#FEE2E2', text: '#DC2626', border: '#F87171' },
      medium: { bg: '#FEF3C7', text: '#D97706', border: '#FCD34D' },
      low: { bg: '#D1FAE5', text: '#059669', border: '#6EE7B7' }
    };
    
    const style = styles[level] || styles.low;
    
    return (
      <span 
        className="px-2 py-1 rounded text-xs font-bold uppercase inline-flex items-center"
        style={{ 
          backgroundColor: style.bg, 
          color: style.text,
          border: `1px solid ${style.border}`
        }}
      >
        {level === 'high' && <AlertTriangle size={12} className="mr-1" />}
        {level}
      </span>
    );
  };

  // Editable Cell Component with Save/Cancel
  const EditableCell = ({ item, field, value, type = 'text' }) => {
    const isEditing = editingCell?.itemId === item.id && editingCell?.field === field;
    const isModified = modifiedItems.has(item.id) && item.last_modified;
    
    if (isEditing) {
      return (
        <div className="relative">
          <div className="flex items-center gap-1">
            {type === 'date' ? (
              <input
                type="date"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCellEdit(item.id, field, editValue, true);
                  if (e.key === 'Escape') handleCellEdit(item.id, field, editValue, false);
                }}
                className="flex-1 px-2 py-1 border-2 rounded text-sm"
                style={{ borderColor: '#008080', backgroundColor: '#F0FDFA' }}
                autoFocus
              />
            ) : (
              <input
                type={type}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCellEdit(item.id, field, editValue, true);
                  if (e.key === 'Escape') handleCellEdit(item.id, field, editValue, false);
                }}
                className="flex-1 px-2 py-1 border-2 rounded text-sm"
                style={{ borderColor: '#008080', backgroundColor: '#F0FDFA' }}
                autoFocus
              />
            )}
            <button
              onClick={() => handleCellEdit(item.id, field, editValue, true)}
              className="p-1 hover:bg-green-100 rounded"
              title="Save (Enter)"
            >
              <Check size={14} className="text-green-600" />
            </button>
            <button
              onClick={() => handleCellEdit(item.id, field, editValue, false)}
              className="p-1 hover:bg-red-100 rounded"
              title="Cancel (Esc)"
            >
              <X size={14} className="text-red-600" />
            </button>
          </div>
        </div>
      );
    }
    
    return (
      <div 
        className="relative cursor-pointer hover:bg-gray-50 px-2 py-1 rounded group"
        onClick={() => {
          setEditingCell({ itemId: item.id, field });
          setEditValue(value || '');
          setOriginalValue(value || '');
        }}
      >
        <span className="text-sm">{value || '-'}</span>
        {isModified && field === 'description' && (
          <div 
            className="absolute top-1 right-1 w-2 h-2 rounded-full"
            style={{ backgroundColor: '#008080' }}
            title="Modified"
          />
        )}
        <Edit2 size={12} className="inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#008080' }} />
      </div>
    );
  };

  // Filter Tag Component
  const FilterTag = ({ field, value, mode = 'include' }) => {
    return (
      <span 
        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
        style={{ 
          backgroundColor: mode === 'include' ? '#D1FAE5' : '#FEE2E2',
          color: mode === 'include' ? '#059669' : '#DC2626'
        }}
      >
        {mode === 'exclude' && <Minus size={12} />}
        {mode === 'include' && <Plus size={12} />}
        <span className="font-medium">{field}:</span>
        <span>{value}</span>
        <button
          onClick={() => {
            setFilters(prev => {
              const newFilters = { ...prev };
              if (newFilters[field] && newFilters[field][mode]) {
                newFilters[field][mode] = newFilters[field][mode].filter(v => v !== value);
              }
              return newFilters;
            });
          }}
          className="ml-1 hover:opacity-70"
        >
          <X size={12} />
        </button>
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200" 
             style={{ borderTopColor: '#008080' }}></div>
        <p className="mt-4 text-sm text-gray-600">Enhancing inventory data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <AlertCircle className="text-red-500 mr-3" size={24} />
          <div>
            <p className="font-medium text-red-800">Phase 2 Analysis Error</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!phase2Data) {
    return (
      <div className="text-center py-12">
        <Package size={48} className="mx-auto mb-4 text-gray-400" />
        <p className="text-gray-600">Run Phase 2 analysis to see enhanced inventory</p>
      </div>
    );
  }
  // ADD THE AggregationInfo COMPONENT HERE (right before the return):
  const AggregationInfo = ({ summary }) => (
    <div className="bg-blue-50 rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Package className="text-blue-600" size={20} />
        <h4 className="text-sm font-bold uppercase" style={{ color: '#002D62' }}>
          Inventory Aggregation
        </h4>
      </div>
      <div className="grid grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-gray-600">Original Line Items:</span>
          <span className="font-bold ml-2">{summary.totalLineItems || 0}</span>
        </div>
        <div>
          <span className="text-gray-600">Unique Products:</span>
          <span className="font-bold ml-2">{summary.totalProducts || 0}</span>
        </div>
        <div>
          <span className="text-gray-600">Total Quantity:</span>
          <span className="font-bold ml-2">{summary.totalQuantity || 0}</span>
        </div>
        <div>
          <span className="text-gray-600">Aggregation Ratio:</span>
          <span className="font-bold ml-2">{summary.aggregationRatio || 0}:1</span>
        </div>
      </div>
    </div>
  );
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-xs font-bold uppercase mb-1" style={{ color: '#002D62' }}>
            Total Items
          </div>
          <div className="text-2xl font-bold" style={{ color: '#008080' }}>
            {phase2Data.summary?.totalItems || 0}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-xs font-bold uppercase mb-1" style={{ color: '#002D62' }}>
            Filtered Items
          </div>
          <div className="text-2xl font-bold" style={{ color: '#008080' }}>
            {filteredItems.length}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-xs font-bold uppercase mb-1" style={{ color: '#002D62' }}>
            High Risk
          </div>
          <div className="text-2xl font-bold" style={{ color: '#DC2626' }}>
            {filteredItems.filter(item => item.risk_level === 'high').length}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-xs font-bold uppercase mb-1" style={{ color: '#002D62' }}>
            SW Support Expiring
          </div>
          <div className="text-2xl font-bold" style={{ color: '#D97706' }}>
            {phase2Data.summary?.swSupportExpiring || 0}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-xs font-bold uppercase mb-1" style={{ color: '#002D62' }}>
            Modified Items
          </div>
          <div className="text-2xl font-bold" style={{ color: '#008080' }}>
            {modifiedItems.size}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-xs font-bold uppercase mb-1" style={{ color: '#002D62' }}>
            Selected Rows
          </div>
          <div className="text-2xl font-bold" style={{ color: '#059669' }}>
            {selectedRows.size}
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <section className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold uppercase" style={{ color: '#002D62' }}>
            Filters
          </h3>
          
          <div className="flex items-center gap-2">
            {/* Saved Filters Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="flex items-center gap-2 px-3 py-2 border rounded hover:bg-gray-50"
                style={{ borderColor: '#E5E7EB' }}
              >
                <Filter size={16} />
                <span className="text-sm">Saved Filters</span>
                <ChevronDown size={16} />
              </button>
              
              {showFilterDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border z-10"
                    style={{ borderColor: '#E5E7EB' }}>
                  {savedFilters.length > 0 ? (
                    <>
                      {savedFilters.map(filter => (
                        <button
                          key={filter.filter_name || filter.name || filter.id}
                          onClick={() => applySavedFilter(filter.filter_name || filter.name)}  // Pass name not ID
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            {filter.is_default && <Star size={14} style={{ color: '#FCD34D' }} />}
                            <span className="text-sm">{filter.filter_name || filter.name}</span>
                          </div>
                          {activeFilterId === (filter.filter_name || filter.name) && 
                            <Check size={14} style={{ color: '#008080' }} />
                          }
                        </button>
                      ))}
                      <div className="border-t" style={{ borderColor: '#E5E7EB' }}>
                        <button
                          onClick={() => {
                            setShowFilterDropdown(false);
                            setShowSaveFilterDialog(true);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm font-medium"
                          style={{ color: '#008080' }}
                        >
                          + Create New Filter
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="p-4 text-center">
                      <p className="text-sm text-gray-500 mb-2">No saved filters</p>
                      <button
                        onClick={() => {
                          setShowFilterDropdown(false);
                          setShowSaveFilterDialog(true);
                        }}
                        className="text-sm font-medium"
                        style={{ color: '#008080' }}
                      >
                        Create your first filter
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <button
              onClick={() => setShowSaveFilterDialog(true)}
              className="px-3 py-2 text-white rounded hover:opacity-90"
              style={{ backgroundColor: '#008080' }}
            >
              Save Current
            </button>
            
            <button
              onClick={clearFilters}
              className="px-3 py-2 border rounded hover:bg-gray-50"
              style={{ borderColor: '#E5E7EB' }}
            >
              Clear All
            </button>
            <button
              onClick={() => {
                console.log('=== CURRENT FILTER STATE ===');
                console.log('Filters:', JSON.stringify(filters, null, 2));
                console.log('Selection Mode:', selectionFilterMode);
                console.log('Selected Rows:', selectedRows.size, 'items');
                console.log('Total Items:', phase2Data?.items?.length);
                console.log('Filtered Items:', filteredItems.length);
                
                // Check what's actually filtering
                const hasActiveFilters = 
                  filters.product_id ||
                  filters.description ||
                  filters.type.include.length > 0 ||
                  filters.type.exclude.length > 0 ||
                  filters.category.include.length > 0 ||
                  filters.category.exclude.length > 0 ||
                  filters.mfg.include.length > 0 ||
                  filters.mfg.exclude.length > 0 ||
                  filters.risk_level.include.length > 0 ||
                  filters.risk_level.exclude.length > 0 ||
                  filters.support_status.include.length > 0 ||
                  filters.support_status.exclude.length > 0;
                
                const hasSelectionFilter = 
                  (selectionFilterMode === 'include-selected' || selectionFilterMode === 'exclude-selected') && 
                  selectedRows.size > 0;
                
                console.log('Has Active Filters:', hasActiveFilters);
                console.log('Has Selection Filter:', hasSelectionFilter);
                
                if (!hasActiveFilters && !hasSelectionFilter) {
                  alert('No filters are currently active. Set some filter criteria first.');
                }
              }}
              className="px-3 py-2 border rounded hover:bg-gray-50"
              style={{ borderColor: '#E5E7EB' }}
            >
              Debug Filters
            </button>
          </div>
        </div>

        {/* Selection Mode Controls */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold uppercase" style={{ color: '#002D62' }}>
                Row Selection Mode:
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectionFilterMode('all')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    selectionFilterMode === 'all' 
                      ? 'text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                  style={{ 
                    backgroundColor: selectionFilterMode === 'all' ? '#008080' : undefined,
                    border: '1px solid #E5E7EB'
                  }}
                >
                  Show All
                </button>
                <button
                  onClick={() => setSelectionFilterMode('include-selected')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    selectionFilterMode === 'include-selected' 
                      ? 'text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                  style={{ 
                    backgroundColor: selectionFilterMode === 'include-selected' ? '#059669' : undefined,
                    border: '1px solid #E5E7EB'
                  }}
                >
                  Show Selected Only
                </button>
                <button
                  onClick={() => setSelectionFilterMode('exclude-selected')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    selectionFilterMode === 'exclude-selected' 
                      ? 'text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                  style={{ 
                    backgroundColor: selectionFilterMode === 'exclude-selected' ? '#DC2626' : undefined,
                    border: '1px solid #E5E7EB'
                  }}
                >
                  Hide Selected
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                {selectedRows.size} rows selected
              </span>
              {selectedRows.size > 0 && (
                <button
                  onClick={() => {
                    setSelectedRows(new Set());
                    setSelectAll(false);
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Clear Selection
                </button>
              )}
            </div>
          </div>
          {selectionFilterMode !== 'all' && selectedRows.size === 0 && (
            <p className="mt-2 text-sm text-amber-600">
              ⚠️ No rows selected. Please select rows for the filter to take effect.
            </p>
          )}
        </div>

        {/* Quick Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold uppercase mb-1" style={{ color: '#002D62' }}>
              Product ID
            </label>
            <div className="relative">
              <Search size={16} className="absolute left-2 top-2.5 text-gray-400" />
              <input
                type="text"
                value={filters.product_id}
                onChange={(e) => setFilters(prev => ({ ...prev, product_id: e.target.value }))}
                className="w-full pl-8 pr-2 py-2 border rounded text-sm"
                style={{ borderColor: '#E5E7EB' }}
                placeholder="Search..."
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold uppercase mb-1" style={{ color: '#002D62' }}>
              Description
            </label>
            <div className="relative">
              <Search size={16} className="absolute left-2 top-2.5 text-gray-400" />
              <input
                type="text"
                value={filters.description}
                onChange={(e) => setFilters(prev => ({ ...prev, description: e.target.value }))}
                className="w-full pl-8 pr-2 py-2 border rounded text-sm"
                style={{ borderColor: '#E5E7EB' }}
                placeholder="Search..."
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold uppercase mb-1" style={{ color: '#002D62' }}>
              Type
            </label>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addToFilter('type', e.target.value, 'include');
                  e.target.value = '';
                }
              }}
              className="w-full p-2 border rounded text-sm"
              style={{ borderColor: '#E5E7EB' }}
            >
              <option value="">Add filter...</option>
              {getUniqueValues('type').map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-bold uppercase mb-1" style={{ color: '#002D62' }}>
              Risk Level
            </label>
            <div className="flex gap-2">
              {['high', 'medium', 'low'].map(level => (
                <button
                  key={level}
                  onClick={() => addToFilter('risk_level', level, 'include')}
                  className="px-2 py-1 border rounded text-xs capitalize hover:bg-gray-50"
                  style={{ borderColor: '#E5E7EB' }}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Active Filter Tags */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(filters).map(([field, value]) => {
            if (typeof value === 'object' && value.include) {
              return (
                <React.Fragment key={field}>
                  {value.include.map(v => (
                    <FilterTag key={`${field}-include-${v}`} field={field} value={v} mode="include" />
                  ))}
                  {value.exclude.map(v => (
                    <FilterTag key={`${field}-exclude-${v}`} field={field} value={v} mode="exclude" />
                  ))}
                </React.Fragment>
              );
            }
            return null;
          })}
          
          {selectionFilterMode !== 'all' && (
            <span 
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold"
              style={{ 
                backgroundColor: selectionFilterMode === 'include-selected' ? '#D1FAE5' : '#FEE2E2',
                color: selectionFilterMode === 'include-selected' ? '#059669' : '#DC2626'
              }}
            >
              {selectionFilterMode === 'include-selected' ? 
                `Showing ${selectedRows.size} selected rows` : 
                `Hiding ${selectedRows.size} selected rows`
              }
            </span>
          )}
        </div>
      </section>

      {/* Enhanced Data Table */}
      <section className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold uppercase" style={{ color: '#002D62' }}>
              Enhanced Inventory ({filteredItems.length} items) - This filtered data will be used for Phase 2 analysis
            </h3>
          </div>
          
          <div className="flex items-center justify-between">
            {/* Analyze button on the left */}
            <div>
              {!isAnalyzed ? (
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="flex items-center gap-2 px-3 py-2 text-white rounded hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#008080' }}
                >
                  {isAnalyzing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Settings size={16} />
                      Analyze
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleSaveForPhase3}
                  className="flex items-center gap-2 px-3 py-2 text-white rounded hover:opacity-90"
                  style={{ backgroundColor: phase3Ready ? '#10B981' : '#059669' }}
                >
                  <Check size={16} />
                  {phase3Ready ? 'Phase 3 Ready ✓' : 'Ready Phase 3'}
                </button>
              )}
            </div>
            
            {/* Export button on the right */}
            <div>
              <button
                onClick={() => handleExport('filtered')}
                className="flex items-center gap-2 px-3 py-2 border rounded hover:bg-gray-50"
                style={{ borderColor: '#E5E7EB' }}
              >
                <Download size={16} />
                Export Filtered
              </button>
            </div>
          </div>
        </div>
        
        {/* Top Pagination Controls */}
        <PaginationControls />
        
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b" style={{ borderColor: '#E5E7EB' }}>
                <th className="px-4 py-3">
                  <button 
                    onClick={toggleSelectAll} 
                    className="hover:opacity-70"
                    title={selectAll ? "Deselect all on this page" : "Select all on this page"}
                  >
                    {selectAll ? <CheckSquare size={18} style={{ color: '#008080' }} /> : <Square size={18} style={{ color: '#6B7280' }} />}
                  </button>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-bold uppercase cursor-pointer hover:bg-gray-100"
                  style={{ color: '#002D62' }}
                  onClick={() => handleSort('risk_level')}
                >
                  Risk {sortBy === 'risk_level' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-bold uppercase cursor-pointer hover:bg-gray-100"
                  style={{ color: '#002D62' }}
                  onClick={() => handleSort('mfg')}
                >
                  Manufacturer {sortBy === 'mfg' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-bold uppercase cursor-pointer hover:bg-gray-100"
                  style={{ color: '#002D62' }}
                  onClick={() => handleSort('category')}
                >
                  Category {sortBy === 'category' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase" style={{ color: '#002D62' }}>
                  Type
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-bold uppercase cursor-pointer hover:bg-gray-100"
                  style={{ color: '#002D62' }}
                  onClick={() => handleSort('product_id')}
                >
                  Product ID {sortBy === 'product_id' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-bold uppercase cursor-pointer hover:bg-gray-100"
                  style={{ color: '#002D62' }}
                  onClick={() => handleSort('description')}
                >
                  Description {sortBy === 'description' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-bold uppercase cursor-pointer hover:bg-gray-100"
                  style={{ color: '#002D62' }}
                  onClick={() => handleSort('qty')}
                >
                  Qty {sortBy === 'qty' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase" style={{ color: '#002D62' }}>
                  Support
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase" style={{ color: '#002D62' }}>
                  End of Sale
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase" style={{ color: '#002D62' }}>
                  Last Support
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase" style={{ color: '#002D62' }}>
                  SW Support
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase" style={{ color: '#002D62' }}>
                  SW Vulnerability
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase" style={{ color: '#002D62' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item, index) => {
                const isItemSelected = selectedRows.has(item.id);
                return (
                  <tr 
                    key={item.id} 
                    className={`border-b hover:bg-gray-50 ${isItemSelected ? 'bg-blue-50' : ''}`}
                    style={{ borderColor: '#E5E7EB' }}
                  >
                    <td className="px-4 py-3">
                      <button onClick={() => toggleRowSelection(item.id)} className="hover:opacity-70">
                        {isItemSelected ? 
                          <CheckSquare size={18} style={{ color: '#008080' }} /> : 
                          <Square size={18} style={{ color: '#6B7280' }} />
                        }
                      </button>
                    </td>
                  <td className="px-4 py-3">
                    <RiskBadge level={item.risk_level} />
                  </td>
                  <td className="px-4 py-3">
                    <EditableCell item={item} field="mfg" value={item.mfg} />
                  </td>
                  <td className="px-4 py-3">
                    <EditableCell item={item} field="category" value={item.category} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-sm">{item.type || '-'}</span>
                      <button
                        onClick={() => addToFilter('type', item.type, 'include')}
                        className="opacity-0 hover:opacity-100 p-1"
                        title="Include in filter"
                      >
                        <Plus size={12} style={{ color: '#059669' }} />
                      </button>
                      <button
                        onClick={() => addToFilter('type', item.type, 'exclude')}
                        className="opacity-0 hover:opacity-100 p-1"
                        title="Exclude from filter"
                      >
                        <Minus size={12} style={{ color: '#DC2626' }} />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <EditableCell item={item} field="product_id" value={item.product_id} />
                  </td>
                  <td className="px-4 py-3">
                    <EditableCell item={item} field="description" value={item.description} />
                  </td>
                  <td className="px-4 py-3">
                    <EditableCell item={item} field="qty" value={item.qty} type="number" />
                  </td>
                  <td className="px-4 py-3">
                    <div 
                      className="cursor-pointer hover:bg-gray-50 px-2 py-1 rounded inline-block"
                      onClick={() => {
                        const newValue = item.support_coverage === 'Active' ? 'Expired' : 'Active';
                        handleCellEdit(item.id, 'support_coverage', newValue);
                      }}
                    >
                      <span 
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          item.support_coverage === 'Active' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {item.support_coverage}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <EditableCell item={item} field="end_of_sale" value={item.end_of_sale} type="date" />
                  </td>
                  <td className="px-4 py-3">
                    <EditableCell item={item} field="last_day_support" value={item.last_day_support} type="date" />
                  </td>
                  <td className="px-4 py-3">
                    <EditableCell item={item} field="end_of_sw_support" value={item.end_of_sw_support} type="date" />
                  </td>
                  <td className="px-4 py-3">
                    <EditableCell item={item} field="end_of_sw_vulnerability" value={item.end_of_sw_vulnerability} type="date" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => addToFilter('mfg', item.mfg, 'include')}
                        className="p-1 hover:bg-green-100 rounded"
                        title="Filter by this manufacturer"
                      >
                        <Filter size={14} style={{ color: '#059669' }} />
                      </button>
                      <button
                        onClick={() => addToFilter('category', item.category, 'include')}
                        className="p-1 hover:bg-blue-100 rounded"
                        title="Filter by this category"
                      >
                        <Filter size={14} style={{ color: '#0369A1' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
        
        {/* Bottom Pagination Controls */}
        <PaginationControls />
      </section>

      {/* Save Filter Dialog */}
      {showSaveFilterDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4" style={{ color: '#002D62' }}>
              Save Current Filter
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#002D62' }}>
                  Filter Name *
                </label>
                <input
                  type="text"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: '#E5E7EB' }}
                  placeholder="e.g., High Risk Network Equipment"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#002D62' }}>
                  Description (optional)
                </label>
                <textarea
                  value={filterDescription}
                  onChange={(e) => setFilterDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: '#E5E7EB' }}
                  rows={3}
                  placeholder="Describe what this filter shows..."
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowSaveFilterDialog(false);
                  setFilterName('');
                  setFilterDescription('');
                }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
                style={{ borderColor: '#E5E7EB' }}
              >
                Cancel
              </button>
              <button
                onClick={saveCurrentFilter}
                className="px-4 py-2 text-white rounded hover:opacity-90"
                style={{ backgroundColor: '#008080' }}
              >
                Save Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Phase2Results;
