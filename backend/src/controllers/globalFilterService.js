// backend/src/services/globalFilterService.js
// SIMPLIFIED VERSION - Global filters accessible by name only

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class GlobalFilterService {
    constructor() {
        this.dataDir = path.join(__dirname, '../../../data');
        this.filtersFile = path.join(this.dataDir, 'global_filters.json');
        
        this.initializeStorage();
    }

    async initializeStorage() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
            
            try {
                await fs.access(this.filtersFile);
            } catch {
                // Initialize with empty filters object
                await this.saveToFile({});
                console.log('Initialized global filters file');
            }
        } catch (error) {
            console.error('Failed to initialize filter storage:', error);
        }
    }

    async loadAllFilters() {
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
            await fs.writeFile(
                this.filtersFile, 
                JSON.stringify(data, null, 2),
                'utf8'
            );
            console.log('Global filters saved');
        } catch (error) {
            console.error('Error saving filters:', error);
            throw error;
        }
    }

    // Save or update a filter by name
    async saveFilter(filterName, filterConfig) {
        try {
            const allFilters = await this.loadAllFilters();
            
            // Filter name is the unique key
            allFilters[filterName] = {
                name: filterName,
                config: filterConfig,
                createdAt: allFilters[filterName]?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                usageCount: allFilters[filterName]?.usageCount || 0
            };
            
            await this.saveToFile(allFilters);
            
            return {
                success: true,
                filter: allFilters[filterName]
            };
        } catch (error) {
            console.error('Error saving filter:', error);
            throw error;
        }
    }

    // Get a filter by name
    async getFilter(filterName) {
        try {
            const allFilters = await this.loadAllFilters();
            return allFilters[filterName] || null;
        } catch (error) {
            console.error('Error getting filter:', error);
            return null;
        }
    }

    // Get all filter names
    async getAllFilterNames() {
        try {
            const allFilters = await this.loadAllFilters();
            return Object.keys(allFilters);
        } catch (error) {
            console.error('Error getting filter names:', error);
            return [];
        }
    }

    // Delete a filter by name
    async deleteFilter(filterName) {
        try {
            const allFilters = await this.loadAllFilters();
            
            if (!allFilters[filterName]) {
                return false;
            }
            
            delete allFilters[filterName];
            await this.saveToFile(allFilters);
            
            return true;
        } catch (error) {
            console.error('Error deleting filter:', error);
            return false;
        }
    }

    // Track filter usage
    async recordFilterUse(filterName) {
        try {
            const allFilters = await this.loadAllFilters();
            
            if (allFilters[filterName]) {
                allFilters[filterName].usageCount++;
                allFilters[filterName].lastUsed = new Date().toISOString();
                await this.saveToFile(allFilters);
            }
        } catch (error) {
            console.error('Error recording filter use:', error);
        }
    }
}

// Export singleton instance
module.exports = new GlobalFilterService();