const axios = require('axios');
const cheerio = require('cheerio');

// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

class GoogleAIResearchService {
  constructor() {
    // Support both local and Cloud Run environment variable names
    this.apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_CSE_API_KEY;
    this.searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID || process.env.GOOGLE_CSE_CX;
    
    // Debug logging to confirm configuration
    console.log('🔧 Google AI Research Service initializing...');
    console.log('API Key configured:', !!this.apiKey);
    console.log('Search Engine ID configured:', !!this.searchEngineId);
    
    if (this.apiKey && this.searchEngineId) {
      console.log('✅ Google Custom Search API configured successfully');
      // Log first few characters of credentials for verification (safely)
      console.log(`API Key starts with: ${this.apiKey?.substring(0, 10)}...`);
      console.log(`Search Engine ID: ${this.searchEngineId}`);
    } else {
      console.log('❌ Missing API credentials:');
      if (!this.apiKey) console.log('  - API Key not found');
      if (!this.searchEngineId) console.log('  - Search Engine ID not found');
    }
    
    this.searchUrl = 'https://www.googleapis.com/customsearch/v1';
    this.authorizedDomains = {
      cisco: ['cisco.com', 'meraki.com', 'documentation.meraki.com', 'support.cisco.com'],
      hpe: ['hpe.com', 'hp.com', 'arubanetworks.com', 'support.hpe.com', 'h20195.www2.hpe.com'],
      dell: ['dell.com', 'delltechnologies.com', 'emc.com', 'support.dell.com'],
      juniper: ['juniper.net', 'support.juniper.net', 'kb.juniper.net'],
      fortinet: ['fortinet.com', 'docs.fortinet.com', 'support.fortinet.com'],
      paloalto: ['paloaltonetworks.com', 'docs.paloaltonetworks.com', 'support.paloaltonetworks.com'],
      vmware: ['vmware.com', 'kb.vmware.com', 'docs.vmware.com'],
      netapp: ['netapp.com', 'support.netapp.com', 'docs.netapp.com'],
      ibm: ['ibm.com', 'support.ibm.com'],
      microsoft: ['microsoft.com', 'docs.microsoft.com', 'support.microsoft.com'],
      lenovo: ['lenovo.com', 'support.lenovo.com'],
      nutanix: ['nutanix.com', 'portal.nutanix.com'],
      sophos: ['sophos.com', 'support.sophos.com'],
      symantec: ['broadcom.com', 'support.broadcom.com'],
      checkpoint: ['checkpoint.com', 'support.checkpoint.com'],
      f5: ['f5.com', 'support.f5.com', 'my.f5.com'],
      arista: ['arista.com', 'support.arista.com'],
      extreme: ['extremenetworks.com', 'support.extremenetworks.com'],
      brocade: ['broadcom.com', 'support.broadcom.com']
    };
    // Rate limiting configuration
    this.lastCallTime = 0;
    this.minTimeBetweenCalls = 1000; // 1 second minimum between calls
    this.maxRetries = 5;
    
    // Cache for fetched pages
    this.pageCache = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
    
    // Cisco-specific date patterns and configurations
    this.ciscoDatePatterns = {
      ciscoFormat: /(\d{1,2})[-\s]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\s]+(\d{4})/gi,
      monthDayYear: /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/gi,
      isoFormat: /(\d{4})-(\d{2})-(\d{2})/g,
      slashFormat: /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
      dotFormat: /(\d{1,2})\.(\d{1,2})\.(\d{4})/g,
      quarterFormat: /Q([1-4])\s*(?:FY)?(\d{2,4})/gi,
      monthYear: /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/gi
    };
    
