// aiResearchCacheService.js
// Service for managing AI research result caching
// Reduces redundant API calls by storing and reusing previous research results

const db = require('../database/dbConnection');

class AIResearchCacheService {
  constructor() {
    // Cache validity duration: 1 year in milliseconds
    this.CACHE_VALIDITY_MS = 365 * 24 * 60 * 60 * 1000;
    
    // Confidence boost for using cached data
    this.CACHED_CONFIDENCE_BOOST = 2;
  }

  /**
   * Check if valid cached research exists for a product
   * @param {string} manufacturer - Product manufacturer
   * @param {string} partNumber - Product part number
   * @returns {Object|null} Cached data if valid, null otherwise
   */
  async getCachedResearch(manufacturer, partNumber) {
    if (!manufacturer || !partNumber) {
      return null;
    }

    try {
      // Normalize for case-insensitive lookup
      const normalizedMfg = manufacturer.trim().toLowerCase();
      const normalizedPart = partNumber.trim().toUpperCase();

      const query = `
        SELECT 
          cache_id,
          manufacturer,
          part_number,
          date_introduced,
          end_of_sale_date,
          end_of_sw_maintenance_date,
          end_of_sw_vulnerability_maintenance_date,
          last_day_of_support_date,
          research_source,
          research_date,
          data_sources,
          confidence_score,
          estimation_metadata,
          created_at,
          updated_at
        FROM ai_research_cache
        WHERE LOWER(manufacturer) = $1 
          AND LOWER(part_number) = $2
        ORDER BY research_date DESC
        LIMIT 1
      `;

      const result = await db.query(query, [normalizedMfg, normalizedPart.toLowerCase()]);

      if (result.rows.length === 0) {
        console.log(`📭 No cache found for ${manufacturer} ${partNumber}`);
        return null;
      }

      const cacheEntry = result.rows[0];
      const cacheAge = Date.now() - new Date(cacheEntry.research_date).getTime();

      // Check if cache is still valid (less than 1 year old)
      if (cacheAge > this.CACHE_VALIDITY_MS) {
        console.log(`⏰ Cache expired for ${manufacturer} ${partNumber} (${Math.floor(cacheAge / (24 * 60 * 60 * 1000))} days old)`);
        return {
          ...cacheEntry,
          isExpired: true,
          cacheAge: cacheAge
        };
      }

      console.log(`✅ Valid cache found for ${manufacturer} ${partNumber} (${Math.floor(cacheAge / (24 * 60 * 60 * 1000))} days old)`);
      
      // Apply confidence boost for cached data
      cacheEntry.confidence_score = Math.min(100, (cacheEntry.confidence_score || 90) + this.CACHED_CONFIDENCE_BOOST);
      cacheEntry.fromCache = true;
      cacheEntry.cacheAge = cacheAge;

      return cacheEntry;

    } catch (error) {
      console.error('Error retrieving cache:', error);
      return null;
    }
  }

