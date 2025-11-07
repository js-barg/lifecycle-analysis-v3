/**
 * Enhanced Cisco Date Extraction Module
 * Improvements:
 * 1. Better Cisco date format parsing (31-Jan-2015)
 * 2. Table extraction from EOL notices
 * 3. Improved proximity detection for dates near product mentions
 * 4. PDF content handling
 * 5. Specific Cisco EOL page patterns
 */

class ImprovedCiscoDateExtractor {
  constructor() {
    // Cisco-specific date patterns
    this.ciscoDatePatterns = {
      // "31-Jan-2015" or "January 31, 2015"
      ciscoFormat: /(\d{1,2})[-\s]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\s]+(\d{4})/gi,
      // "January 31, 2015"
      monthDayYear: /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/gi,
      // "2015-01-31" ISO format
      isoFormat: /(\d{4})-(\d{2})-(\d{2})/g,
      // "01/31/2015" or "1/31/2015"
      slashFormat: /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
      // "31.01.2015"
      dotFormat: /(\d{1,2})\.(\d{1,2})\.(\d{4})/g,
      // Quarter formats "Q1 2015" or "Q1FY15"
      quarterFormat: /Q([1-4])\s*(?:FY)?(\d{2,4})/gi,
      // "October 2016" (month year only)
      monthYear: /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/gi
    };

    // Cisco EOL milestone keywords with variations
    this.eolMilestones = {
      end_of_sale: [
        'End-of-Sale',
        'End of Sale',
        'EoS Date',
        'End-of-Sale Date',
        'End of Sale and End of Life',
        'End-of-Sale and End-of-Life Announcement',
        'Last Date to Order',
        'End of Sale Date',
        'EOS'
      ],
      last_day_support: [
        'End-of-Support',
        'End of Support',
        'Last Date of Support',
        'End of Service Life',
        'End-of-Life',
        'End of Life',
        'EoL Date',
        'End-of-Life Date',
        'End of Service Contract Renewal',
        'Last Date to Receive Service',
        'LDOS',
        'EOL'
      ],
      end_sw_maintenance: [
        'End of Software Maintenance',
        'End of SW Maintenance Release',
        'Last Date to Download Software',
        'End of Vulnerability Support',
        'End of Security Vulnerability Support',
        'End of Software Maintenance Releases',
        'End of SW Maintenance'
      ],
      end_routine_failure: [
        'End of Routine Failure Analysis',
        'End of RFA',
        'End of Routine Failure Analysis Date'
      ],
      end_new_service: [
        'End of New Service Attachment',
        'End of Service Contract Renewal',
        'End of Contract Renewal'
      ]
    };