    this.eolMilestones = {
      end_of_sale: [
        'End-of-Sale', 'End of Sale', 'EoS Date', 'End-of-Sale Date',
        'End of Sale and End of Life', 'End-of-Sale and End-of-Life Announcement',
        'Last Date to Order', 'End of Sale Date', 'EOS'
      ],
      last_day_support: [
        'End-of-Support', 'End of Support', 'Last Date of Support',
        'End of Service Life', 'End-of-Life', 'End of Life', 'EoL Date',
        'End-of-Life Date', 'End of Service Contract Renewal',
        'Last Date to Receive Service', 'LDOS', 'EOL'
      ],
      end_sw_maintenance: [
        'End of Software Maintenance', 'End of SW Maintenance Release',
        'Last Date to Download Software', 'End of Vulnerability Support',
        'End of Security Vulnerability Support', 'End of Software Maintenance Releases',
        'End of SW Maintenance'
      ],
      end_routine_failure: [
        'End of Routine Failure Analysis', 'End of RFA',
        'End of Routine Failure Analysis Date'
      ],
      end_new_service: [
        'End of New Service Attachment', 'End of Service Contract Renewal',
        'End of Contract Renewal'
      ]
    };
  }

  isAuthorizedDomain(url) {
  // Check if URL is from an authorized manufacturer/partner domain
    const allAuthorizedDomains = Object.values(this.authorizedDomains).flat();
    
    // Also allow official support partner CDNs that manufacturers use
    const additionalAuthorized = [
      'cloudfront.net', // AWS CDN used by many vendors
      'akamaiedge.net', // Akamai CDN
      'azureedge.net'   // Azure CDN
    ];
    
    const isManufacturerSite = allAuthorizedDomains.some(domain => url.includes(domain));
    const isCDN = additionalAuthorized.some(cdn => url.includes(cdn));
    
    return isManufacturerSite || (isCDN && url.includes('.pdf')); // CDNs only for PDFs
  }

  async performResearch(product) {
    try {
      console.log(`🔍 Starting research for ${product.product_id}`);
      
      // Build enhanced search queries
      const searchQueries = this.buildEnhancedSearchQueries(product);
      
      // Perform searches and extract dates
      const searchResults = await this.performSearches(searchQueries, product);
      
      // Extract lifecycle dates with context awareness
      const lifecycleDates = this.extractLifecycleDates(searchResults, product);
      
      // Apply date logic and validation
      const validatedDates = this.applyDateLogic(lifecycleDates, product);
      
      // Calculate confidence scores
      const confidence = this.calculateConfidence(validatedDates, searchResults);
      
      return {
        ...validatedDates,
        lifecycle_confidence: confidence.lifecycle,
        overall_confidence: confidence.overall,
        data_sources: searchResults.sources
      };
      
    } catch (error) {
      console.error(`Research failed for ${product.product_id}:`, error);
      return this.getDefaultResearchResult(product);
    }
  }

  /**
   * Enhanced Search Query Builder with improved Cisco support
   */
buildEnhancedSearchQueries(product) {
  const productId = product.product_id;
  const manufacturer = (product.manufacturer || '').toLowerCase();
  const queries = [];
  
  // Check if it's a Cisco/Meraki product
  const isCisco = manufacturer.includes('cisco') || 
                  productId.match(/^(WS-|N\d+K-|ISR|ASR|C\d+|AIR-|MR|MS|MX|MV|MT|MG)/i);
  
  if (isCisco) {
    // PRIORITY 1: Most likely to have results (only 3-5 queries)
    if (productId.match(/^(MR|MS|MX|MV|MT|MG)\d+/i)) {
      // Meraki products - documentation.meraki.com is THE source
      queries.push(`${productId} site:documentation.meraki.com`);
      const baseProduct = productId.replace(/-HW$/i, '');
      if (baseProduct !== productId) {
        queries.push(`${baseProduct} site:documentation.meraki.com`);
      }
    } else {
      // Regular Cisco products
      queries.push(`${productId} site:cisco.com EOL`);
      queries.push(`${productId} site:cisco.com/c/en/us/products/eos-eol-notice-listing.html`);
    }
    
    // PRIORITY 2: Generic search (1 query)
    queries.push(`${productId} "End-of-Sale" "End-of-Life"`);
  } else {
    // Non-Cisco products - keep it simple (3-5 queries max)
    queries.push(`${productId} EOL EOS`);
    queries.push(`${productId} "End-of-Sale" "End-of-Life"`);
    
    // Vendor-specific if known
    if (manufacturer) {
      queries.push(`${productId} site:${manufacturer}.com EOL`);
    }
  }
  
  console.log(`📝 Generated ${queries.length} search queries for ${productId}`);
  return queries;
}

  generateProductVariations(productId) {
    const variations = [productId];
    
    // Remove common suffixes
    const suffixes = ['-HW', '-SW', '-K9', '-L', '-S', '-E', '-P', '-X'];
    for (const suffix of suffixes) {
      if (productId.endsWith(suffix)) {
        variations.push(productId.replace(suffix, ''));
      }
    }
    
    // Add common suffixes if not present
    if (!productId.includes('-')) {
      variations.push(`${productId}-HW`);
    }
    
    return variations;
  }

