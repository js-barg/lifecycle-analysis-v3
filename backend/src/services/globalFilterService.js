const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

class GlobalFilterService {
    constructor() {
        // Fix the path - go up two levels from services folder
        this.dataDir = path.join(__dirname, '../../data');
        this.filtersFile = path.join(this.dataDir, 'global_filters.json');
        
        console.log('Data directory:', this.dataDir);
        console.log('Filters file:', this.filtersFile);
        
        // Use synchronous initialization to ensure file exists before any operations
        this.initializeStorageSync();
    }

    initializeStorageSync() {
        try {
            // Create directory synchronously
            if (!fs.existsSync(this.dataDir)) {
                fs.mkdirSync(this.dataDir, { recursive: true });
                console.log('Created data directory:', this.dataDir);
            }
            
            // Create file synchronously if it doesn't exist
            if (!fs.existsSync(this.filtersFile)) {
                fs.writeFileSync(this.filtersFile, '{}', 'utf8');
                console.log('Created filters file:', this.filtersFile);
            }
        } catch (error) {
            console.error('Failed to initialize filter storage:', error);
        }
    }
    
    async loadAllFilters() {
        try {
            if (!fs.existsSync(this.filtersFile)) {
                console.log('Filters file does not exist, returning empty object');
                return {};
            }
            const data = await fsPromises.readFile(this.filtersFile, 'utf8');
            const filters = JSON.parse(data);
            console.log('Loaded filters:', Object.keys(filters));
            return filters;
        } catch (error) {
            console.error('Error loading filters:', error);
            return {};
        }
    }
    
    async saveToFile(data) {
        try {
            await fsPromises.writeFile(
                this.filtersFile, 
                JSON.stringify(data, null, 2),
                'utf8'
            );
            console.log('Filters saved to:', this.filtersFile);
            console.log('Saved filters:', Object.keys(data));
        } catch (error) {
            console.error('Error saving filters:', error);
            throw error;
        }
    }

    async saveFilter(filterName, filterConfig) {
        try {
            const allFilters = await this.loadAllFilters();
            console.log('Current filters before save:', Object.keys(allFilters));
            
            allFilters[filterName] = {
                name: filterName,
                config: filterConfig,
                createdAt: allFilters[filterName]?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                usageCount: allFilters[filterName]?.usageCount || 0
            };
            
            console.log('Saving filter:', filterName);
            console.log('Total filters after add:', Object.keys(allFilters).length);
            
            await this.saveToFile(allFilters);
            console.log('Filter saved successfully to file');
            
            // Verify it was saved
            const verification = await this.loadAllFilters();
            console.log('Verification - filters in file:', Object.keys(verification));
            
            return {
                success: true,
                filter: allFilters[filterName]
            };
        } catch (error) {
            console.error('Error in saveFilter:', error);
            throw error;
        }
    }

    async getAllFilters() {
        try {
            const filters = await this.loadAllFilters();
            // Convert to array format for frontend
            const filterArray = Object.values(filters).map(filter => ({
                ...filter,
                value: filter.name // Add value field for dropdown compatibility
            }));
            console.log('Returning filters to frontend:', filterArray.length);
            return filterArray;
        } catch (error) {
            console.error('Error in getAllFilters:', error);
            return [];
        }
    }

    async getFilter(filterName) {
        try {
            const filters = await this.loadAllFilters();
            return filters[filterName] || null;
        } catch (error) {
            console.error('Error in getFilter:', error);
            return null;
        }
    }

    async deleteFilter(filterName) {
        try {
            const filters = await this.loadAllFilters();
            if (filters[filterName]) {
                delete filters[filterName];
                await this.saveToFile(filters);
                return { success: true };
            }
            return { success: false, error: 'Filter not found' };
        } catch (error) {
            console.error('Error in deleteFilter:', error);
            return { success: false, error: error.message };
        }
    }

    async updateFilterUsage(filterName) {
        try {
            const filters = await this.loadAllFilters();
            if (filters[filterName]) {
                filters[filterName].usageCount = (filters[filterName].usageCount || 0) + 1;
                filters[filterName].lastUsed = new Date().toISOString();
                await this.saveToFile(filters);
            }
        } catch (error) {
            console.error('Error updating filter usage:', error);
        }
    }
}

module.exports = new GlobalFilterService();