  /**
   * Store new research results in cache
   * @param {Object} researchData - Research results to cache
   * @returns {boolean} Success status
   */
  async saveToCache(researchData) {
    if (!researchData.manufacturer || !researchData.product_id) {
      console.warn('Cannot cache: missing manufacturer or product_id');
      return false;
    }

    try {
      const query = `
        INSERT INTO ai_research_cache (
          manufacturer,
          part_number,
          date_introduced,
          end_of_sale_date,
          end_of_sw_maintenance_date,
          end_of_sw_vulnerability_maintenance_date,
          last_day_of_support_date,
          research_source,
          research_date,
          data_sources,
          confidence_score,
          estimation_metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (manufacturer, part_number) 
        DO UPDATE SET
          date_introduced = EXCLUDED.date_introduced,
          end_of_sale_date = EXCLUDED.end_of_sale_date,
          end_of_sw_maintenance_date = EXCLUDED.end_of_sw_maintenance_date,
          end_of_sw_vulnerability_maintenance_date = EXCLUDED.end_of_sw_vulnerability_maintenance_date,
          last_day_of_support_date = EXCLUDED.last_day_of_support_date,
          research_source = EXCLUDED.research_source,
          research_date = EXCLUDED.research_date,
          data_sources = EXCLUDED.data_sources,
          confidence_score = EXCLUDED.confidence_score,
          estimation_metadata = EXCLUDED.estimation_metadata,
          updated_at = CURRENT_TIMESTAMP
      `;

      // Determine research source
      let researchSource = 'AI Research';
      if (researchData.data_sources) {
        try {
          const sources = typeof researchData.data_sources === 'string' 
            ? JSON.parse(researchData.data_sources) 
            : researchData.data_sources;
          
          // If we have vendor site sources, try to extract the primary URL
          if (sources.vendor_site && sources.vendor_site > 0 && researchData.searchResults) {
            // Extract first vendor URL from search results if available
            const vendorUrls = researchData.searchResults
              .filter(r => r.link && r.link.includes('.com'))
              .map(r => r.link);
            if (vendorUrls.length > 0) {
              researchSource = vendorUrls[0];
            }
          }
        } catch (e) {
          console.warn('Could not parse data sources:', e);
        }
      }

      const values = [
        researchData.manufacturer.trim(),
        researchData.product_id.trim().toUpperCase(),
        this.formatDate(researchData.date_introduced),
        this.formatDate(researchData.end_of_sale_date),
        this.formatDate(researchData.end_of_sw_maintenance_date),
        this.formatDate(researchData.end_of_sw_vulnerability_maintenance_date),
        this.formatDate(researchData.last_day_of_support_date),
        researchSource,
        new Date(), // research_date
        this.formatJsonb(researchData.data_sources),
        researchData.overall_confidence || researchData.lifecycle_confidence || 90,
        this.formatJsonb(researchData.estimation_metadata)
      ];

      await db.query(query, values);
      console.log(`💾 Cached research for ${researchData.manufacturer} ${researchData.product_id}`);
      return true;

    } catch (error) {
      console.error('Error saving to cache:', error);
      return false;
    }
  }

