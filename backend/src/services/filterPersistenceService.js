// backend/src/services/filterPersistenceService.js
// Complete filter persistence service for Phase 2

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class FilterPersistenceService {
    constructor() {
        // Create data directory structure
        this.dataDir = path.join(__dirname, '../../../data');
        this.filtersDir = path.join(this.dataDir, 'filters');
        this.filtersFile = path.join(this.filtersDir, 'phase2_filters.json');
        
        // Initialize directories on service creation
        this.initializeStorage();
    }

    async initializeStorage() {
        try {
            // Create directories if they don't exist
            await fs.mkdir(this.dataDir, { recursive: true });
            await fs.mkdir(this.filtersDir, { recursive: true });
            
            // Initialize filters file if it doesn't exist
            try {
                await fs.access(this.filtersFile);
            } catch {
                await this.saveToFile({});
                console.log('Initialized empty filters file');
            }
        } catch (error) {
            console.error('Failed to initialize filter storage:', error);
        }
    }

    async loadFromFile() {
        try {
            const data = await fs.readFile(this.filtersFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading filters:', error);
            return {};
        }
    }

    async saveToFile(data) {
        try {
            // Create backup before saving
            await this.createBackup();
            
            // Save with pretty formatting for readability
            await fs.writeFile(
                this.filtersFile, 
                JSON.stringify(data, null, 2),
                'utf8'
            );
            console.log('Filters saved successfully');
        } catch (error) {
            console.error('Error saving filters:', error);
            throw error;
        }
    }

    async createBackup() {
        try {
            const backupDir = path.join(this.filtersDir, 'backups');
            await fs.mkdir(backupDir, { recursive: true });
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(backupDir, `filters_backup_${timestamp}.json`);
            
            // Copy current file to backup if it exists
            try {
                const currentData = await fs.readFile(this.filtersFile, 'utf8');
                await fs.writeFile(backupFile, currentData, 'utf8');
                
                // Keep only last 10 backups
                await this.cleanOldBackups(backupDir, 10);
            } catch {
                // No existing file to backup
            }
        } catch (error) {
            console.error('Backup creation failed:', error);
        }
    }

    async cleanOldBackups(backupDir, keepCount) {
        try {
            const files = await fs.readdir(backupDir);
            const backupFiles = files
                .filter(f => f.startsWith('filters_backup_'))
                .sort()
                .reverse();
            
            // Delete old backups
            for (let i = keepCount; i < backupFiles.length; i++) {
                await fs.unlink(path.join(backupDir, backupFiles[i]));
            }
        } catch (error) {
            console.error('Failed to clean old backups:', error);
        }
    }

    getFilterKey(customerName, jobId) {
        // Use customer name as primary key, job as secondary
        const safeCustomerName = (customerName || 'default')
            .replace(/[^a-z0-9]/gi, '_')
            .toLowerCase();
        return `${safeCustomerName}_${jobId}`;
    }

    async saveFilter(customerName, jobId, filterData) {
        try {
            const allFilters = await this.loadFromFile();
            const filterKey = this.getFilterKey(customerName, jobId);
            
            // Initialize customer filters if needed
            if (!allFilters[filterKey]) {
                allFilters[filterKey] = {
                    customerName,
                    jobId,
                    filters: [],
                    defaultFilterId: null,
                    lastUpdated: new Date().toISOString()
                };
            }

            const { name, description, filters, settings } = filterData;
            
            // Check for duplicate names
            const existingIndex = allFilters[filterKey].filters
                .findIndex(f => f.name === name);
            
            if (existingIndex >= 0) {
                // Update existing filter
                allFilters[filterKey].filters[existingIndex] = {
                    ...allFilters[filterKey].filters[existingIndex],
                    name,
                    description: description || '',
                    filters,
                    settings: settings || {},
                    updatedAt: new Date().toISOString()
                };
                
                await this.saveToFile(allFilters);
                return {
                    success: true,
                    filter: allFilters[filterKey].filters[existingIndex],
                    updated: true
                };
            } else {
                // Create new filter
                const newFilter = {
                    id: uuidv4(),
                    name,
                    description: description || '',
                    filters,
                    settings: settings || {
                        is_default: false,
                        is_shared: true,
                        auto_apply: false
                    },
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    createdBy: 'user',
                    usageCount: 0,
                    lastUsed: null
                };
                
                allFilters[filterKey].filters.push(newFilter);
                
                // Set as default if requested
                if (settings?.is_default) {
                    allFilters[filterKey].defaultFilterId = newFilter.id;
                }
                
                allFilters[filterKey].lastUpdated = new Date().toISOString();
                
                await this.saveToFile(allFilters);
                return {
                    success: true,
                    filter: newFilter,
                    updated: false
                };
            }
        } catch (error) {
            console.error('Error saving filter:', error);
            throw error;
        }
    }

    async loadFilters(customerName, jobId) {
        try {
            const allFilters = await this.loadFromFile();
            const filterKey = this.getFilterKey(customerName, jobId);
            const customerFilters = allFilters[filterKey] || {};
            
            return {
                filters: customerFilters.filters || [],
                defaultFilterId: customerFilters.defaultFilterId || null
            };
        } catch (error) {
            console.error('Error loading filters:', error);
            return {
                filters: [],
                defaultFilterId: null
            };
        }
    }

    async deleteFilter(customerName, jobId, filterId) {
        try {
            const allFilters = await this.loadFromFile();
            const filterKey = this.getFilterKey(customerName, jobId);
            
            if (!allFilters[filterKey]) {
                return false;
            }
            
            const initialLength = allFilters[filterKey].filters.length;
            allFilters[filterKey].filters = allFilters[filterKey].filters
                .filter(f => f.id !== filterId);
            
            // Clear default if this was the default filter
            if (allFilters[filterKey].defaultFilterId === filterId) {
                allFilters[filterKey].defaultFilterId = null;
            }
            
            allFilters[filterKey].lastUpdated = new Date().toISOString();
            
            await this.saveToFile(allFilters);
            
            return allFilters[filterKey].filters.length < initialLength;
        } catch (error) {
            console.error('Error deleting filter:', error);
            return false;
        }
    }

    async applyFilter(customerName, jobId, filterId) {
        try {
            const allFilters = await this.loadFromFile();
            const filterKey = this.getFilterKey(customerName, jobId);
            
            if (!allFilters[filterKey]) {
                return null;
            }
            
            const filter = allFilters[filterKey].filters
                .find(f => f.id === filterId);
            
            if (filter) {
                // Update usage statistics
                filter.usageCount = (filter.usageCount || 0) + 1;
                filter.lastUsed = new Date().toISOString();
                
                await this.saveToFile(allFilters);
                return filter;
            }
            
            return null;
        } catch (error) {
            console.error('Error applying filter:', error);
            return null;
        }
    }

    async setDefaultFilter(customerName, jobId, filterId) {
        try {
            const allFilters = await this.loadFromFile();
            const filterKey = this.getFilterKey(customerName, jobId);
            
            if (!allFilters[filterKey]) {
                return false;
            }
            
            // Verify filter exists
            const filterExists = allFilters[filterKey].filters
                .some(f => f.id === filterId);
            
            if (filterExists) {
                allFilters[filterKey].defaultFilterId = filterId;
                allFilters[filterKey].lastUpdated = new Date().toISOString();
                
                await this.saveToFile(allFilters);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error setting default filter:', error);
            return false;
        }
    }

    async exportFilters(customerName, jobId) {
        try {
            const { filters } = await this.loadFilters(customerName, jobId);
            const exportData = {
                customerName,
                jobId,
                exportDate: new Date().toISOString(),
                filterCount: filters.length,
                filters: filters.map(f => ({
                    name: f.name,
                    description: f.description,
                    filters: f.filters,
                    createdAt: f.createdAt,
                    usageCount: f.usageCount
                }))
            };
            
            return exportData;
        } catch (error) {
            console.error('Error exporting filters:', error);
            throw error;
        }
    }

    async importFilters(customerName, jobId, importData) {
        try {
            const allFilters = await this.loadFromFile();
            const filterKey = this.getFilterKey(customerName, jobId);
            
            if (!allFilters[filterKey]) {
                allFilters[filterKey] = {
                    customerName,
                    jobId,
                    filters: [],
                    defaultFilterId: null,
                    lastUpdated: new Date().toISOString()
                };
            }
            
            // Import each filter with new IDs to avoid conflicts
            let importedCount = 0;
            for (const filter of importData.filters) {
                const newFilter = {
                    ...filter,
                    id: uuidv4(),
                    name: `${filter.name} (Imported)`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    createdBy: 'import',
                    usageCount: 0,
                    lastUsed: null
                };
                
                allFilters[filterKey].filters.push(newFilter);
                importedCount++;
            }
            
            allFilters[filterKey].lastUpdated = new Date().toISOString();
            
            await this.saveToFile(allFilters);
            
            return {
                success: true,
                importedCount
            };
        } catch (error) {
            console.error('Error importing filters:', error);
            throw error;
        }
    }

    // Utility method to migrate from old format if needed
    async migrateOldFilters() {
        try {
            const oldFiltersFile = path.join(this.dataDir, 'filters.json');
            
            // Check if old file exists
            try {
                await fs.access(oldFiltersFile);
            } catch {
                // No old file to migrate
                return;
            }
            
            const oldData = JSON.parse(await fs.readFile(oldFiltersFile, 'utf8'));
            const newData = {};
            
            // Convert old format to new format
            for (const [key, value] of Object.entries(oldData)) {
                newData[key] = {
                    ...value,
                    lastUpdated: value.lastUpdated || new Date().toISOString()
                };
            }
            
            await this.saveToFile(newData);
            
            // Rename old file to backup
            await fs.rename(oldFiltersFile, `${oldFiltersFile}.backup`);
            
            console.log('Successfully migrated old filters to new format');
        } catch (error) {
            console.error('Filter migration failed:', error);
        }
    }
}

// Export singleton instance
module.exports = new FilterPersistenceService();