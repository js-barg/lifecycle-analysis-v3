// backend/src/services/googleAIResearchService.js
// PRODUCTION-READY VERSION - Modified Prototype with Cloud compatibility
// This version maintains the superior verification logic while matching the production interface exactly
const axios = require('axios');

class GoogleAIResearchService {
    constructor() {
        this.apiKey = process.env.GOOGLE_API_KEY;
        this.searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
        this.searchUrl = 'https://www.googleapis.com/customsearch/v1';
        this.maxRetries = 3;
        
        // Initialize vendor domains for source classification
        this.vendorDomains = [
            'cisco.com', 'meraki.com', 'documentation.meraki.com',
            'dell.com', 'delltechnologies.com', 
            'hp.com', 'hpe.com', 'arubanetworks.com',
            'juniper.net', 'fortinet.com', 'paloaltonetworks.com',
            'arista.com', 'vmware.com', 'netapp.com',
            'microsoft.com', 'lenovo.com', 'ibm.com'
        ];
    }

    // =====================================================
    // MAIN PRODUCTION INTERFACE - Matches Cloud Version exactly
    // =====================================================
    async performResearch(product) {
        console.log(`🔍 Starting research for ${product.product_id}`);
        
        try {
            // Call the internal enhanced research method
            const result = await this._performEnhancedResearch({
                product_id: product.product_id || '',
                manufacturer: product.manufacturer || '',
                product_category: product.product_category || product.category || '',
                product_type: product.product_type || product.type || '',
                description: product.description || product.product_description || ''
            });
            
            // Transform to EXACT production format
            return {
                date_introduced: result.date_introduced || null,
                end_of_sale_date: result.end_of_sale_date || null,
                end_of_sw_maintenance_date: result.end_of_sw_maintenance_date || null,
                end_of_sw_vulnerability_maintenance_date: result.end_of_sw_vulnerability_maintenance_date || null,
                last_day_of_support_date: result.last_day_of_support_date || null,
                is_current_product: result.is_current_product || false,
                lifecycle_confidence: result.lifecycle_confidence || 0,
                overall_confidence: result.overall_confidence || 0,
                data_sources: this._transformDataSources(result.data_sources)
            };
            
        } catch (error) {
            console.error(`❌ Research failed for ${product.product_id}:`, error.message);
            return this._getDefaultResult();
        }
    }