async performSearches(queries, product) {
  const results = {
    pages: [],
    sources: {
      vendor_site: 0,
      third_party: 0,
      manual_entry: 0
    }
  };
  
  // Check if API credentials are configured
  if (!this.apiKey || this.apiKey === 'your_google_api_key_here' || 
      !this.searchEngineId || this.searchEngineId === 'your_search_engine_id_here') {
    console.log('⚠️ Google API not configured properly');
    return results;
  }
  
  // Performance optimization: Track if we found dates
  let foundEndOfSale = false;
  let foundEndOfSupport = false;
  let queryCount = 0;
  const maxQueries = 10; // Limit queries for performance
  
  for (const query of queries) {
    // PERFORMANCE: Stop early if we found both key dates or hit query limit
    if ((foundEndOfSale && foundEndOfSupport) || queryCount >= maxQueries) {
      console.log(`✅ Found sufficient data or hit query limit, stopping search`);
      break;
    }
    
    try {
      // Rate limiting
      await this.enforceRateLimit();
      
      console.log(`🔎 Searching: ${query}`); // FIXED: Added parentheses
      queryCount++;
      
      const response = await axios.get(this.searchUrl, {
        params: {
          key: this.apiKey,
          cx: this.searchEngineId,
          q: query,
          num: 3 // PERFORMANCE: Reduced from 5 to 3 results
        },
        timeout: 10000
      });
      
      if (response.data.items) {
        for (const item of response.data.items) {
          // SECURITY CHECK: Skip unauthorized domains
          if (!this.isAuthorizedDomain(item.link)) {
            console.log(`⚠️ Skipping unauthorized domain: ${new URL(item.link).hostname}`); // FIXED: Added parentheses
            results.sources.third_party++; // Count as third-party
            continue; // Skip this result
          }
          
          // Fetch and analyze page content
          const pageContent = await this.fetchPageContent(item.link);
          if (pageContent && this.verifyProductOnPage(pageContent, product.product_id)) {
            results.pages.push({
              url: item.link,
              title: item.title,
              content: pageContent,
              snippet: item.snippet
            });
            
            // Track source type
            if (this.isVendorSite(item.link, product.manufacturer)) {
              results.sources.vendor_site++;
            } else {
              results.sources.third_party++;
            }
            
            console.log(`✅ Found relevant page: ${item.link}`); // FIXED: Added parentheses
            
            // PERFORMANCE: Check if this page contains key dates
            const contentLower = pageContent.toLowerCase();
            if (contentLower.includes('end-of-sale') || contentLower.includes('end of sale')) {
              foundEndOfSale = true;
            }
            if (contentLower.includes('end-of-life') || contentLower.includes('end of life') || 
                contentLower.includes('end-of-support') || contentLower.includes('end of support')) {
              foundEndOfSupport = true;
            }
            
            // PERFORMANCE: Stop processing more results if we have enough pages
            if (results.pages.length >= 3 && (foundEndOfSale || foundEndOfSupport)) {
              console.log(`📊 Found ${results.pages.length} pages with dates, moving to next query`);
              break;
            }
          }
        }
      }
      
    } catch (error) {
      if (error.response?.status === 429) {
        console.log('⏳ Rate limit hit, waiting before retry...');
        await this.handleRateLimit(error);
      } else {
        console.error(`Search error for query "${query}":`, error.message); // FIXED: Added parentheses
      }
    }
  }
  
  console.log(`📊 Search complete: ${results.pages.length} relevant pages found from ${queryCount} queries`);
  return results;
}

  async fetchPageContent(url) {
    try {
      // Check cache first
      const cached = this.pageCache.get(url);
      if (cached && (Date.now() - cached.timestamp < this.cacheExpiry)) {
        console.log(`📦 Using cached content for ${url}`);
        return cached.content;
      }
      
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        validateStatus: status => status < 400
      });
      
      const $ = cheerio.load(response.data);
      
      // Remove scripts and styles
      $('script').remove();
      $('style').remove();
      
      // Get text content
      let content = $('body').text();
      
      // Also try to get structured data from tables
      const tables = [];
      $('table').each((i, table) => {
        const tableText = $(table).text();
        tables.push(tableText);
      });
      
      if (tables.length > 0) {
        content += '\n\nTABLES:\n' + tables.join('\n');
      }
      
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

  verifyProductOnPage(content, productId) {
  if (!content) return false;
  
  const contentLower = content.toLowerCase();
  const productLower = productId.toLowerCase();
  
  // For Meraki products, also check without -HW suffix
  let count = (contentLower.match(new RegExp(productLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  
  // If MR/MS product with -HW, also check without suffix
  if (productId.match(/^(MR|MS|MX|MG)\d+.*-HW$/i) && count === 0) {
    const baseProduct = productId.replace(/-HW$/i, '');
    count = (contentLower.match(new RegExp(baseProduct.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    console.log(`🔍 Also checking for ${baseProduct}: found ${count} times`);
  }
  
  console.log(`🔍 Product verification: ${productId} found ${count} times`);
  return count > 0;
}

  /**
   * Enhanced lifecycle date extraction with improved Cisco support
   */
  extractLifecycleDates(searchResults, product) {
    const manufacturer = (product.manufacturer || '').toLowerCase();
    const productId = product.product_id;
    
    // Check if it's a Cisco product
    const isCisco = manufacturer.includes('cisco') || 
                    productId.match(/^(WS-|N\d+K-|ISR|ASR|C\d+|AIR-|MR|MS|MX|MV|MT|MG)/i);
    
    if (isCisco) {
      console.log(`🔷 Using improved Cisco date extraction for ${productId}`);
      return this.extractCiscoLifecycleDates(searchResults, product);
    }
    
    // Original extraction logic for non-Cisco products
    return this.extractGenericLifecycleDates(searchResults, product);
  }

  /**
   * Cisco-specific date extraction
   */
  extractCiscoLifecycleDates(searchResults, product) {
    const dates = {
      date_introduced: null,
      end_of_sale_date: null,
      end_of_sw_maintenance_date: null,
      end_of_sw_vulnerability_maintenance_date: null,
      last_day_of_support_date: null,
      end_of_routine_failure_date: null,
      end_of_new_service_date: null,
      is_current_product: false
    };

    console.log(`\n🔍 DEBUG: Looking for ${product.product_id} dates`);
    console.log(`📊 Found ${searchResults.pages.length} relevant pages`);

    // Process each page with Cisco-specific extraction
    for (const page of searchResults.pages) {
      try {
        // Multiple extraction strategies
        const tableDates = this.extractDatesFromTables(page.content, product.product_id);
        const proximityDates = this.extractDatesWithProximity(page.content, product.product_id);
        const structuredDates = this.extractStructuredEOLDates(page.content, product.product_id);
        const listDates = this.extractDatesFromLists(page.content, product.product_id);
        
        // Merge all extracted dates with priority
        const pageDates = { ...tableDates, ...proximityDates, ...structuredDates, ...listDates };
        
        // Merge with main dates object
        for (const [key, value] of Object.entries(pageDates)) {
          if (value && !dates[key]) {
            dates[key] = value;
            const isVendor = this.isVendorSite(page.url, product.manufacturer);
            console.log(`📅 Found ${key}: ${value} from ${isVendor ? 'vendor' : 'third-party'} site`);
          }
        }
      } catch (error) {
        console.error(`Error extracting from ${page.url}:`, error.message);
      }
    }

    return dates;
  }

  /**
   * Extract dates from HTML tables (common in Cisco EOL notices)
   */
  extractDatesFromTables(content, productId) {
    const dates = {};
    
    // Look for table patterns
    const tablePatterns = [
      /<tr[^>]*>[\s\S]*?<\/tr>/gi,
      /<td[^>]*>[\s\S]*?<\/td>/gi,
      /\|([^|]+)\|([^|]+)\|/g,
      /([^\t]+)\t([^\t]+)/g
    ];

    for (const pattern of tablePatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const row = match[0];
        
        // Check if this row contains the product ID
        if (row.toLowerCase().includes(productId.toLowerCase())) {
          // Extract all dates from this row
          const rowDates = this.extractAllCiscoDates(row);
          
          // Try to identify what each date represents
          for (const dateObj of rowDates) {
            const milestone = this.identifyMilestone(row, dateObj.position);
            if (milestone) {
              dates[milestone] = dateObj.date;
              console.log(`📅 Extracted ${milestone}: ${dateObj.date} from table`);
            }
          }
        }
        
        // Also check milestone rows
        for (const [field, keywords] of Object.entries(this.eolMilestones)) {
          for (const keyword of keywords) {
            if (row.includes(keyword)) {
              const rowDates = this.extractAllCiscoDates(row);
              if (rowDates.length > 0) {
                dates[field + '_date'] = rowDates[0].date;
              }
            }
          }
        }
      }
    }

    return dates;
  }

  /**
   * Extract dates near product mentions
   */
  extractDatesWithProximity(content, productId) {
    const dates = {};
    const productPattern = new RegExp(this.escapeRegex(productId), 'gi');
    const matches = content.matchAll(productPattern);
    
    for (const match of matches) {
      const position = match.index;
      
      // Get context around the product mention
      const contextStart = Math.max(0, position - 500);
      const contextEnd = Math.min(content.length, position + productId.length + 500);
      const context = content.substring(contextStart, contextEnd);
      
      // Look for milestone keywords and dates in the context
      for (const [field, keywords] of Object.entries(this.eolMilestones)) {
        for (const keyword of keywords) {
          const keywordIndex = context.toLowerCase().indexOf(keyword.toLowerCase());
          if (keywordIndex > -1) {
            // Look for dates near the keyword
            const dateSearchStart = Math.max(0, keywordIndex - 100);
            const dateSearchEnd = Math.min(context.length, keywordIndex + keyword.length + 100);
            const dateContext = context.substring(dateSearchStart, dateSearchEnd);
            
            const extractedDates = this.extractAllCiscoDates(dateContext);
            if (extractedDates.length > 0) {
              dates[field + '_date'] = extractedDates[0].date;
              console.log(`📅 Extracted ${field}_date: ${extractedDates[0].date} (near product mention)`);
            }
          }
        }
      }
    }
    
    return dates;
  }

  /**
   * Extract dates from structured EOL sections
   */
  extractStructuredEOLDates(content, productId) {
    const dates = {};
    
    for (const [field, keywords] of Object.entries(this.eolMilestones)) {
      for (const keyword of keywords) {
        const patterns = [
          new RegExp(`${this.escapeRegex(keyword)}\\s*[:–-]\\s*([^\\n\\r]+)`, 'gi'),
          new RegExp(`${this.escapeRegex(keyword)}\\s+(?:is|was|will be)?\\s*[:–-]?\\s*([^\\n\\r]+)`, 'gi')
        ];
        
        for (const pattern of patterns) {
          const matches = content.matchAll(pattern);
          for (const match of matches) {
            const dateText = match[1];
            const extractedDates = this.extractAllCiscoDates(dateText);
            
            if (extractedDates.length > 0) {
              dates[field + '_date'] = extractedDates[0].date;
              break;
            }
          }
        }
      }
    }
    
    return dates;
  }

  /**
   * Extract dates from lists and bullet points
   */
  extractDatesFromLists(content, productId) {
    const dates = {};
    
    const lines = content.split(/[\n\r]+/);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLower = line.toLowerCase();
      const productLower = productId.toLowerCase();
      
      if (lineLower.includes(productLower)) {
        // Check surrounding lines for dates
        for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) {
          const checkLine = lines[j];
          
          for (const [field, keywords] of Object.entries(this.eolMilestones)) {
            for (const keyword of keywords) {
              if (checkLine.toLowerCase().includes(keyword.toLowerCase())) {
                const extractedDates = this.extractAllCiscoDates(checkLine);
                if (extractedDates.length > 0) {
                  dates[field + '_date'] = extractedDates[0].date;
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
   * Extract all Cisco format dates from text
   */
  extractAllCiscoDates(text) {
    const dates = [];
    
    for (const [patternName, pattern] of Object.entries(this.ciscoDatePatterns)) {
      const matches = text.matchAll(pattern);
      
      for (const match of matches) {
        const normalized = this.normalizeCiscoDate(match[0], patternName, match);
        if (normalized && this.isValidDate(normalized)) {
          dates.push({
            date: normalized,
            original: match[0],
            position: match.index || 0,
            pattern: patternName
          });
        }
      }
    }
    
    // Sort by position and remove duplicates
    dates.sort((a, b) => a.position - b.position);
    
    const uniqueDates = [];
    const seen = new Set();
    for (const dateObj of dates) {
      if (!seen.has(dateObj.date)) {
        uniqueDates.push(dateObj);
        seen.add(dateObj.date);
      }
    }
    
    return uniqueDates;
  }

  /**
   * Normalize Cisco date formats to YYYY-MM-DD
   */
  normalizeCiscoDate(dateStr, patternName, matchGroups) {
    try {
      const monthMap = {
        'jan': '01', 'january': '01', 'feb': '02', 'february': '02',
        'mar': '03', 'march': '03', 'apr': '04', 'april': '04',
        'may': '05', 'jun': '06', 'june': '06', 'jul': '07', 'july': '07',
        'aug': '08', 'august': '08', 'sep': '09', 'september': '09', 'sept': '09',
        'oct': '10', 'october': '10', 'nov': '11', 'november': '11',
        'dec': '12', 'december': '12'
      };
      
      let year, month, day;
      
      switch (patternName) {
        case 'ciscoFormat':
          // "31-Jan-2015"
          day = matchGroups[1].padStart(2, '0');
          month = monthMap[matchGroups[2].toLowerCase()] || matchGroups[2];
          year = matchGroups[3];
          break;
          
        case 'monthDayYear':
          // "January 31, 2015"
          month = monthMap[matchGroups[1].toLowerCase()];
          day = matchGroups[2].padStart(2, '0');
          year = matchGroups[3];
          break;
          
        case 'isoFormat':
          // Already in correct format
          return dateStr;
          
        case 'slashFormat':
          // "01/31/2015" - assuming MM/DD/YYYY
          month = matchGroups[1].padStart(2, '0');
          day = matchGroups[2].padStart(2, '0');
          year = matchGroups[3];
          break;
          
        case 'dotFormat':
          // "31.01.2015" - assuming DD.MM.YYYY
          day = matchGroups[1].padStart(2, '0');
          month = matchGroups[2].padStart(2, '0');
          year = matchGroups[3];
          break;
          
        case 'quarterFormat':
          // "Q3 2015" - use last day of quarter
          const quarter = parseInt(matchGroups[1]);
          year = matchGroups[2].length === 2 ? '20' + matchGroups[2] : matchGroups[2];
          month = String(quarter * 3).padStart(2, '0');
          const tempDate = new Date(year, quarter * 3, 0);
          day = tempDate.getDate().toString().padStart(2, '0');
          break;
          
        case 'monthYear':
          // "October 2016" - use last day of month
          month = monthMap[matchGroups[1].toLowerCase()];
          year = matchGroups[2];
          const lastDay = new Date(year, parseInt(month), 0);
          day = lastDay.getDate().toString().padStart(2, '0');
          break;
          
        default:
          return this.normalizeDate(dateStr);
      }
      
      if (year && month && day) {
        // Validate components
        if (parseInt(month) > 12 || parseInt(day) > 31) {
          return null;
        }
        
        // Handle 2-digit years
        if (year.length === 2) {
          year = parseInt(year) > 50 ? '19' + year : '20' + year;
        }
        
        return `${year}-${month}-${day}`;
      }
      
    } catch (error) {
      console.error(`Error normalizing date "${dateStr}":`, error.message);
    }
    
    // Fall back to original normalization
    return this.normalizeDate(dateStr);
  }

  /**
   * Original date extraction for non-Cisco products
   */
  extractGenericLifecycleDates(searchResults, product) {
    const dates = {
      date_introduced: null,
      end_of_sale_date: null,
      end_of_sw_maintenance_date: null,
      end_of_sw_vulnerability_maintenance_date: null,
      last_day_of_support_date: null,
      is_current_product: false
    };

    console.log(`\n🔍 DEBUG: Looking for ${product.product_id} dates`);
    console.log(`📊 Found ${searchResults.pages.length} relevant pages`);

    // Process each page
    for (const page of searchResults.pages) {
      const pageDates = this.extractDatesFromPage(page, product);
      
      // Merge with priority
      for (const [key, value] of Object.entries(pageDates)) {
        if (value && !dates[key]) {
          dates[key] = value;
          console.log(`📅 Found ${key}: ${value} from ${page.url}`);
        }
      }
    }

    return dates;
  }

  extractDatesFromPage(page, product) {
    const dates = {};
    const content = (page.content || '').toLowerCase();
    const productId = product.product_id.toLowerCase();

    // Count product mentions
    const productPattern = new RegExp(productId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const productMentions = (content.match(productPattern) || []).length;
    console.log(`🎯 Found ${productMentions} product mentions in content`);

    if (productMentions === 0) {
      return dates;
    }

    // Look for date patterns near lifecycle keywords
    const dateKeywords = {
      end_of_sale_date: [
        'end-of-sale', 'end of sale', 'eos date', 
        'discontinued', 'last date to order'
      ],
      last_day_of_support_date: [
        'end-of-support', 'end of support', 'last date of support',
        'end-of-life', 'end of life', 'eol date'
      ],
      end_of_sw_maintenance_date: [
        'end of software maintenance', 'end of sw maintenance',
        'last date to download software'
      ]
    };

    for (const [field, keywords] of Object.entries(dateKeywords)) {
      for (const keyword of keywords) {
        const keywordIndex = content.indexOf(keyword);
        if (keywordIndex > -1) {
          // Look for dates near this keyword
          const searchStart = Math.max(0, keywordIndex - 200);
          const searchEnd = Math.min(content.length, keywordIndex + 300);
          const context = page.content.substring(searchStart, searchEnd);
          
          const dateMatch = this.findDateInText(context);
          if (dateMatch) {
            const normalized = this.normalizeDate(dateMatch);
            if (normalized && this.isValidDate(normalized)) {
              dates[field] = normalized;
              console.log(`📅 Extracted ${field}: ${normalized} (near "${keyword}")`);
              break;
            }
          }
        }
      }
    }

    return dates;
  }

  identifyMilestone(text, datePosition) {
    const searchRadius = 200;
    const contextStart = Math.max(0, datePosition - searchRadius);
    const contextEnd = Math.min(text.length, datePosition + searchRadius);
    const context = text.substring(contextStart, contextEnd).toLowerCase();
    
    for (const [field, keywords] of Object.entries(this.eolMilestones)) {
      for (const keyword of keywords) {
        if (context.includes(keyword.toLowerCase())) {
          return field + '_date';
        }
      }
    }
    
    return null;
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  findDateInText(text) {
    const datePatterns = [
      // Cisco format "31-Jan-2015"
      /(\d{1,2})[-\s]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\s]+(\d{4})/i,
      // Standard formats
      /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/,
      /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/,
      /([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})/i,
      /(\d{1,2})\s+([A-Z][a-z]+)\s+(\d{4})/i
    ];
    
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }
    
    return null;
  }

  normalizeDate(dateStr) {
    if (!dateStr) return null;
    
    dateStr = dateStr.trim();
    
    const formats = [
      // MM/DD/YYYY or MM-DD-YYYY
      /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/,
      // Month DD, YYYY
      /^([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i,
      // DD Month YYYY or DD-Mon-YYYY (Cisco format)
      /^(\d{1,2})[-\s]+([A-Z][a-z]+)[-\s]+(\d{4})$/i,
      // YYYY-MM-DD
      /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/,
      // Month YYYY (use last day of month)
      /^([A-Z][a-z]{2,})\s+(\d{4})$/i
    ];
    
    const monthMap = {
      'jan': '01', 'january': '01',
      'feb': '02', 'february': '02',
      'mar': '03', 'march': '03',
      'apr': '04', 'april': '04',
      'may': '05',
      'jun': '06', 'june': '06',
      'jul': '07', 'july': '07',
      'aug': '08', 'august': '08',
      'sep': '09', 'september': '09',
      'oct': '10', 'october': '10',
      'nov': '11', 'november': '11',
      'dec': '12', 'december': '12'
    };
    
    // Try each format
    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        try {
          let year, month, day;
          
          if (format.source.includes('[A-Z][a-z]+')) {
            // Month name format
            const monthName = match[1] ? match[1].toLowerCase() : match[2].toLowerCase();
            if (monthName && monthMap[monthName]) {
              month = monthMap[monthName];
              
              if (match.length === 3) {
                // "Oct 2016" format - use last day of month
                year = match[2];
                day = new Date(year, month, 0).getDate();
              } else if (format.source.startsWith('^(\\d{1,2})')) {
                // "31-Jan-2015" format (Cisco)
                day = match[1].padStart(2, '0');
                month = monthMap[match[2].toLowerCase()];
                year = match[3];
              } else {
                // "January 31, 2015" format
                day = match[2].padStart(2, '0');
                year = match[3];
              }
            }
          } else if (format.source.includes('(\\d{4})')) {
            // YYYY-MM-DD format
            year = match[1];
            month = match[2].padStart(2, '0');
            day = match[3].padStart(2, '0');
          } else {
            // MM/DD/YYYY format
            month = match[1].padStart(2, '0');
            day = match[2].padStart(2, '0');
            year = match[3];
          }
          
          if (year && month && day) {
            return `${year}-${month}-${day}`;
          }
        } catch (e) {
          console.error(`Date parsing error for "${dateStr}":`, e.message);
        }
      }
    }
    
    return null;
  }

  isValidDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const yearFromNow = new Date();
    yearFromNow.setFullYear(yearFromNow.getFullYear() + 20);
    
    return !isNaN(date.getTime()) && 
           date.getFullYear() >= 2000 && 
           date <= yearFromNow;
  }

  isVendorSite(url, manufacturer) {
    const vendorDomains = {
      cisco: ['cisco.com', 'meraki.com'],
      hpe: ['hpe.com', 'hp.com', 'arubanetworks.com'],
      dell: ['dell.com', 'delltechnologies.com', 'emc.com'],
      juniper: ['juniper.net'],
      fortinet: ['fortinet.com'],
      'palo alto': ['paloaltonetworks.com']
    };
    
    const mfr = (manufacturer || '').toLowerCase();
    const domains = vendorDomains[mfr] || [];
    
    return domains.some(domain => url.includes(domain));
  }

  isMarkedAsCurrent(content, productId) {
    const currentIndicators = [
      'currently supported',
      'currently available',
      'active product',
      'in production',
      'current model',
      'latest version'
    ];
    
    const productContext = content.toLowerCase();
    const productLower = productId.toLowerCase();
    
    return currentIndicators.some(indicator => {
      const indicatorIndex = productContext.indexOf(indicator);
      if (indicatorIndex > -1) {
        const productIndex = productContext.indexOf(productLower);
        return Math.abs(indicatorIndex - productIndex) < 200;
      }
      return false;
    });
  }

  applyDateLogic(dates, product) {
    // Apply business logic for date relationships
    
    // If we have EOS but no LDOS, estimate LDOS as 5 years after EOS
    if (dates.end_of_sale_date && !dates.last_day_of_support_date) {
      const eosDate = new Date(dates.end_of_sale_date);
      const ldosDate = new Date(eosDate);
      ldosDate.setFullYear(ldosDate.getFullYear() + 5);
      dates.last_day_of_support_date = ldosDate.toISOString().split('T')[0];
      console.log(`📊 Estimated LDOS as 5 years after EOS`);
    }
    
    // If we have LDOS but no EOS, estimate EOS as 5 years before LDOS
    if (dates.last_day_of_support_date && !dates.end_of_sale_date) {
      const ldosDate = new Date(dates.last_day_of_support_date);
      const eosDate = new Date(ldosDate);
      eosDate.setFullYear(eosDate.getFullYear() - 5);
      dates.end_of_sale_date = eosDate.toISOString().split('T')[0];
      console.log(`📊 Estimated EOS as 5 years before LDOS`);
    }
    
    // Software maintenance typically ends 1 year after EOS for Cisco
    const manufacturer = (product.manufacturer || '').toLowerCase();
    if (manufacturer.includes('cisco') && dates.end_of_sale_date && !dates.end_of_sw_maintenance_date) {
      const eosDate = new Date(dates.end_of_sale_date);
      const swDate = new Date(eosDate);
      swDate.setFullYear(swDate.getFullYear() + 1);
      dates.end_of_sw_maintenance_date = swDate.toISOString().split('T')[0];
    }
    
    // Set is_current_product based on dates
    if (dates.end_of_sale_date) {
      const eosDate = new Date(dates.end_of_sale_date);
      const today = new Date();
      dates.is_current_product = eosDate > today;
    }
    
    return dates;
  }

  // Give higher confidence to results from authorized sources:
    calculateConfidence(dates, searchResults) {
      let lifecycleConfidence = 0;
      let overallConfidence = 0;
      
      // Higher confidence for vendor sites (since we only use authorized now)
      if (searchResults.sources.vendor_site > 0) {
        lifecycleConfidence += 60;  // Increased from 40
        overallConfidence += 60;    // Increased from 40
      }
      
      // Lower confidence for any third-party that slipped through
      if (searchResults.sources.third_party > 0) {
        lifecycleConfidence += 10;  // Reduced from 20
        overallConfidence += 10;    // Reduced from 20
      }
    
    // Base confidence on data sources
    if (searchResults.sources.vendor_site > 0) {
      lifecycleConfidence += 40;
      overallConfidence += 40;
    }
    
    if (searchResults.sources.third_party > 0) {
      lifecycleConfidence += 20;
      overallConfidence += 20;
    }
    
    // Confidence based on dates found
    const dateFields = [
      'end_of_sale_date',
      'last_day_of_support_date',
      'end_of_sw_maintenance_date'
    ];
    
    const foundDates = dateFields.filter(field => dates[field] !== null).length;
    lifecycleConfidence += foundDates * 15;
    overallConfidence += foundDates * 10;
    
    // Cap at 95% (never 100% certain with web scraping)
    lifecycleConfidence = Math.min(lifecycleConfidence, 95);
    overallConfidence = Math.min(overallConfidence, 90);
    
    // Minimum confidence if we found something
    if (foundDates > 0) {
      lifecycleConfidence = Math.max(lifecycleConfidence, 50);
      overallConfidence = Math.max(overallConfidence, 40);
    }
    
    return {
      lifecycle: lifecycleConfidence,
      overall: overallConfidence
    };
  }

  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    
    if (timeSinceLastCall < this.minTimeBetweenCalls) {
      const waitTime = this.minTimeBetweenCalls - timeSinceLastCall;
      console.log(`⏱️ Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastCallTime = Date.now();
  }

  async handleRateLimit(error, attempt = 0) {
    if (attempt >= this.maxRetries) {
      throw new Error('Max retries exceeded for rate limiting');
    }
    
    // Exponential backoff: 2s, 4s, 8s, 16s, 32s
    const waitTime = Math.min(Math.pow(2, attempt + 1) * 1000, 32000);
    console.log(`🔄 Retry attempt ${attempt + 1}/${this.maxRetries} after ${waitTime}ms`);
    
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

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

module.exports = new GoogleAIResearchService();
