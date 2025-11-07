// backend/src/utils/manufacturerIdentifier.js
// Scalable manufacturer identification using JSON configuration

const fs = require('fs');
const path = require('path');

class ManufacturerIdentifier {
  constructor() {
    this.manufacturers = [];
    this.loadManufacturers();
  }

  loadManufacturers() {
    try {
      const manufacturersPath = path.join(__dirname, '../../data/manufacturers.json');
      const manufacturersData = fs.readFileSync(manufacturersPath, 'utf8');
      const loadedData = JSON.parse(manufacturersData);
      
      // Sort by priority (lower number = higher priority)
      this.manufacturers = (loadedData.manufacturers || []).sort((a, b) => a.priority - b.priority);
      
      console.log(`Loaded ${this.manufacturers.length} manufacturer patterns`);
    } catch (error) {
      console.log('No manufacturers.json file found or error loading it:', error.message);
      console.log('Using default manufacturers');
      
      // Fallback to basic manufacturers if file doesn't exist
      this.manufacturers = [
        {
          name: 'Cisco',
          patterns: {
            keywords: ['cisco'],
            productPrefixes: ['WS-', 'N9K-', 'ASA', 'AIR-']
          }
        },
        {
          name: 'HPE',
          patterns: {
            keywords: ['hp', 'hewlett'],
            productPrefixes: ['J9', 'J8']
          }
        },
        {
          name: 'Dell',
          patterns: {
            keywords: ['dell'],
            productPrefixes: ['R6', 'R7']
          }
        }
      ];
    }
  }

  identifyManufacturer(row) {
    // Prepare search strings
    const searchString = `${row.product_id || ''} ${row.description || ''}`.toLowerCase();
    const productId = (row.product_id || '').toUpperCase();
    const description = (row.description || '').toLowerCase();
    
    // Check each manufacturer in priority order
    for (const mfr of this.manufacturers) {
      const patterns = mfr.patterns || {};
      
      // Check keywords (case-insensitive partial match)
      if (patterns.keywords && patterns.keywords.length > 0) {
        for (const keyword of patterns.keywords) {
          if (searchString.includes(keyword.toLowerCase())) {
            return mfr.name;
          }
        }
      }
      
      // Check product ID prefixes (case-insensitive starts with)
      if (patterns.productPrefixes && patterns.productPrefixes.length > 0) {
        for (const prefix of patterns.productPrefixes) {
          if (productId.startsWith(prefix.toUpperCase())) {
            return mfr.name;
          }
        }
      }
      
      // Check product ID contains (case-insensitive substring)
      if (patterns.productContains && patterns.productContains.length > 0) {
        for (const pattern of patterns.productContains) {
          if (productId.includes(pattern.toUpperCase())) {
            return mfr.name;
          }
        }
      }
      
      // Check description patterns (case-insensitive partial match)
      if (patterns.descriptionPatterns && patterns.descriptionPatterns.length > 0) {
        for (const pattern of patterns.descriptionPatterns) {
          if (description.includes(pattern.toLowerCase())) {
            return mfr.name;
          }
        }
      }
    }
    
    return 'Unknown';
  }

  getManufacturerConfidence(row, manufacturer) {
    if (manufacturer === 'Unknown') return 0;
    
    // Higher confidence if multiple patterns match
    let matchCount = 0;
    const searchString = `${row.product_id || ''} ${row.description || ''}`.toLowerCase();
    const productId = (row.product_id || '').toUpperCase();
    
    // Find the manufacturer config
    const mfr = this.manufacturers.find(m => m.name === manufacturer);
    if (!mfr) return 50;
    
    const patterns = mfr.patterns || {};
    
    // Count keyword matches
    if (patterns.keywords) {
      matchCount += patterns.keywords.filter(kw => searchString.includes(kw.toLowerCase())).length;
    }
    
    // Count prefix matches
    if (patterns.productPrefixes) {
      matchCount += patterns.productPrefixes.filter(prefix => productId.startsWith(prefix.toUpperCase())).length;
    }
    
    // Count contains matches
    if (patterns.productContains) {
      matchCount += patterns.productContains.filter(pattern => productId.includes(pattern.toUpperCase())).length;
    }
    
    // More matches = higher confidence
    if (matchCount >= 3) return 95;
    if (matchCount >= 2) return 85;
    if (matchCount >= 1) return 75;
    
    return 50;
  }

  // Reload manufacturers from file (useful if file is updated while running)
  reloadManufacturers() {
    this.loadManufacturers();
  }

  // Get statistics about manufacturer identification
  getStats(rows) {
    const stats = {
      total: rows.length,
      identified: 0,
      unknown: 0,
      byManufacturer: {}
    };
    
    for (const row of rows) {
      const manufacturer = this.identifyManufacturer(row);
      if (manufacturer !== 'Unknown') {
        stats.identified++;
        stats.byManufacturer[manufacturer] = (stats.byManufacturer[manufacturer] || 0) + 1;
      } else {
        stats.unknown++;
      }
    }
    
    stats.identificationRate = ((stats.identified / stats.total) * 100).toFixed(1) + '%';
    
    return stats;
  }
}

// Create singleton instance
const identifier = new ManufacturerIdentifier();

// Export the functions for backward compatibility
module.exports = {
  identifyManufacturer: (row) => identifier.identifyManufacturer(row),
  getManufacturerConfidence: (row, manufacturer) => identifier.getManufacturerConfidence(row, manufacturer),
  reloadManufacturers: () => identifier.reloadManufacturers(),
  getStats: (rows) => identifier.getStats(rows)
};