    // =====================================================
    // INTERNAL ENHANCED RESEARCH - Prototype's superior logic
    // =====================================================
    async _performEnhancedResearch(record) {
        console.log('🔵 ==========================================');
        console.log('🔵 ENHANCED MULTI-VENDOR EOL RESEARCH');
        console.log('🔵 Product:', record.product_id);
        console.log('🔵 ==========================================');
        
        if (!this.apiKey || !this.searchEngineId) {
            console.error('❌ Missing Google API credentials');
            return this._createErrorResult(record, 'API credentials not configured');
        }
        
        try {
            const productId = record.product_id || '';
            const manufacturer = this._extractManufacturer(record);
            
            // Build search queries - works for ALL vendors
            const searchQueries = this._buildUniversalSearchQueries(record);
            
            console.log(`   🔎 Searching with ${searchQueries.length} queries...`);
            
            let allDates = {
                date_introduced: null,
                end_of_sale_date: null,
                end_of_sw_maintenance_date: null,
                end_of_sw_vulnerability_maintenance_date: null,
                last_day_of_support_date: null,
                sources: [],
                confidence: 0,
                sw_maintenance_defaulted: false,
                sw_vulnerability_defaulted: false,
                estimated_ldos: false,
                estimated_eos: false
            };
            
            const processedUrls = new Set();
            
            for (const query of searchQueries) {
                // Stop if we found the main dates
                if (allDates.end_of_sale_date && allDates.last_day_of_support_date && 
                    allDates.end_of_sw_maintenance_date && allDates.end_of_sw_vulnerability_maintenance_date) {
                    console.log('   ✅ Found all milestone dates, stopping search');
                    break;
                }
                
                console.log(`🔍 Searching: ${query}`);
                
                try {
                    const response = await this._performAPICallWithRetry(this.searchUrl, {
                        key: this.apiKey,
                        cx: this.searchEngineId,
                        q: query,
                        num: 3
                    }, 5);
                    
                    if (response && response.items) {
                        for (const item of response.items) {
                            const url = item.link;
                            const title = item.title || '';
                            const snippet = item.snippet || '';
                            
                            if (processedUrls.has(url)) continue;
                            processedUrls.add(url);
                            
                            // Check if this looks like an EOL page AND mentions our specific product
                            const isEOLPage = this._isEOLPage(url, title, snippet, productId);
                            
                            if (isEOLPage) {
                                console.log(`   📄 Processing EOL page for ${productId}: ${url.substring(0, 80)}...`);
                                
                                let extractedDates = {};
                                let fullContent = snippet;
                                
                                // Try to fetch the full page for better extraction
                                if (this._shouldFetchFullPage(url)) {
                                    try {
                                        console.log(`   📥 Fetching full page content...`);
                                        const pageResponse = await axios.get(url, { timeout: 10000 });
                                        fullContent = pageResponse.data.toString();
                                        extractedDates = this._extractLifecycleDates(fullContent, productId);
                                    } catch (fetchError) {
                                        console.log(`   ⚠️ Could not fetch full page, using snippet`);
                                        extractedDates = this._extractLifecycleDates(snippet, productId);
                                    }
                                } else {
                                    extractedDates = this._extractLifecycleDates(snippet, productId);
                                }
                                
                                // Verify dates are for THIS specific product
                                if (this._verifyDatesForProduct(fullContent, productId, extractedDates)) {
                                    this._mergeDates(allDates, extractedDates, url);
                                } else {
                                    console.log(`   ❌ Dates don't match ${productId} - rejecting`);
                                }
                            }
                        }
                    }
                } catch (searchError) {
                    console.warn(`   ⚠️ Search failed: ${searchError.message}`);
                }
            }
            
            // Apply date logic for missing dates
            allDates = this._applyDateLogic(allDates);
            
            // Calculate confidence
            let confidence = this._calculateConfidence(allDates);
            
            return this._createSuccessResult(record, allDates, confidence);
            
        } catch (error) {
            console.error('❌ Research error:', error.message);
            return this._createErrorResult(record, error.message);
        }
    }

    // =====================================================
    // UNIVERSAL SEARCH QUERIES - Works for all vendors
    // =====================================================
    _buildUniversalSearchQueries(record) {
        const productId = record.product_id || '';
        const queries = [];
        
        // Priority 1: Exact product with EOL keywords (universal)
        queries.push(`"${productId}" "End-of-Sale" "End-of-Life"`);
        queries.push(`"${productId}" "EOL" "announcement"`);
        queries.push(`"${productId}" "Last Date of Support"`);
        queries.push(`"${productId}" end of life milestones`);
        
        // Priority 2: Product series if applicable
        const productBase = productId.split('-').slice(0, 2).join('-');
        if (productBase !== productId && productBase.length > 3) {
            queries.push(`"${productBase}" series EOL "${productId}"`);
        }
        
        // Priority 3: Add manufacturer-specific search if known
        if (record.manufacturer) {
            const mfr = record.manufacturer.toLowerCase();
            if (mfr.includes('cisco')) {
                queries.push(`"${productId}" site:cisco.com/c/en/us/products/eos-eol-notice-listing.html`);
            } else if (mfr.includes('hp') || mfr.includes('hpe')) {
                queries.push(`"${productId}" site:hpe.com EOL`);
            } else if (mfr.includes('dell')) {
                queries.push(`"${productId}" site:dell.com "end of life"`);
            } else if (mfr.includes('juniper')) {
                queries.push(`"${productId}" site:juniper.net EOL`);
            } else if (mfr.includes('palo') || mfr.includes('alto')) {
                queries.push(`"${productId}" site:paloaltonetworks.com "end of life"`);
            } else if (mfr.includes('arista')) {
                queries.push(`"${productId}" site:arista.com EOL`);
            }
        }
        
        return queries;
    }

