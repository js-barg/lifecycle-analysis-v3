// backend/src/services/phase1FilterService.js
// WORKING VERSION - Simple pattern matching that actually works

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class Phase1FilterService {
    constructor() {
        this.dataDir = path.join(__dirname, '../../../data');
        this.filtersFile = path.join(this.dataDir, 'phase1_filters.json');
        this.defaultFilters = this.getDefaultFilters();
        
        this.initializeStorage();
    }

    async initializeStorage() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
            
            try {
                await fs.access(this.filtersFile);
                await this.ensureDefaultFilters();
            } catch {
                const initialData = {
                    filterSets: this.defaultFilters,
                    activeFilterId: 'default-exclude-common'
                };
                await this.saveToFile(initialData);
                console.log('Initialized Phase 1 filters with defaults');
            }
        } catch (error) {
            console.error('Failed to initialize Phase 1 filter storage:', error);
        }
    }

    getDefaultFilters() {
        return [
            {
                id: 'default-exclude-common',
                name: 'Exclude Common Accessories',
                description: 'Excludes power supplies, cables, fans, memory modules, and common accessories',
                isDefault: true,
                isSystem: true,
                filters: {
                    productIds: {
                        patterns: [
                            '*PWR*',           // Power supplies
                            '*POWER*',         // Power supplies
                            '*FAN*',           // Fans
                            '*MEM-*',          // Memory modules
                            '*CAB-*',          // Cables
                            '*CABLE*',         // Cables
                            '*BRACKET*',       // Mounting brackets
                            '*SCREW*',         // Screws
                            '*NUT*',           // Nuts/bolts
                            '*RAIL*'           // Rack rails
                        ],
                        regexPatterns: []
                    },
                    descriptions: {
                        patterns: [
                            '*power supply*',
                            '*power cord*',
                            '*fan module*',
                            '*fan tray*',
                            '*memory*',
                            '*RAM*',
                            '*cable*',
                            '*bracket*',
                            '*mounting*',
                            '*screw*',
                            '*accessory kit*',
                            '*rail kit*'
                        ],
                        regexPatterns: []
                    },
                    productTypes: {
                        exact: [
                            'Software',
                            'License',
                            'Service',  // Added Service type
                            'Accessory',
                            'Cable',
                            'Memory',
                            'Power Supply',
                            'Fan',
                            'Documentation'
                        ],
                        patterns: [
                            '*Software*',
                            '*License*',
                            '*Service*',  // Added Service pattern
                            '*Subscription*'
                        ]
                    }
                },
                stats: {
                    usageCount: 0,
                    lastUsed: null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            },
            {
                id: 'no-filter',
                name: 'No Exclusions',
                description: 'Process all items without any exclusions',
                isDefault: true,
                isSystem: true,
                filters: {
                    productIds: {
                        patterns: [],
                        regexPatterns: []
                    },
                    descriptions: {
                        patterns: [],
                        regexPatterns: []
                    },
                    productTypes: {
                        exact: [],
                        patterns: []
                    }
                },
                stats: {
                    usageCount: 0,
                    lastUsed: null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            }
        ];
    }

    async ensureDefaultFilters() {
        try {
            const data = await this.loadFromFile();
            let updated = false;

            for (const defaultFilter of this.defaultFilters) {
                const exists = data.filterSets?.some(f => f.id === defaultFilter.id);
                if (!exists) {
                    if (!data.filterSets) data.filterSets = [];
                    data.filterSets.push(defaultFilter);
                    updated = true;
                }
            }

            if (updated) {
                await this.saveToFile(data);
            }
        } catch (error) {
            console.error('Error ensuring default filters:', error);
        }
    }

    async loadFromFile() {
        try {
            const data = await fs.readFile(this.filtersFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading Phase 1 filters:', error);
            return { filterSets: [], activeFilterId: null };
        }
    }

    async saveToFile(data) {
        try {
            await fs.writeFile(
                this.filtersFile, 
                JSON.stringify(data, null, 2),
                'utf8'
            );
            console.log('Phase 1 filters saved');
        } catch (error) {
            console.error('Error saving Phase 1 filters:', error);
            throw error;
        }
    }

    async getAllFilterSets() {
        try {
            const data = await this.loadFromFile();
            return data.filterSets || [];
        } catch (error) {
            console.error('Error getting filter sets:', error);
            return [];
        }
    }

    async getFilterSet(filterId) {
        try {
            const data = await this.loadFromFile();
            return data.filterSets?.find(f => f.id === filterId) || null;
        } catch (error) {
            console.error('Error getting filter set:', error);
            return null;
        }
    }

    async createFilterSet(filterData) {
        try {
            const data = await this.loadFromFile();
            
            const newFilterSet = {
                id: uuidv4(),
                name: filterData.name,
                description: filterData.description || '',
                isDefault: false,
                isSystem: false,
                filters: filterData.filters || {
                    productIds: { patterns: [], regexPatterns: [] },
                    descriptions: { patterns: [], regexPatterns: [] },
                    productTypes: { exact: [], patterns: [] }
                },
                stats: {
                    usageCount: 0,
                    lastUsed: null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
            
            if (!data.filterSets) data.filterSets = [];
            data.filterSets.push(newFilterSet);
            
            await this.saveToFile(data);
            
            return {
                success: true,
                filterSet: newFilterSet
            };
        } catch (error) {
            console.error('Error creating filter set:', error);
            throw error;
        }
    }

    async updateFilterSet(filterId, updates) {
        try {
            const data = await this.loadFromFile();
            const index = data.filterSets?.findIndex(f => f.id === filterId);
            
            if (index === -1) {
                return { success: false, error: 'Filter set not found' };
            }
            
            if (data.filterSets[index].isSystem) {
                return { success: false, error: 'Cannot modify system filter sets' };
            }
            
            data.filterSets[index] = {
                ...data.filterSets[index],
                ...updates,
                id: filterId,
                isSystem: false,
                stats: {
                    ...data.filterSets[index].stats,
                    updatedAt: new Date().toISOString()
                }
            };
            
            await this.saveToFile(data);
            
            return {
                success: true,
                filterSet: data.filterSets[index]
            };
        } catch (error) {
            console.error('Error updating filter set:', error);
            throw error;
        }
    }

    async deleteFilterSet(filterId) {
        try {
            const data = await this.loadFromFile();
            const filter = data.filterSets?.find(f => f.id === filterId);
            
            if (!filter) {
                return { success: false, error: 'Filter set not found' };
            }
            
            if (filter.isSystem) {
                return { success: false, error: 'Cannot delete system filter sets' };
            }
            
            data.filterSets = data.filterSets.filter(f => f.id !== filterId);
            
            if (data.activeFilterId === filterId) {
                data.activeFilterId = null;
            }
            
            await this.saveToFile(data);
            
            return { success: true };
        } catch (error) {
            console.error('Error deleting filter set:', error);
            throw error;
        }
    }

    async setActiveFilter(filterId) {
        try {
            const data = await this.loadFromFile();
            
            const filter = data.filterSets?.find(f => f.id === filterId);
            if (!filter && filterId !== null) {
                return { success: false, error: 'Filter set not found' };
            }
            
            data.activeFilterId = filterId;
            await this.saveToFile(data);
            
            if (filterId) {
                await this.recordFilterUse(filterId);
            }
            
            return { success: true, activeFilterId: filterId };
        } catch (error) {
            console.error('Error setting active filter:', error);
            throw error;
        }
    }

    async getActiveFilter() {
        try {
            const data = await this.loadFromFile();
            if (!data.activeFilterId) return null;
            
            return data.filterSets?.find(f => f.id === data.activeFilterId) || null;
        } catch (error) {
            console.error('Error getting active filter:', error);
            return null;
        }
    }

    async recordFilterUse(filterId) {
        try {
            const data = await this.loadFromFile();
            const filter = data.filterSets?.find(f => f.id === filterId);
            
            if (filter) {
                filter.stats.usageCount++;
                filter.stats.lastUsed = new Date().toISOString();
                await this.saveToFile(data);
            }
        } catch (error) {
            console.error('Error recording filter use:', error);
        }
    }

    // FIXED PATTERN MATCHING - SIMPLE AND WORKING
    matchesWildcard(text, pattern) {
        if (!text || !pattern) return false;
        
        // Convert to uppercase strings for case-insensitive comparison
        text = String(text).toUpperCase().trim();
        pattern = String(pattern).toUpperCase().trim();
        
        // Don't filter empty values
        if (text === '-' || text === '') return false;
        
        // Pattern *SOMETHING* means contains SOMETHING
        if (pattern.startsWith('*') && pattern.endsWith('*')) {
            const searchTerm = pattern.slice(1, -1);
            if (searchTerm === '') return true;
            const matches = text.includes(searchTerm);
            
            // Debug log for PWR/CAB/FAN patterns
            if (searchTerm === 'PWR' || searchTerm === 'CAB-' || searchTerm === 'FAN') {
                console.log(`  Pattern check: Does "${text}" contain "${searchTerm}"? ${matches}`);
            }
            
            return matches;
        }
        
        // Pattern SOMETHING* means starts with SOMETHING
        if (pattern.endsWith('*')) {
            const searchTerm = pattern.slice(0, -1);
            return text.startsWith(searchTerm);
        }
        
        // Pattern *SOMETHING means ends with SOMETHING
        if (pattern.startsWith('*')) {
            const searchTerm = pattern.slice(1);
            return text.endsWith(searchTerm);
        }
        
        // No wildcards means exact match
        return text === pattern;
    }

    matchesProductIdFilter(productId, filter) {
        if (!productId || !filter) return false;
        if (productId === '-' || productId === '') return false;
        
        // Check wildcard patterns
        if (filter.patterns && filter.patterns.length > 0) {
            for (const pattern of filter.patterns) {
                if (this.matchesWildcard(productId, pattern)) {
                    console.log(`    EXCLUDING by Product ID: "${productId}" matches pattern "${pattern}"`);
                    return true;
                }
            }
        }
        
        return false;
    }

    matchesDescriptionFilter(description, filter) {
        if (!description || !filter) return false;
        if (description === '-' || description === '') return false;
        
        // Check wildcard patterns
        if (filter.patterns && filter.patterns.length > 0) {
            for (const pattern of filter.patterns) {
                if (this.matchesWildcard(description, pattern)) {
                    console.log(`    EXCLUDING by Description: "${description.substring(0, 50)}..." matches pattern "${pattern}"`);
                    return true;
                }
            }
        }
        
        return false;
    }

    matchesProductTypeFilter(productType, filter) {
        if (!productType || !filter) return false;
        
        const normalizedType = productType.toLowerCase().trim();
        
        // Check exact matches (case-insensitive)
        if (filter.exact && filter.exact.length > 0) {
            for (const exactType of filter.exact) {
                if (normalizedType === exactType.toLowerCase()) {
                    console.log(`    EXCLUDING by Type (exact): "${productType}" matches "${exactType}"`);
                    return true;
                }
            }
        }
        
        // Check wildcard patterns
        if (filter.patterns && filter.patterns.length > 0) {
            for (const pattern of filter.patterns) {
                if (this.matchesWildcard(productType, pattern)) {
                    console.log(`    EXCLUDING by Type (pattern): "${productType}" matches pattern "${pattern}"`);
                    return true;
                }
            }
        }
        
        return false;
    }

    // Apply filters to data
    applyFilters(data, filterSet) {
        if (!filterSet || !filterSet.filters) {
            return data;
        }

        const { productIds, descriptions, productTypes } = filterSet.filters;
        
        console.log('\nApplying filters to', data.length, 'items...');
        
        let excludedCount = 0;
        const filtered = data.filter(item => {
            const shouldExclude = 
                this.matchesProductIdFilter(item.product_id, productIds) ||
                this.matchesDescriptionFilter(item.description, descriptions) ||
                this.matchesProductTypeFilter(item.type || item.product_type, productTypes);
            
            if (shouldExclude) {
                excludedCount++;
                if (excludedCount <= 5) {
                    console.log(`  Excluding item #${item.id}: ${item.product_id} (Type: ${item.type})`);
                }
            }
            
            return !shouldExclude;
        });
        
        console.log(`Filter complete: ${data.length} → ${filtered.length} (${excludedCount} excluded)\n`);
        
        return filtered;
    }

    // Get filter statistics
    async getFilterStats(filterId, data) {
        try {
            const filterSet = await this.getFilterSet(filterId);
            if (!filterSet) return null;
            
            const originalCount = data.length;
            const filteredData = this.applyFilters(data, filterSet);
            const filteredCount = filteredData.length;
            const excludedCount = originalCount - filteredCount;
            
            // Calculate what was excluded by category
            const excluded = {
                byProductId: 0,
                byDescription: 0,
                byType: 0
            };
            
            const filteredIds = new Set(filteredData.map(item => item.id));
            
            data.forEach(item => {
                if (!filteredIds.has(item.id)) {
                    // Test each filter type to see why it was excluded
                    if (this.matchesProductIdFilter(item.product_id, filterSet.filters.productIds)) {
                        excluded.byProductId++;
                    } else if (this.matchesDescriptionFilter(item.description, filterSet.filters.descriptions)) {
                        excluded.byDescription++;
                    } else if (this.matchesProductTypeFilter(item.type || item.product_type, filterSet.filters.productTypes)) {
                        excluded.byType++;
                    }
                }
            });
            
            return {
                originalCount,
                filteredCount,
                excludedCount,
                excludedPercentage: ((excludedCount / originalCount) * 100).toFixed(1),
                excluded
            };
        } catch (error) {
            console.error('Error getting filter stats:', error);
            return null;
        }
    }
}

// Export singleton instance
module.exports = new Phase1FilterService();