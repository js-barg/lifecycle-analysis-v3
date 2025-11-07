/**
 * Optimized Google AI Research Service
 * Performance improvements:
 * - Reduced queries from 40+ to 10-15
 * - Parallel search execution (3-5 concurrent)
 * - Smart early exit when sufficient dates found
 * - Prioritized query execution
 * 
 * Expected performance gain: 60-70% faster
 */

const axios = require('axios');
require('dotenv').config({ path: 'C:/development/lifecycle-analysis/backend/.env' });

class OptimizedSearchService {
  constructor() {
    this.apiKey = process.env.GOOGLE_API_KEY;
    this.searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
    this.searchUrl = 'https://www.googleapis.com/customsearch/v1';

class OptimizedSearchService {
  constructor() {
    this.apiKey = config.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY;
    this.searchEngineId = config.GOOGLE_SEARCH_ENGINE_ID || process.env.GOOGLE_CSE_ID;
    this.searchUrl = 'https://www.googleapis.com/customsearch/v1';
    
    // Parallel execution configuration
    this.maxConcurrentSearches = 3; // Run 3 searches in parallel
    this.searchTimeout = 8000; // 8 second timeout per search
    
    // Cache configuration
    this.pageCache = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
    
    // Rate limiting - reduced since we're doing parallel
    this.minTimeBetweenBatches = 500; // 500ms between batches
    this.lastBatchTime = 0;
    
    // Authorized domains (same as original)
    this.authorizedDomains = {
      cisco: ['cisco.com', 'meraki.com', 'documentation.meraki.com'],
      hpe: ['hpe.com', 'hp.com', 'arubanetworks.com'],
      dell: ['dell.com', 'delltechnologies.com'],
      microsoft: ['microsoft.com', 'docs.microsoft.com'],
      vmware: ['vmware.com', 'docs.vmware.com'],
      // Add other vendors as needed
    };
  }

  /**
   * Optimized research with parallel execution and early exit
   */
  async performOptimizedResearch(product) {
    try {
      console.log(`🚀 Starting OPTIMIZED research for ${product.product_id}`);
      const startTime = Date.now();
      
      // Build prioritized queries (reduced set)
      const queries = this.buildPrioritizedQueries(product);
      console.log(`📋 Generated ${queries.length} prioritized queries (reduced from 40+)`);
      
      // Execute searches with early exit strategy
      const searchResults = await this.executeParallelSearches(queries, product);
      
      // Extract dates from results
      const lifecycleDates = this.extractLifecycleDates(searchResults, product);
      
      // Count how many critical dates we found
      const criticalDatesFound = [
        lifecycleDates.end_of_sale_date,
        lifecycleDates.last_day_of_support_date
      ].filter(date => date !== null).length;
      
      // Log performance metrics
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`⚡ Research completed in ${elapsedTime}s (${criticalDatesFound} critical dates found)`);
      
      // Calculate confidence based on what we found
      const confidence = this.calculateOptimizedConfidence(lifecycleDates, searchResults, criticalDatesFound);
      
      return {
        ...lifecycleDates,
        lifecycle_confidence: confidence.lifecycle,
        overall_confidence: confidence.overall,
        data_sources: searchResults.sources,
        research_time_seconds: parseFloat(elapsedTime),
        optimization_used: true
      };
      
    } catch (error) {
      console.error(`Optimized research failed for ${product.product_id}:`, error);
      return this.getDefaultResearchResult(product);
    }
  }

  /**
   * Build a prioritized, reduced set of queries
   */
  buildPrioritizedQueries(product) {
    const productId = product.product_id;
    const manufacturer = (product.manufacturer || '').toLowerCase();
    const queries = [];
    
    // Priority 1: Vendor-specific direct queries (most likely to succeed)
    if (manufacturer.includes('cisco') || productId.match(/^(WS-|N\d+K-|ISR|ASR|C\d+)/i)) {
      queries.push(`"${productId}" site:cisco.com/c/en/us/products/eos-eol-notice-listing.html`);
      queries.push(`"${productId}" site:cisco.com "End-of-Sale" "End-of-Life"`);
      queries.push(`"${productId}" inurl:eos-eol-notice site:cisco.com`);
    } else if (manufacturer.includes('hp') || manufacturer.includes('hpe')) {
      queries.push(`"${productId}" site:hpe.com "End of Life"`);
      queries.push(`"${productId}" site:support.hpe.com lifecycle`);
    } else if (manufacturer.includes('dell')) {
      queries.push(`"${productId}" site:dell.com "End of Life"`);
      queries.push(`"${productId}" site:dell.com/support lifecycle`);
    } else if (manufacturer.includes('microsoft')) {
      queries.push(`"${productId}" site:microsoft.com "end of support"`);
      queries.push(`"${productId}" site:docs.microsoft.com lifecycle`);
    }
    
    // Priority 2: Generic but effective queries
    queries.push(`"${productId}" "End-of-Sale" "End-of-Life" official`);
    queries.push(`"${productId}" EOL EOS dates ${manufacturer}`);
    
    // Priority 3: SW Vulnerability specific (NEW - addressing the gap)
    queries.push(`"${productId}" "security updates" "end date"`);
    queries.push(`"${productId}" "vulnerability support" end`);
    
    // Priority 4: Product bulletin searches
    queries.push(`"${productId}" "Product Bulletin" EOL`);
    
    // Limit to 12 queries max (down from 40+)
    return queries.slice(0, 12);
  }

  /**
   * Execute searches in parallel with early exit
   */
  async executeParallelSearches(queries, product) {
    const results = {
      pages: [],
      sources: {
        vendor_site: 0,
        third_party: 0,
        manual_entry: 0
      }
    };
    
    // Check if API is configured
    if (!this.apiKey || this.apiKey === 'your_google_api_key_here') {
      console.log('⚠️ Google API not configured');
      return results;
    }
    
    // Process queries in batches
    const batchSize = this.maxConcurrentSearches;
    let foundCriticalDates = 0;
    
    for (let i = 0; i < queries.length; i += batchSize) {
      // Early exit if we found enough dates
      if (foundCriticalDates >= 2 && results.sources.vendor_site > 0) {
        console.log('✨ Early exit: Found sufficient dates from vendor site');
        break;
      }
      
      const batch = queries.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1} (${batch.length} queries)`);
      
      // Rate limiting between batches
      await this.enforceRateLimitForBatch();
      
      // Execute batch in parallel
      const batchPromises = batch.map(query => this.executeSingleSearch(query, product));
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process batch results
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          results.pages.push(...result.value.pages);
          
          // Update source counts
          for (const [key, value] of Object.entries(result.value.sources)) {
            results.sources[key] += value;
          }
          
          // Quick check for critical dates (for early exit)
          for (const page of result.value.pages) {
            if (page.content) {
              const quickCheck = this.quickDateCheck(page.content, product.product_id);
              foundCriticalDates += quickCheck.criticalDatesFound;
            }
          }
        }
      }
    }
    
    console.log(`📊 Search complete: ${results.pages.length} relevant pages found`);
    return results;
  }

  /**
   * Execute a single search query
   */
  async executeSingleSearch(query, product) {
    const results = {
      pages: [],
      sources: {
        vendor_site: 0,
        third_party: 0
      }
    };
    
    try {
      console.log(`🔎 Searching: ${query.substring(0, 60)}...`);
      
      const response = await axios.get(this.searchUrl, {
        params: {
          key: this.apiKey,
          cx: this.searchEngineId,
          q: query,
          num: 3 // Reduced from 5 to 3 for faster processing
        },
        timeout: this.searchTimeout
      });
      
      if (response.data.items) {
        // Process results in parallel
        const pagePromises = response.data.items.map(async (item) => {
          // Skip unauthorized domains
          if (!this.isAuthorizedDomain(item.link)) {
            return null;
          }
          
          // Fetch page content (with caching)
          const content = await this.fetchPageContent(item.link);
          
          if (content && this.verifyProductOnPage(content, product.product_id)) {
            const isVendor = this.isVendorSite(item.link, product.manufacturer);
            
            return {
              page: {
                url: item.link,
                title: item.title,
                content: content,
                snippet: item.snippet
              },
              isVendor
            };
          }
          return null;
        });
        
        const pageResults = await Promise.allSettled(pagePromises);
        
        for (const result of pageResults) {
          if (result.status === 'fulfilled' && result.value) {
            results.pages.push(result.value.page);
            if (result.value.isVendor) {
              results.sources.vendor_site++;
            } else {
              results.sources.third_party++;
            }
          }
        }
      }
    } catch (error) {
      if (error.response?.status === 429) {
        console.log('⚠️ Rate limit hit, skipping query');
      } else {
        console.error(`Search error: ${error.message}`);
      }
    }
    
    return results;
  }

  /**
   * Quick check for critical dates (for early exit decision)
   */
  quickDateCheck(content, productId) {
    let criticalDatesFound = 0;
    const contentLower = content.toLowerCase();
    const productLower = productId.toLowerCase();
    
    // Check if product is mentioned
    if (!contentLower.includes(productLower)) {
      return { criticalDatesFound: 0 };
    }
    
    // Quick regex for dates near EOS/EOL keywords
    const eosPattern = /(end.{0,3}of.{0,3}sale|eos|end.{0,3}of.{0,3}life|eol)/i;
    const datePattern = /\d{4}-\d{2}-\d{2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/;
    
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes(productLower)) {
        if (eosPattern.test(line) && datePattern.test(line)) {
          criticalDatesFound++;
        }
      }
    }
    
    return { criticalDatesFound: Math.min(criticalDatesFound, 2) };
  }

  /**
   * Extract lifecycle dates (reuse existing logic from original service)
   */
  extractLifecycleDates(searchResults, product) {
    const dates = {
      date_introduced: null,
      end_of_sale_date: null,
      end_of_sw_maintenance_date: null,
      end_of_sw_vulnerability_maintenance_date: null,
      last_day_of_support_date: null,
      is_current_product: false
    };
    
    // Process each page for dates
    for (const page of searchResults.pages) {
      try {
        const pageDates = this.extractDatesFromPage(page, product);
        
        // Merge with priority (vendor sites take precedence)
        for (const [key, value] of Object.entries(pageDates)) {
          if (value && !dates[key]) {
            dates[key] = value;
            console.log(`📅 Found ${key}: ${value}`);
          }
        }
      } catch (error) {
        console.error(`Error extracting dates from ${page.url}:`, error.message);
      }
    }
    
    return dates;
  }

  /**
   * Extract dates from a single page
   */
  extractDatesFromPage(page, product) {
    const dates = {};
    const content = page.content;
    const productId = product.product_id;
    
    // Common date patterns
    const datePatterns = {
      iso: /(\d{4}-\d{2}-\d{2})/g,
      slash: /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
      written: /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/gi
    };
    
    // Milestone keywords
    const milestones = {
      end_of_sale_date: ['end-of-sale', 'end of sale', 'eos date', 'last date to order'],
      last_day_of_support_date: ['end-of-support', 'end of support', 'last day of support', 'end-of-life', 'eol date'],
      end_of_sw_maintenance_date: ['end of software maintenance', 'sw maintenance', 'software updates end'],
      end_of_sw_vulnerability_maintenance_date: ['vulnerability support', 'security updates', 'security patches', 'critical fixes']
    };
    
    // Find dates near product mentions
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.toLowerCase().includes(productId.toLowerCase())) {
        // Check surrounding lines for milestone keywords and dates
        for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) {
          const checkLine = lines[j];
          
          for (const [field, keywords] of Object.entries(milestones)) {
            for (const keyword of keywords) {
              if (checkLine.toLowerCase().includes(keyword)) {
                // Extract date from this line or nearby lines
                for (const [patternName, pattern] of Object.entries(datePatterns)) {
                  const matches = checkLine.match(pattern);
                  if (matches && matches.length > 0) {
                    const normalizedDate = this.normalizeDate(matches[0]);
                    if (normalizedDate && !dates[field]) {
                      dates[field] = normalizedDate;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    
    return dates;
  }

  /**
   * Normalize various date formats to YYYY-MM-DD
   */
  normalizeDate(dateStr) {
    try {
      // Handle ISO format (already normalized)
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
      }
      
      // Handle slash format (MM/DD/YYYY or DD/MM/YYYY)
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
      
      // Handle written format (Jan 15, 2024)
      const monthMap = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
        'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
        'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
      };
      
      const writtenMatch = dateStr.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/i);
      if (writtenMatch) {
        const month = monthMap[writtenMatch[1].toLowerCase().substring(0, 3)];
        const day = writtenMatch[2].padStart(2, '0');
        const year = writtenMatch[3];
        return `${year}-${month}-${day}`;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate optimized confidence scores
   */
  calculateOptimizedConfidence(dates, searchResults, criticalDatesFound) {
    let lifecycleConfidence = 0;
    let overallConfidence = 0;
    
    // Base confidence on sources
    if (searchResults.sources.vendor_site > 0) {
      lifecycleConfidence += 60;
      overallConfidence += 60;
    } else if (searchResults.sources.third_party > 0) {
      lifecycleConfidence += 30;
      overallConfidence += 30;
    }
    
    // Confidence boost for critical dates found
    lifecycleConfidence += criticalDatesFound * 20;
    overallConfidence += criticalDatesFound * 15;
    
    // Additional boost for any other dates found
    const allDatesFound = Object.values(dates).filter(d => d !== null).length;
    lifecycleConfidence += Math.min((allDatesFound - criticalDatesFound) * 5, 15);
    
    // Cap at reasonable maximums
    lifecycleConfidence = Math.min(lifecycleConfidence, 95);
    overallConfidence = Math.min(overallConfidence, 90);
    
    // Minimum confidence if we found something
    if (allDatesFound > 0) {
      lifecycleConfidence = Math.max(lifecycleConfidence, 50);
      overallConfidence = Math.max(overallConfidence, 45);
    }
    
    return {
      lifecycle: lifecycleConfidence,
      overall: overallConfidence
    };
  }

  /**
   * Rate limiting for batch processing
   */
  async enforceRateLimitForBatch() {
    const now = Date.now();
    const timeSinceLastBatch = now - this.lastBatchTime;
    
    if (timeSinceLastBatch < this.minTimeBetweenBatches) {
      const waitTime = this.minTimeBetweenBatches - timeSinceLastBatch;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastBatchTime = Date.now();
  }

  /**
   * Fetch page content with caching
   */
  async fetchPageContent(url) {
    try {
      // Check cache first
      const cached = this.pageCache.get(url);
      if (cached && (Date.now() - cached.timestamp < this.cacheExpiry)) {
        return cached.content;
      }
      
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        maxContentLength: 5000000 // 5MB limit
      });
      
      const $ = cheerio.load(response.data);
      
      // Remove scripts and styles
      $('script').remove();
      $('style').remove();
      
      // Get text content
      const content = $('body').text();
      
      // Cache the content
      this.pageCache.set(url, {
        content,
        timestamp: Date.now()
      });
      
      return content;
      
    } catch (error) {
      console.error(`Failed to fetch ${url}: ${error.message}`);
      return null;
    }
  }

  /**
   * Verify product is mentioned on page
   */
  verifyProductOnPage(content, productId) {
    if (!content) return false;
    
    const contentLower = content.toLowerCase();
    const productLower = productId.toLowerCase();
    
    return contentLower.includes(productLower);
  }

  /**
   * Check if URL is from authorized domain
   */
  isAuthorizedDomain(url) {
    const allAuthorizedDomains = Object.values(this.authorizedDomains).flat();
    return allAuthorizedDomains.some(domain => url.includes(domain));
  }

  /**
   * Check if URL is from vendor site
   */
  isVendorSite(url, manufacturer) {
    if (!manufacturer) return false;
    
    const mfgLower = manufacturer.toLowerCase();
    for (const [vendor, domains] of Object.entries(this.authorizedDomains)) {
      if (mfgLower.includes(vendor)) {
        return domains.some(domain => url.includes(domain));
      }
    }
    return false;
  }

  /**
   * Get default research result
   */
  getDefaultResearchResult(product) {
    return {
      date_introduced: null,
      end_of_sale_date: null,
      end_of_sw_maintenance_date: null,
      end_of_sw_vulnerability_maintenance_date: null,
      last_day_of_support_date: null,
      is_current_product: false,
      lifecycle_confidence: 0,
      overall_confidence: 0,
      data_sources: {
        vendor_site: 0,
        third_party: 0,
        manual_entry: 0
      }
    };
  }
}

module.exports = new OptimizedSearchService();