    // =====================================================
    // API CALL WITH RETRY - Handles rate limiting
    // =====================================================
    async _performAPICallWithRetry(url, params = {}, maxRetries = 5) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await axios.get(url, {
                    params: params,
                    timeout: 10000
                });
                
                return response.data;
                
            } catch (error) {
                lastError = error;
                
                if (error.response?.status === 429) {
                    // Rate limit hit - exponential backoff
                    const waitTime = Math.min(Math.pow(2, attempt) * 5, 120);
                    console.log(`⚠️ Rate limit hit, attempt ${attempt}/${maxRetries}. Waiting ${waitTime}s...`);
                    
                    if (attempt === maxRetries) {
                        throw new Error('Google API rate limit exceeded. Please wait before continuing.');
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                    
                } else if (error.response?.status >= 500) {
                    // Server error - retry with shorter wait
                    const waitTime = attempt * 2;
                    console.log(`Server error (${error.response.status}), retrying in ${waitTime}s...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                    
                } else {
                    throw error;
                }
            }
        }
        
        throw lastError;
    }

    // =====================================================
    // DATE EXTRACTION - Universal for all vendors
    // =====================================================
    _extractLifecycleDates(content, productId) {
        console.log(`\n📋 Extracting dates for ${productId}...`);
        
        const dates = {
            date_introduced: null,
            end_of_sale_date: null,
            end_of_sw_maintenance_date: null,
            end_of_sw_vulnerability_maintenance_date: null,
            last_day_of_support_date: null
        };
        
        // Check if product is mentioned
        const contentLower = content.toLowerCase();
        const productIdLower = productId.toLowerCase();
        
        if (!contentLower.includes(productIdLower)) {
            console.log(`   ⚠️ Product ${productId} not mentioned - skipping extraction`);
            return dates;
        }
        
        // Find dates near product mentions
        const productIndex = contentLower.indexOf(productIdLower);
        const contextRadius = 500;
        const contextStart = Math.max(0, productIndex - contextRadius);
        const contextEnd = Math.min(content.length, productIndex + productIdLower.length + contextRadius);
        const contextText = content.substring(contextStart, contextEnd);
        
        // Extract dates using multiple patterns
        const datePatterns = [
            /(\d{4}-\d{2}-\d{2})/g,
            /(\w+\s+\d{1,2},?\s+\d{4})/g,
            /(\d{1,2}[/-]\d{1,2}[/-]\d{4})/g
        ];
        
        const milestones = {
            end_of_sale: ['end-of-sale', 'end of sale', 'eos date', 'last date to order'],
            last_support: ['last date of support', 'end-of-support', 'end of support', 'ldos', 'end-of-life', 'eol date'],
            sw_maintenance: ['software maintenance', 'sw maintenance', 'bug fixes'],
            sw_vulnerability: ['vulnerability', 'security support', 'security updates']
        };
        
        for (const pattern of datePatterns) {
            const matches = contextText.match(pattern);
            if (matches) {
                for (const dateStr of matches) {
                    const parsedDate = this._parseDate(dateStr);
                    if (!parsedDate) continue;
                    
                    const dateIndex = contextText.toLowerCase().indexOf(dateStr.toLowerCase());
                    const nearbyText = contextText.substring(
                        Math.max(0, dateIndex - 100),
                        Math.min(contextText.length, dateIndex + 100)
                    ).toLowerCase();
                    
                    // Match dates to milestones
                    if (!dates.end_of_sale_date && milestones.end_of_sale.some(m => nearbyText.includes(m))) {
                        dates.end_of_sale_date = parsedDate;
                        console.log(`   ✓ Found EOS: ${parsedDate}`);
                    }
                    
                    if (!dates.last_day_of_support_date && milestones.last_support.some(m => nearbyText.includes(m))) {
                        dates.last_day_of_support_date = parsedDate;
                        console.log(`   ✓ Found LDOS: ${parsedDate}`);
                    }
                    
                    if (!dates.end_of_sw_maintenance_date && milestones.sw_maintenance.some(m => nearbyText.includes(m))) {
                        dates.end_of_sw_maintenance_date = parsedDate;
                        console.log(`   ✓ Found SW Maintenance: ${parsedDate}`);
                    }
                    
                    if (!dates.end_of_sw_vulnerability_maintenance_date && milestones.sw_vulnerability.some(m => nearbyText.includes(m))) {
                        dates.end_of_sw_vulnerability_maintenance_date = parsedDate;
                        console.log(`   ✓ Found SW Vulnerability: ${parsedDate}`);
                    }
                }
            }
        }
        
        return dates;
    }

    // =====================================================
    // VERIFICATION - Ensures dates match the product
    // =====================================================
    _verifyDatesForProduct(content, productId, dates) {
      // If no dates found, nothing to verify
      if (!dates.end_of_sale_date && !dates.last_day_of_support_date) {
        return false;
      }
      
      const contentLower = content.toLowerCase();
      const productLower = productId.toLowerCase();
      
      // Extract the core product identifier (remove prefixes like N9K-)
      // N9K-C93180YC-FX becomes C93180YC-FX
      const coreProduct = productLower.replace(/^[a-z0-9]+-/i, '');
      
      // Check multiple variations
      const productVariations = [
        productLower,                    // n9k-c93180yc-fx
        coreProduct,                      // c93180yc-fx
        productLower.replace(/-/g, ' '),  // n9k c93180yc fx
        coreProduct.replace(/-/g, ' '),   // c93180yc fx
        coreProduct.replace(/-fx$/, '')   // c93180yc (without suffix)
      ];
      
      // Check if ANY variation is mentioned
      const productMentioned = productVariations.some(variation => 
        contentLower.includes(variation)
      );
      
      if (!productMentioned) {
        console.log(`   ❌ Product ${productId} not found on page`);
        return false;
      }
      
      // Check for explicit exclusions
      const exclusionPatterns = [
        'not applicable to',
        'excludes',
        'except for',
        'does not apply to',
        'not affected'
      ];
      
      for (const pattern of exclusionPatterns) {
        const exclusionCheck = new RegExp(
          `${pattern}[^.]*${productLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
          'i'
        );
        if (exclusionCheck.test(contentLower)) {
          console.log(`   ❌ Product ${productId} is explicitly excluded`);
          return false;
        }
      }
      
      // If we found the product and it's not excluded, accept the dates
      console.log(`   ✅ Verification passed for ${productId} (found as variation)`);
      return true;
    }

    // =====================================================
    // HELPER METHODS
    // =====================================================
    _isEOLPage(url, title, snippet, productId) {
        const combined = `${title} ${snippet}`.toLowerCase();
        const productLower = productId.toLowerCase();
        
        const hasEOLKeywords = (
            url.includes('end-of-sale') || 
            url.includes('end-of-life') || 
            url.includes('eol') ||
            combined.includes('end of sale') ||
            combined.includes('end of life')
        );
        
        const mentionsProduct = combined.includes(productLower);
        
        return hasEOLKeywords && mentionsProduct;
    }

    _shouldFetchFullPage(url) {
        // Fetch full page for major vendor sites
        return this.vendorDomains.some(domain => url.includes(domain));
    }

    _mergeDates(allDates, newDates, url) {
        if (newDates.end_of_sale_date && !allDates.end_of_sale_date) {
            allDates.end_of_sale_date = newDates.end_of_sale_date;
            allDates.sources.push({
                field: 'end_of_sale_date',
                url: url,
                confidence: 'high',
                verified: true
            });
        }
        
        if (newDates.last_day_of_support_date && !allDates.last_day_of_support_date) {
            allDates.last_day_of_support_date = newDates.last_day_of_support_date;
            allDates.sources.push({
                field: 'last_day_of_support_date',
                url: url,
                confidence: 'high',
                verified: true
            });
        }
        
        if (newDates.end_of_sw_maintenance_date && !allDates.end_of_sw_maintenance_date) {
            allDates.end_of_sw_maintenance_date = newDates.end_of_sw_maintenance_date;
            allDates.sources.push({
                field: 'sw_maintenance',
                url: url,
                confidence: 'medium',
                verified: true
            });
        }
        
        if (newDates.end_of_sw_vulnerability_maintenance_date && !allDates.end_of_sw_vulnerability_maintenance_date) {
            allDates.end_of_sw_vulnerability_maintenance_date = newDates.end_of_sw_vulnerability_maintenance_date;
            allDates.sources.push({
                field: 'sw_vulnerability',
                url: url,
                confidence: 'medium',
                verified: true
            });
        }
    }

    _applyDateLogic(dates) {
        console.log('\n📅 Applying date logic for missing dates...');
        
        // If we have LDOS but missing SW dates, default them
        if (dates.last_day_of_support_date) {
            if (!dates.end_of_sw_maintenance_date) {
                dates.end_of_sw_maintenance_date = dates.last_day_of_support_date;
                dates.sw_maintenance_defaulted = true;
                console.log(`   📌 SW Maintenance defaulted to LDOS`);
            }
            
            if (!dates.end_of_sw_vulnerability_maintenance_date) {
                dates.end_of_sw_vulnerability_maintenance_date = dates.last_day_of_support_date;
                dates.sw_vulnerability_defaulted = true;
                console.log(`   📌 SW Vulnerability defaulted to LDOS`);
            }
        }
        
        // Check if this is a current product
        const hasAnyEOLDate = dates.end_of_sale_date || 
                              dates.last_day_of_support_date || 
                              dates.end_of_sw_maintenance_date || 
                              dates.end_of_sw_vulnerability_maintenance_date;
        
        if (!hasAnyEOLDate) {
            dates.is_current = true;
            console.log('   ✅ No EOL dates found - marking as CURRENT product');
        }
        
        return dates;
    }

    _calculateConfidence(dates) {
        let confidence = 0;
        
        if (dates.is_current) {
            return 100;
        }
        
        if (dates.end_of_sale_date) confidence += 35;
        if (dates.last_day_of_support_date) confidence += 35;
        if (dates.end_of_sw_maintenance_date) {
            confidence += dates.sw_maintenance_defaulted ? 10 : 15;
        }
        if (dates.end_of_sw_vulnerability_maintenance_date) {
            confidence += dates.sw_vulnerability_defaulted ? 10 : 15;
        }
        
        return Math.min(confidence, 95);
    }

    _extractManufacturer(record) {
        const productId = record.product_id || '';
        
        // Common product ID patterns
        if (productId.match(/^(WS-|C9|AIR-|N\d+K-|ISR|ASR)/i)) return 'Cisco';
        if (productId.match(/^(MR|MS|MX|MV|MT|MG)\d+/i)) return 'Meraki';
        if (productId.match(/^(J|JL|JH)\d+/i)) return 'HP/HPE';
        if (productId.match(/^(DL|ML|BL|R)\d+/i)) return 'Dell/HPE';
        if (productId.match(/^PA-\d+/i)) return 'Palo Alto';
        if (productId.match(/^(SRX|MX|EX|QFX)\d+/i)) return 'Juniper';
        if (productId.match(/^(FG|FWF)-/i)) return 'Fortinet';
        if (productId.match(/^DCS-\d+/i)) return 'Arista';
        
        return record.manufacturer || '';
    }

    _parseDate(dateStr) {
        if (!dateStr) return null;
        
        try {
            dateStr = dateStr.trim().replace(/\s+/g, ' ');
            
            const patterns = [
                /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,
                /(\d{1,2})\s+(\w+)\s+(\d{4})/,
                /(\d{4})[-\/](\d{2})[-\/](\d{2})/,
                /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/
            ];
            
            for (const pattern of patterns) {
                const match = dateStr.match(pattern);
                if (match) {
                    let date = null;
                    
                    if (pattern === patterns[0]) {
                        // Month name first
                        date = new Date(`${match[1]} ${match[2]}, ${match[3]}`);
                    } else if (pattern === patterns[1]) {
                        // Day first with month name
                        date = new Date(`${match[2]} ${match[1]}, ${match[3]}`);
                    } else if (pattern === patterns[2]) {
                        // YYYY-MM-DD
                        date = new Date(match[0]);
                    } else if (pattern === patterns[3]) {
                        // MM/DD/YYYY
                        date = new Date(`${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`);
                    }
                    
                    if (date && !isNaN(date.getTime())) {
                        return date.toISOString().split('T')[0];
                    }
                }
            }
            
            // Last resort: try native Date parsing
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
            
        } catch (error) {
            console.warn(`Failed to parse date: ${dateStr}`);
        }
        
        return null;
    }

    // =====================================================
    // PRODUCTION FORMAT TRANSFORMERS
    // =====================================================
    _transformDataSources(sources) {
        // Transform from array to production's expected object format
        const result = {
            vendor_site: 0,
            third_party: 0,
            manual_entry: 0
        };
        
        if (Array.isArray(sources)) {
            sources.forEach(source => {
                if (source.url) {
                    if (this._isVendorSite(source.url)) {
                        result.vendor_site++;
                    } else {
                        result.third_party++;
                    }
                }
            });
        }
        
        return result;
    }

    _isVendorSite(url) {
        return this.vendorDomains.some(domain => url.includes(domain));
    }

    _createSuccessResult(record, dates, confidence) {
        return {
            success: true,
            manufacturer: record.manufacturer,
            product_category: record.product_category || 'Hardware',
            product_type: record.product_type || 'Unknown',
            description: record.description,
            date_introduced: dates.is_current ? null : dates.date_introduced,
            end_of_sale_date: dates.is_current ? null : dates.end_of_sale_date,
            end_of_sw_maintenance_date: dates.is_current ? null : dates.end_of_sw_maintenance_date,
            end_of_sw_vulnerability_maintenance_date: dates.is_current ? null : dates.end_of_sw_vulnerability_maintenance_date,
            last_day_of_support_date: dates.is_current ? null : dates.last_day_of_support_date,
            manufacturer_confidence: record.manufacturer ? 90 : 50,
            category_confidence: 75,
            lifecycle_confidence: confidence,
            overall_confidence: confidence,
            is_current_product: dates.is_current || false,
            data_sources: dates.sources,
            message: dates.is_current ? 'Current product - no EOL announced' : this._generateResultMessage(dates),
            metadata: {
                sw_maintenance_defaulted: dates.sw_maintenance_defaulted || false,
                sw_vulnerability_defaulted: dates.sw_vulnerability_defaulted || false,
                is_current: dates.is_current || false
            }
        };
    }

    _createErrorResult(record, message) {
        return {
            success: false,
            message: message || 'Research failed',
            manufacturer: record.manufacturer || '',
            product_category: record.product_category || '',
            product_type: record.product_type || '',
            description: record.description || '',
            date_introduced: null,
            end_of_sale_date: null,
            end_of_sw_maintenance_date: null,
            end_of_sw_vulnerability_maintenance_date: null,
            last_day_of_support_date: null,
            manufacturer_confidence: 0,
            category_confidence: 0,
            lifecycle_confidence: 0,
            overall_confidence: 0,
            is_current_product: false,
            data_sources: []
        };
    }

    _getDefaultResult() {
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

    _generateResultMessage(dates) {
        const foundDates = [];
        const defaultedDates = [];
        
        if (dates.end_of_sale_date) foundDates.push('EOS');
        if (dates.last_day_of_support_date) foundDates.push('LDOS');
        
        if (dates.sw_maintenance_defaulted) defaultedDates.push('SW Maintenance');
        if (dates.sw_vulnerability_defaulted) defaultedDates.push('SW Vulnerability');
        
        let message = '';
        
        if (foundDates.length > 0) {
            message += `Found: ${foundDates.join(', ')}`;
        }
        
        if (defaultedDates.length > 0) {
            if (message) message += '. ';
            message += `Defaulted to LDOS: ${defaultedDates.join(', ')}`;
        }
        
        return message || 'No lifecycle dates found';
    }
}

// Export singleton instance
module.exports = new GoogleAIResearchService();