    this.monthMap = {
      'jan': '01', 'january': '01',
      'feb': '02', 'february': '02',
      'mar': '03', 'march': '03',
      'apr': '04', 'april': '04',
      'may': '05',
      'jun': '06', 'june': '06',
      'jul': '07', 'july': '07',
      'aug': '08', 'august': '08',
      'sep': '09', 'september': '09', 'sept': '09',
      'oct': '10', 'october': '10',
      'nov': '11', 'november': '11',
      'dec': '12', 'december': '12'
    };
  }

  /**
   * Main extraction method
   */
  extractLifecycleDates(searchResults, product) {
    const dates = {
      date_introduced: null,
      end_of_sale_date: null,
      end_of_sw_maintenance_date: null,
      end_of_sw_vulnerability_maintenance_date: null,
      last_day_of_support_date: null,
      end_of_routine_failure_date: null,
      end_of_new_service_date: null,
      is_current_product: false,
      extraction_metadata: {
        sources: [],
        confidence_factors: []
      }
    };

    console.log(`\n🔍 DEBUG: Looking for ${product.product_id} dates`);

    // Process each page
    for (const page of searchResults.pages) {
      try {
        const pageDates = this.extractDatesFromPage(page, product.product_id);
        
        // Merge dates with priority to vendor sites
        const isVendorSite = this.isVendorSite(page.url, product.manufacturer);
        const priority = isVendorSite ? 10 : 5;
        
        this.mergeDates(dates, pageDates, page.url, priority);
        
      } catch (error) {
        console.error(`Error extracting from ${page.url}:`, error.message);
      }
    }

    // Apply Cisco-specific date logic
    this.applyCiscoDateLogic(dates, product);

    return dates;
  }

  /**
   * Extract dates from a single page
   */
  extractDatesFromPage(page, productId) {
    const dates = {};
    const content = (page.content || '').toLowerCase();
    const originalContent = page.content || '';
    
    // Count product mentions for validation
    const productMentions = this.countProductMentions(content, productId);
    console.log(`🎯 Found ${productMentions} product mentions in content`);

    if (productMentions === 0) {
      return dates;
    }

    // Strategy 1: Look for tables (common in Cisco EOL notices)
    const tableDates = this.extractDatesFromTables(originalContent, productId);
    Object.assign(dates, tableDates);

    // Strategy 2: Extract dates near product mentions
    const proximityDates = this.extractDatesWithProximity(originalContent, productId);
    Object.assign(dates, proximityDates);

    // Strategy 3: Look for structured EOL sections
    const structuredDates = this.extractStructuredEOLDates(originalContent, productId);
    Object.assign(dates, structuredDates);

    // Strategy 4: Extract from bullet points and lists
    const listDates = this.extractDatesFromLists(originalContent, productId);
    Object.assign(dates, listDates);

    return dates;
  }

  /**
   * Extract dates from HTML tables (common in Cisco EOL notices)
   */
  extractDatesFromTables(content, productId) {
    const dates = {};
    
    // Look for table patterns
    const tablePatterns = [
      // HTML table cells
      /<tr[^>]*>[\s\S]*?<\/tr>/gi,
      /<td[^>]*>[\s\S]*?<\/td>/gi,
      // Table-like structures with | separators
      /\|([^|]+)\|([^|]+)\|/g,
      // Tab-separated values
      /([^\t]+)\t([^\t]+)/g
    ];

    for (const pattern of tablePatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const row = match[0];
        
        // Check if this row contains the product ID
        if (row.toLowerCase().includes(productId.toLowerCase())) {
          // Extract all dates from this row and adjacent rows
          const rowDates = this.extractAllDatesFromText(row);
          
          // Try to identify what each date represents
          for (const dateObj of rowDates) {
            const milestone = this.identifyMilestone(row, dateObj.position);
            if (milestone) {
              dates[milestone] = dateObj.date;
              console.log(`📅 Extracted ${milestone}: ${dateObj.date} from table`);
            }
          }
        }
        
        // Also check milestone rows that might be headers
        for (const [field, keywords] of Object.entries(this.eolMilestones)) {
          for (const keyword of keywords) {
            if (row.includes(keyword)) {
              const rowDates = this.extractAllDatesFromText(row);
              if (rowDates.length > 0) {
                dates[field + '_date'] = rowDates[0].date;
                console.log(`📅 Found ${field}_date: ${rowDates[0].date} in milestone row`);
              }
            }
          }
        }
      }
    }

    return dates;
  }

  /**
   * Extract dates that appear near product mentions
   */
  extractDatesWithProximity(content, productId) {
    const dates = {};
    const productPattern = new RegExp(this.escapeRegex(productId), 'gi');
    const matches = content.matchAll(productPattern);
    
    for (const match of matches) {
      const position = match.index;
      
      // Get context around the product mention (500 chars before and after)
      const contextStart = Math.max(0, position - 500);
      const contextEnd = Math.min(content.length, position + productId.length + 500);
      const context = content.substring(contextStart, contextEnd);
      
      // Look for milestone keywords and dates in the context
      for (const [field, keywords] of Object.entries(this.eolMilestones)) {
        for (const keyword of keywords) {
          const keywordIndex = context.toLowerCase().indexOf(keyword.toLowerCase());
          if (keywordIndex > -1) {
            // Found a milestone keyword, now look for dates near it
            const dateSearchStart = Math.max(0, keywordIndex - 100);
            const dateSearchEnd = Math.min(context.length, keywordIndex + keyword.length + 100);
            const dateContext = context.substring(dateSearchStart, dateSearchEnd);
            
            const extractedDates = this.extractAllDatesFromText(dateContext);
            if (extractedDates.length > 0) {
              // Use the first date found near the milestone
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
    
    // Look for structured patterns like "End-of-Sale Date: January 31, 2015"
    for (const [field, keywords] of Object.entries(this.eolMilestones)) {
      for (const keyword of keywords) {
        // Pattern: keyword followed by colon or dash, then date
        const patterns = [
          new RegExp(`${this.escapeRegex(keyword)}\\s*[:–-]\\s*([^\\n\\r]+)`, 'gi'),
          new RegExp(`${this.escapeRegex(keyword)}\\s+(?:is|was|will be)?\\s*[:–-]?\\s*([^\\n\\r]+)`, 'gi')
        ];
        
        for (const pattern of patterns) {
          const matches = content.matchAll(pattern);
          for (const match of matches) {
            const dateText = match[1];
            const extractedDates = this.extractAllDatesFromText(dateText);
            
            if (extractedDates.length > 0) {
              dates[field + '_date'] = extractedDates[0].date;
              console.log(`📅 Found structured ${field}_date: ${extractedDates[0].date}`);
              break; // Use first valid date found
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
    
    // Split content into lines
    const lines = content.split(/[\n\r]+/);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLower = line.toLowerCase();
      const productLower = productId.toLowerCase();
      
      // Check if line mentions the product
      if (lineLower.includes(productLower)) {
        // Check surrounding lines for milestone keywords and dates
        for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) {
          const checkLine = lines[j];
          
          for (const [field, keywords] of Object.entries(this.eolMilestones)) {
            for (const keyword of keywords) {
              if (checkLine.toLowerCase().includes(keyword.toLowerCase())) {
                const extractedDates = this.extractAllDatesFromText(checkLine);
                if (extractedDates.length > 0) {
                  dates[field + '_date'] = extractedDates[0].date;
                  console.log(`📅 Found ${field}_date: ${extractedDates[0].date} in list`);
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
   * Extract all dates from a text string
   */
  extractAllDatesFromText(text) {
    const dates = [];
    
    // Try each date pattern
    for (const [patternName, pattern] of Object.entries(this.ciscoDatePatterns)) {
      const matches = text.matchAll(pattern);
      
      for (const match of matches) {
        const normalized = this.normalizeDate(match[0], patternName, match);
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
    
    // Sort by position in text
    dates.sort((a, b) => a.position - b.position);
    
    // Remove duplicates
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
   * Normalize various date formats to YYYY-MM-DD
   */
  normalizeDate(dateStr, patternName, matchGroups) {
    try {
      let year, month, day;
      
      switch (patternName) {
        case 'ciscoFormat':
          // "31-Jan-2015"
          day = matchGroups[1].padStart(2, '0');
          month = this.monthMap[matchGroups[2].toLowerCase()] || matchGroups[2];
          year = matchGroups[3];
          break;
          
        case 'monthDayYear':
          // "January 31, 2015"
          month = this.monthMap[matchGroups[1].toLowerCase()];
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
          // "Q1 2015" - use last day of quarter
          const quarter = parseInt(matchGroups[1]);
          year = matchGroups[2].length === 2 ? '20' + matchGroups[2] : matchGroups[2];
          month = String(quarter * 3).padStart(2, '0');
          // Get last day of the quarter month
          const tempDate = new Date(year, quarter * 3, 0);
          day = tempDate.getDate().toString().padStart(2, '0');
          break;
          
        case 'monthYear':
          // "October 2016" - use last day of month
          month = this.monthMap[matchGroups[1].toLowerCase()];
          year = matchGroups[2];
          // Get last day of the month
          const lastDay = new Date(year, parseInt(month), 0);
          day = lastDay.getDate().toString().padStart(2, '0');
          break;
          
        default:
          return null;
      }
      
      if (year && month && day) {
        // Validate the date components
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
    
    return null;
  }

  /**
   * Identify which milestone a date represents based on surrounding text
   */
  identifyMilestone(text, datePosition) {
    const searchRadius = 200; // Characters to search before/after date
    const contextStart = Math.max(0, datePosition - searchRadius);
    const contextEnd = Math.min(text.length, datePosition + searchRadius);
    const context = text.substring(contextStart, contextEnd).toLowerCase();
    
    // Check each milestone type
    for (const [field, keywords] of Object.entries(this.eolMilestones)) {
      for (const keyword of keywords) {
        if (context.includes(keyword.toLowerCase())) {
          return field + '_date';
        }
      }
    }
    
    return null;
  }

  /**
   * Count how many times the product is mentioned
   */
  countProductMentions(content, productId) {
    const pattern = new RegExp(this.escapeRegex(productId), 'gi');
    const matches = content.match(pattern);
    return matches ? matches.length : 0;
  }

  /**
   * Escape special regex characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Check if a date is valid
   */
  isValidDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const futureLimit = new Date();
    futureLimit.setFullYear(futureLimit.getFullYear() + 20);
    
    return !isNaN(date.getTime()) && 
           date.getFullYear() >= 2000 && 
           date <= futureLimit;
  }

  /**
   * Check if URL is from vendor site
   */
  isVendorSite(url, manufacturer) {
    const vendorDomains = {
      cisco: ['cisco.com', 'meraki.com'],
      hpe: ['hpe.com', 'hp.com', 'arubanetworks.com'],
      dell: ['dell.com', 'delltechnologies.com'],
      juniper: ['juniper.net'],
      fortinet: ['fortinet.com'],
      'palo alto': ['paloaltonetworks.com']
    };
    
    const mfr = (manufacturer || '').toLowerCase();
    const domains = vendorDomains[mfr] || [];
    
    return domains.some(domain => url.includes(domain));
  }

  /**
   * Merge dates with priority system
   */
  mergeDates(target, source, url, priority) {
    for (const [key, value] of Object.entries(source)) {
      if (value && !target[key]) {
        target[key] = value;
        if (!target.extraction_metadata.sources.find(s => s.url === url)) {
          target.extraction_metadata.sources.push({
            url,
            priority,
            dates_found: Object.keys(source).filter(k => source[k])
          });
        }
      }
    }
  }

  /**
   * Apply Cisco-specific date logic and estimates
   */
  applyCiscoDateLogic(dates, product) {
    // Cisco typically has 5-year support lifecycle after EOS
    if (dates.end_of_sale_date && !dates.last_day_of_support_date) {
      const eosDate = new Date(dates.end_of_sale_date);
      const ldosDate = new Date(eosDate);
      ldosDate.setFullYear(ldosDate.getFullYear() + 5);
      dates.last_day_of_support_date = ldosDate.toISOString().split('T')[0];
      dates.extraction_metadata.confidence_factors.push('LDOS estimated from EOS + 5 years');
      console.log(`📊 Estimated LDOS as 5 years after EOS`);
    }
    
    // If we have LDOS but no EOS, estimate EOS
    if (dates.last_day_of_support_date && !dates.end_of_sale_date) {
      const ldosDate = new Date(dates.last_day_of_support_date);
      const eosDate = new Date(ldosDate);
      eosDate.setFullYear(eosDate.getFullYear() - 5);
      dates.end_of_sale_date = eosDate.toISOString().split('T')[0];
      dates.extraction_metadata.confidence_factors.push('EOS estimated from LDOS - 5 years');
      console.log(`📊 Estimated EOS as 5 years before LDOS`);
    }
    
    // Software maintenance typically ends 1 year after EOS for Cisco
    if (dates.end_of_sale_date && !dates.end_of_sw_maintenance_date) {
      const eosDate = new Date(dates.end_of_sale_date);
      const swDate = new Date(eosDate);
      swDate.setFullYear(swDate.getFullYear() + 1);
      dates.end_of_sw_maintenance_date = swDate.toISOString().split('T')[0];
      dates.extraction_metadata.confidence_factors.push('SW Maintenance estimated from EOS + 1 year');
    }
    
    // Set is_current_product based on dates
    if (dates.end_of_sale_date) {
      const eosDate = new Date(dates.end_of_sale_date);
      const today = new Date();
      dates.is_current_product = eosDate > today;
    }
    
    return dates;
  }
}

/**
 * Enhanced search query builder specifically for Cisco products
 */
class CiscoSearchQueryBuilder {
  buildEnhancedQueries(product) {
    const productId = product.product_id;
    const queries = [];
    
    // Core Cisco-specific patterns
    queries.push(`"${productId}" site:cisco.com/c/en/us/products/eos-eol-notice-listing.html`);
    queries.push(`"${productId}" site:cisco.com/c/en/us/products/collateral/ "End-of-Sale"`);
    queries.push(`"${productId}" "Cisco announces" "End-of-Sale"`);
    queries.push(`"${productId}" inurl:eos-eol-notice site:cisco.com`);
    queries.push(`"${productId}" filetype:pdf "End-of-Life Announcement" site:cisco.com`);
    
    // Bulletin-specific searches
    queries.push(`"${productId}" "Product Bulletin" "PB" site:cisco.com`);
    queries.push(`"${productId}" "Field Notice" "FN" site:cisco.com`);
    
    // Check for specific product lines
    if (productId.match(/^WS-C/i)) {
      // Catalyst switches
      queries.push(`"${productId}" site:cisco.com/c/en/us/products/switches/`);
    }
    
    if (productId.match(/^N[0-9]+K-/i)) {
      // Nexus switches
      queries.push(`"${productId}" site:cisco.com/c/en/us/products/switches/ "Nexus"`);
    }
    
    if (productId.match(/^ISR/i)) {
      // ISR routers
      queries.push(`"${productId}" site:cisco.com/c/en/us/products/routers/ "ISR"`);
    }
    
    if (productId.match(/^ASR/i)) {
      // ASR routers
      queries.push(`"${productId}" site:cisco.com/c/en/us/products/routers/ "ASR"`);
    }
    
    if (productId.match(/^AIR-/i)) {
      // Wireless access points
      queries.push(`"${productId}" site:cisco.com/c/en/us/products/wireless/ "Aironet"`);
    }
    
    // Try variations without suffixes
    const baseProduct = productId.replace(/-(K9|L|S|E|P|X|HW|SW)$/i, '');
    if (baseProduct !== productId) {
      queries.push(`"${baseProduct}" site:cisco.com "End-of-Sale"`);
    }
    
    return queries;
  }
}

// Export the improved modules
module.exports = {
  ImprovedCiscoDateExtractor,
  CiscoSearchQueryBuilder
};

/**
 * Integration with existing GoogleAIResearchService
 * 
 * To use this improved extractor, replace the extractLifecycleDates method 
 * in your existing service with:
 * 
 * const { ImprovedCiscoDateExtractor, CiscoSearchQueryBuilder } = require('./improvedCiscoDateExtraction');
 * 
 * class GoogleAIResearchService {
 *   constructor() {
 *     // ... existing constructor code ...
 *     this.ciscoExtractor = new ImprovedCiscoDateExtractor();
 *     this.ciscoQueryBuilder = new CiscoSearchQueryBuilder();
 *   }
 * 
 *   buildEnhancedSearchQueries(product) {
 *     const manufacturer = (product.manufacturer || '').toLowerCase();
 *     
 *     // Use specialized Cisco query builder for Cisco products
 *     if (manufacturer.includes('cisco') || product.product_id.match(/^(WS-|N\d+K-|ISR|ASR|AIR-)/i)) {
 *       return this.ciscoQueryBuilder.buildEnhancedQueries(product);
 *     }
 *     
 *     // ... existing query building logic for other vendors ...
 *   }
 * 
 *   extractLifecycleDates(searchResults, product) {
 *     const manufacturer = (product.manufacturer || '').toLowerCase();
 *     
 *     // Use specialized Cisco extractor for Cisco products
 *     if (manufacturer.includes('cisco') || product.product_id.match(/^(WS-|N\d+K-|ISR|ASR|AIR-)/i)) {
 *       return this.ciscoExtractor.extractLifecycleDates(searchResults, product);
 *     }
 *     
 *     // ... existing extraction logic for other vendors ...
 *   }
 * }
 */