  /**
   * Update existing cache entry
   * @param {string} cacheId - Cache entry ID
   * @param {Object} updates - Updated data
   * @returns {boolean} Success status
   */
  async updateCache(cacheId, updates) {
    try {
      const setClause = [];
      const values = [];
      let paramCount = 1;

      // Build dynamic update query
      Object.keys(updates).forEach(key => {
        if (key !== 'cache_id' && updates[key] !== undefined) {
          setClause.push(`${key} = $${paramCount}`);
          values.push(updates[key]);
          paramCount++;
        }
      });

      if (setClause.length === 0) {
        return true; // Nothing to update
      }

      values.push(cacheId);
      const query = `
        UPDATE ai_research_cache 
        SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE cache_id = $${paramCount}
      `;

      await db.query(query, values);
      return true;

    } catch (error) {
      console.error('Error updating cache:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  async getCacheStats() {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_entries,
          COUNT(CASE WHEN research_date > CURRENT_TIMESTAMP - INTERVAL '1 year' THEN 1 END) as fresh_entries,
          COUNT(CASE WHEN research_date <= CURRENT_TIMESTAMP - INTERVAL '1 year' THEN 1 END) as stale_entries,
          COUNT(DISTINCT manufacturer) as unique_manufacturers,
          AVG(confidence_score)::numeric(10,2) as avg_confidence,
          MIN(research_date) as oldest_research,
          MAX(research_date) as newest_research
        FROM ai_research_cache
      `;

      const result = await db.query(query);
      return result.rows[0];

    } catch (error) {
      console.error('Error getting cache stats:', error);
      return null;
    }
  }

  /**
   * Bulk check for cached products
   * @param {Array} products - Array of {manufacturer, product_id} objects
   * @returns {Map} Map of product_id to cache status
   */
  async bulkCheckCache(products) {
    const cacheMap = new Map();
    
    if (!products || products.length === 0) {
      return cacheMap;
    }

    try {
      // Build case statements for bulk lookup
      const conditions = products.map((p, index) => 
        `(LOWER(manufacturer) = $${index * 2 + 1} AND LOWER(part_number) = $${index * 2 + 2})`
      ).join(' OR ');

      const values = products.flatMap(p => [
        (p.manufacturer || '').trim().toLowerCase(),
        (p.product_id || '').trim().toLowerCase()
      ]);

      const query = `
        SELECT 
          manufacturer,
          part_number,
          research_date,
          confidence_score,
          CASE 
            WHEN research_date > CURRENT_TIMESTAMP - INTERVAL '1 year' THEN true
            ELSE false
          END as is_fresh
        FROM ai_research_cache
        WHERE ${conditions}
      `;

      const result = await db.query(query, values);

      // Build map of results
      result.rows.forEach(row => {
        const key = `${row.manufacturer.toLowerCase()}_${row.part_number.toUpperCase()}`;
        cacheMap.set(key, {
          cached: true,
          fresh: row.is_fresh,
          research_date: row.research_date,
          confidence: row.confidence_score
        });
      });

      // Add missing products as not cached
      products.forEach(product => {
        const key = `${(product.manufacturer || '').toLowerCase()}_${(product.product_id || '').toUpperCase()}`;
        if (!cacheMap.has(key)) {
          cacheMap.set(key, {
            cached: false,
            fresh: false
          });
        }
      });

      const cachedCount = Array.from(cacheMap.values()).filter(v => v.cached).length;
      const freshCount = Array.from(cacheMap.values()).filter(v => v.fresh).length;
      
      console.log(`📊 Cache check: ${cachedCount}/${products.length} cached (${freshCount} fresh)`);

      return cacheMap;

    } catch (error) {
      console.error('Error in bulk cache check:', error);
      return cacheMap;
    }
  }

  /**
   * Clear stale cache entries (older than 1 year)
   * @returns {number} Number of entries cleared
   */
  async clearStaleCache() {
    try {
      const query = `
        DELETE FROM ai_research_cache
        WHERE research_date <= CURRENT_TIMESTAMP - INTERVAL '1 year'
        RETURNING cache_id
      `;

      const result = await db.query(query);
      console.log(`🧹 Cleared ${result.rowCount} stale cache entries`);
      return result.rowCount;

    } catch (error) {
      console.error('Error clearing stale cache:', error);
      return 0;
    }
  }

  // Helper methods
  formatDate(date) {
    if (!date) return null;
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    try {
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch (e) {
      console.warn('Invalid date:', date);
    }
    return null;
  }

  formatJsonb(data) {
    if (!data) return null;
    if (typeof data === 'string') return data;
    try {
      return JSON.stringify(data);
    } catch (e) {
      return null;
    }
  }

  /**
   * Transform cached data to match Phase 3 result format
   * @param {Object} cacheData - Data from cache
   * @param {Object} originalProduct - Original product data
   * @returns {Object} Transformed result
   */
  transformCacheToResult(cacheData, originalProduct) {
    return {
      ...originalProduct,
      date_introduced: cacheData.date_introduced,
      end_of_sale_date: cacheData.end_of_sale_date,
      end_of_sw_maintenance_date: cacheData.end_of_sw_maintenance_date,
      end_of_sw_vulnerability_maintenance_date: cacheData.end_of_sw_vulnerability_maintenance_date,
      last_day_of_support_date: cacheData.last_day_of_support_date,
      data_sources: cacheData.data_sources,
      overall_confidence: cacheData.confidence_score,
      lifecycle_confidence: cacheData.confidence_score,
      ai_enhanced: true,
      from_cache: true,
      cache_date: cacheData.research_date,
      estimation_metadata: cacheData.estimation_metadata,
      research_source: cacheData.research_source
    };
  }
}

module.exports = new AIResearchCacheService();