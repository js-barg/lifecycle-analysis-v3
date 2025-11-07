import React, { useState, useEffect } from 'react';
import { 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  AlertCircle, 
  Info,
  Check,
  Settings
} from 'lucide-react';

const Phase1FilterPanel = ({ onFilterChange, currentFilterId, uploadedFile }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filterSets, setFilterSets] = useState([]);
  const [activeFilterId, setActiveFilterId] = useState(currentFilterId || null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingFilter, setEditingFilter] = useState(null);
  const [filterStats, setFilterStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form state for creating/editing filters
  const [filterForm, setFilterForm] = useState({
    name: '',
    description: '',
    productIds: '',
    descriptions: '',
    productTypes: ''
  });

  // Load filter sets on mount
  useEffect(() => {
    loadFilterSets();
  }, []);

  const loadFilterSets = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/phase1/filters');
      if (response.ok) {
        const data = await response.json();
        setFilterSets(data.filterSets || []);
        if (data.activeFilterId) {
          setActiveFilterId(data.activeFilterId);
        }
      }
    } catch (error) {
      console.error('Error loading filter sets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFilter = async (filterId) => {
    try {
      // Set as active filter
      const response = await fetch('/api/phase1/filters/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filterId })
      });
      
      if (response.ok) {
        setActiveFilterId(filterId);
        onFilterChange(filterId);
        
        // Get filter stats if file is uploaded
        if (uploadedFile && filterId !== 'no-filter') {
          await getFilterPreview(filterId);
        }
      }
    } catch (error) {
      console.error('Error setting active filter:', error);
    }
  };

  const getFilterPreview = async (filterId) => {
    // This would ideally preview with sample data from the uploaded file
    // For now, just show the filter is selected
    const filter = filterSets.find(f => f.id === filterId);
    if (filter) {
      setFilterStats({
        filterName: filter.name,
        description: filter.description
      });
    }
  };

  const handleCreateFilter = async () => {
    try {
      const newFilter = {
        name: filterForm.name,
        description: filterForm.description,
        filters: {
          productIds: {
            patterns: filterForm.productIds.split(',').map(p => p.trim()).filter(p => p),
            regexPatterns: []
          },
          descriptions: {
            patterns: filterForm.descriptions.split(',').map(p => p.trim()).filter(p => p),
            regexPatterns: []
          },
          productTypes: {
            exact: filterForm.productTypes.split(',').map(p => p.trim()).filter(p => p),
            patterns: []
          }
        }
      };
      
      const response = await fetch('/api/phase1/filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFilter)
      });
      
      if (response.ok) {
        await loadFilterSets();
        setShowCreateDialog(false);
        resetForm();
      }
    } catch (error) {
      console.error('Error creating filter:', error);
    }
  };

  const handleUpdateFilter = async () => {
    if (!editingFilter) return;
    
    try {
      const updates = {
        name: filterForm.name,
        description: filterForm.description,
        filters: {
          productIds: {
            patterns: filterForm.productIds.split(',').map(p => p.trim()).filter(p => p),
            regexPatterns: []
          },
          descriptions: {
            patterns: filterForm.descriptions.split(',').map(p => p.trim()).filter(p => p),
            regexPatterns: []
          },
          productTypes: {
            exact: filterForm.productTypes.split(',').map(p => p.trim()).filter(p => p),
            patterns: []
          }
        }
      };
      
      const response = await fetch(`/api/phase1/filters/${editingFilter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        await loadFilterSets();
        setShowEditDialog(false);
        setEditingFilter(null);
        resetForm();
      }
    } catch (error) {
      console.error('Error updating filter:', error);
    }
  };

  const handleDeleteFilter = async (filterId) => {
    if (!confirm('Are you sure you want to delete this filter?')) return;
    
    try {
      const response = await fetch(`/api/phase1/filters/${filterId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await loadFilterSets();
        if (activeFilterId === filterId) {
          setActiveFilterId(null);
          onFilterChange(null);
        }
      }
    } catch (error) {
      console.error('Error deleting filter:', error);
    }
  };

  const startEditFilter = (filter) => {
    setEditingFilter(filter);
    setFilterForm({
      name: filter.name,
      description: filter.description || '',
      productIds: filter.filters?.productIds?.patterns?.join(', ') || '',
      descriptions: filter.filters?.descriptions?.patterns?.join(', ') || '',
      productTypes: filter.filters?.productTypes?.exact?.join(', ') || ''
    });
    setShowEditDialog(true);
  };

  const resetForm = () => {
    setFilterForm({
      name: '',
      description: '',
      productIds: '',
      descriptions: '',
      productTypes: ''
    });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 mb-4">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <Filter className="h-5 w-5 text-[#002D62]" />
          <h3 className="font-bold text-[#002D62] uppercase">PHASE 1 EXCLUSION FILTERS</h3>
          {activeFilterId && activeFilterId !== 'no-filter' && (
            <span className="px-2 py-1 bg-[#008080] text-white text-xs rounded">
              ACTIVE
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {/* Filter Stats Banner */}
          {filterStats && (
            <div className="p-4 bg-[#F8F8F8] border-b border-gray-200">
              <div className="flex items-start space-x-2">
                <Info className="h-5 w-5 text-[#008080] mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-[#002D62]">
                    Active Filter: {filterStats.filterName}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {filterStats.description}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Filter Sets List */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-[#002D62] uppercase">AVAILABLE FILTER SETS</h4>
              <button
                onClick={() => setShowCreateDialog(true)}
                className="flex items-center space-x-1 px-3 py-1 bg-[#008080] text-white rounded hover:bg-[#006666] transition-colors text-sm"
              >
                <Plus className="h-4 w-4" />
                <span>NEW FILTER</span>
              </button>
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-gray-500">Loading filters...</div>
            ) : (
              <div className="space-y-2">
                {filterSets.map(filter => (
                  <div
                    key={filter.id}
                    className={`p-3 border rounded-lg transition-all ${
                      activeFilterId === filter.id 
                        ? 'border-[#008080] bg-[#F0FFFF]' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="activeFilter"
                            checked={activeFilterId === filter.id}
                            onChange={() => handleSelectFilter(filter.id)}
                            className="text-[#008080] focus:ring-[#008080]"
                          />
                          <span className="font-semibold text-sm text-[#002D62]">
                            {filter.name}
                          </span>
                          {filter.isSystem && (
                            <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">
                              SYSTEM
                            </span>
                          )}
                        </div>
                        {filter.description && (
                          <p className="text-xs text-gray-600 mt-1 ml-6">
                            {filter.description}
                          </p>
                        )}
                        {filter.stats?.usageCount > 0 && (
                          <p className="text-xs text-gray-500 mt-1 ml-6">
                            Used {filter.stats.usageCount} times
                          </p>
                        )}
                      </div>
                      {!filter.isSystem && (
                        <div className="flex items-center space-x-1 ml-4">
                          <button
                            onClick={() => startEditFilter(filter)}
                            className="p-1 text-gray-400 hover:text-[#002D62] transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteFilter(filter.id)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Info Box */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="text-xs text-blue-700">
                  <p className="font-semibold mb-1">How filters work:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Filters exclude items during Phase 1 processing</li>
                    <li>Use wildcards (*) for pattern matching (e.g., *PWR* matches all power supplies)</li>
                    <li>Multiple patterns in any category are combined with OR logic</li>
                    <li>Excluded items won't appear in Phase 2 or Phase 3 analysis</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Create/Edit Dialog */}
          {(showCreateDialog || showEditDialog) && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-[#002D62] uppercase">
                      {showEditDialog ? 'EDIT FILTER SET' : 'CREATE NEW FILTER SET'}
                    </h3>
                    <button
                      onClick={() => {
                        setShowCreateDialog(false);
                        setShowEditDialog(false);
                        setEditingFilter(null);
                        resetForm();
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-[#002D62] uppercase mb-1">
                        FILTER NAME
                      </label>
                      <input
                        type="text"
                        value={filterForm.name}
                        onChange={(e) => setFilterForm({...filterForm, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-[#008080]"
                        placeholder="e.g., Exclude Accessories"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#002D62] uppercase mb-1">
                        DESCRIPTION
                      </label>
                      <textarea
                        value={filterForm.description}
                        onChange={(e) => setFilterForm({...filterForm, description: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-[#008080]"
                        rows="2"
                        placeholder="Brief description of what this filter excludes"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#002D62] uppercase mb-1">
                        EXCLUDE PRODUCT IDS (comma-separated, use * for wildcards)
                      </label>
                      <textarea
                        value={filterForm.productIds}
                        onChange={(e) => setFilterForm({...filterForm, productIds: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-[#008080] font-mono text-sm"
                        rows="3"
                        placeholder="*PWR*, *FAN*, *CAB-*, *MEM-*"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#002D62] uppercase mb-1">
                        EXCLUDE DESCRIPTIONS CONTAINING (comma-separated, use * for wildcards)
                      </label>
                      <textarea
                        value={filterForm.descriptions}
                        onChange={(e) => setFilterForm({...filterForm, descriptions: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-[#008080] font-mono text-sm"
                        rows="3"
                        placeholder="*power supply*, *cable*, *bracket*, *memory*"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#002D62] uppercase mb-1">
                        EXCLUDE PRODUCT TYPES (comma-separated)
                      </label>
                      <textarea
                        value={filterForm.productTypes}
                        onChange={(e) => setFilterForm({...filterForm, productTypes: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-[#008080] font-mono text-sm"
                        rows="2"
                        placeholder="Software, License, Accessory, Cable"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 mt-6">
                    <button
                      onClick={() => {
                        setShowCreateDialog(false);
                        setShowEditDialog(false);
                        setEditingFilter(null);
                        resetForm();
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={showEditDialog ? handleUpdateFilter : handleCreateFilter}
                      disabled={!filterForm.name}
                      className="px-4 py-2 bg-[#008080] text-white rounded hover:bg-[#006666] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="flex items-center space-x-2">
                        <Save className="h-4 w-4" />
                        <span>{showEditDialog ? 'Update Filter' : 'Create Filter'}</span>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Phase1FilterPanel;