// backend/src/services/googleAIResearchService.js
// VERSION 4 - Complete with all fixes:
// - Meraki comprehensive EOL page handling (MR33-HW fix)
// - Cisco table extraction improvements (WS-C3560X-24P-L fix)
// - Enhanced confidence calculation (50% base + 10%/5% incremental)
const axios = require('axios');

class GoogleAIResearchService {
    constructor() {
        // Support both local dev (GOOGLE_API_KEY) and Cloud Run (GOOGLE_CSE_API_KEY) naming
        this.apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_CSE_API_KEY;
        this.searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID || process.env.GOOGLE_CSE_CX;
        this.searchUrl = 'https://www.googleapis.com/customsearch/v1';
        this.maxRetries = 3;
        
        // Manufacturer domain mapping
        this.manufacturerDomains = {
            'Cisco': ['cisco.com'],
            'Meraki': ['meraki.com', 'documentation.meraki.com'],
            'Dell': ['dell.com', 'delltechnologies.com'],
            'HP': ['hp.com', 'hpe.com'],
            'HPE': ['hpe.com'],
            'Aruba': ['arubanetworks.com'],
            'Juniper': ['juniper.net'],
            'Fortinet': ['fortinet.com'],
            'Palo Alto': ['paloaltonetworks.com'],
            'Arista': ['arista.com'],
            'VMware': ['vmware.com'],
            'NetApp': ['netapp.com'],
            'Microsoft': ['microsoft.com'],
            'Lenovo': ['lenovo.com'],
            'IBM': ['ibm.com']
        };
        
        // All vendor domains for classification
        this.vendorDomains = Object.values(this.manufacturerDomains).flat();
        // Combine Cisco and Meraki domains for unified handling
        this.ciscoMerakiDomains = [...this.manufacturerDomains['Cisco'], ...this.manufacturerDomains['Meraki']];
    }

    // =====================================================
    // MAIN PRODUCTION INTERFACE
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
            
            // Transform to production format
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
    // ENHANCED RESEARCH WITH MANUFACTURER-FIRST APPROACH
    // =====================================================
    async _performEnhancedResearch(record) {
        console.log('🔵 ==========================================');
        console.log('🔵 ENHANCED MANUFACTURER-FIRST EOL RESEARCH');
        console.log('🔵 Product:', record.product_id);
        console.log('🔵 ==========================================');
        
        if (!this.apiKey || !this.searchEngineId) {
            console.error('❌ Missing Google API credentials');
            return this._createErrorResult(record, 'API credentials not configured');
        }
        
        try {
            // Strip -RF suffix for searches (refurbished items use same EOL as base model)
            const searchProductId = record.product_id.replace(/-RF$/i, '');
            const originalProductId = record.product_id;
            
            console.log(`📋 Product ID: ${originalProductId}`);
            if (searchProductId !== originalProductId) {
                console.log(`📋 Searching without -RF suffix: ${searchProductId}`);
            }
            
            const manufacturer = this._extractManufacturer(record);
            console.log(`🏭 Manufacturer: ${manufacturer || 'Unknown'}`);
            
            // PHASE 1: MANUFACTURER SEARCH ONLY
            console.log('\n📍 PHASE 1: Searching manufacturer sites only...');
            const manufacturerResult = await this._searchManufacturerSites(searchProductId, manufacturer, originalProductId);
            
            if (manufacturerResult.pageFound) {
                if (manufacturerResult.datesFound) {
                    console.log('✅ Found EOL dates from manufacturer!');
                    return manufacturerResult;
                } else {
                    console.log('✅ Manufacturer page found but no EOL dates - marking as CURRENT PRODUCT');
                    return this._createCurrentProductResult(record, manufacturerResult.sources);
                }
            }
            
            // PHASE 2: THIRD-PARTY SEARCH (only if no manufacturer page found)
            console.log('\n📍 PHASE 2: No manufacturer page found, searching third-party sources...');
            const thirdPartyResult = await this._searchThirdPartySites(searchProductId, originalProductId);
            
            return thirdPartyResult;
            
        } catch (error) {
            console.error('❌ Research error:', error.message);
            return this._createErrorResult(record, error.message);
        }
    }

    // =====================================================
    // MANUFACTURER SITE SEARCH
    // =====================================================
    async _searchManufacturerSites(searchProductId, manufacturer, originalProductId) {
        const manufacturerDomains = this._getManufacturerDomains(manufacturer);
        if (!manufacturerDomains || manufacturerDomains.length === 0) {
            console.log('⚠️ No manufacturer domains identified');
            return { pageFound: false };
        }
        
        console.log(`🔍 Searching ${manufacturer} sites: ${manufacturerDomains.join(', ')}`);
        
        const allDates = {
            end_of_sale_date: null,
            end_of_sw_maintenance_date: null,
            end_of_sw_vulnerability_maintenance_date: null,
            last_day_of_support_date: null,
            sources: [],
            isMeraki: false
        };
        
        let manufacturerPageFound = false;
        const processedUrls = new Set();
        
        // Build manufacturer-specific queries
        const queries = this._buildManufacturerQueries(searchProductId, manufacturerDomains);
        
        for (const query of queries) {
            console.log(`   🔎 Searching: ${query}`);
            
            try {
                const response = await this._performAPICallWithRetry(this.searchUrl, {
                    key: this.apiKey,
                    cx: this.searchEngineId,
                    q: query,
                    num: 5  // Get more results for manufacturer searches
                }, 5);
                
                if (response && response.items) {
                    for (const item of response.items) {
                        const url = item.link;
                        
                        if (processedUrls.has(url)) continue;
                        processedUrls.add(url);
                        
                        // Check if this is actually a manufacturer page
                        if (this._isManufacturerUrl(url, manufacturerDomains)) {
                            manufacturerPageFound = true;
                            console.log(`   📄 Found manufacturer page: ${url.substring(0, 80)}...`);
                            
                            // Check if this is the comprehensive Meraki EOL page
                            const isMerakiEOLPage = url.includes('documentation.meraki.com') && 
                                                   (url.includes('End-of-Life') || url.includes('EOL'));
                            
                            // Determine if this is a Meraki page
                            const isMerakiPage = this._isMerakiUrl(url);
                            if (isMerakiPage) {
                                console.log(`   🔧 Detected Meraki page${isMerakiEOLPage ? ' (comprehensive EOL list)' : ''}`);
                                allDates.isMeraki = true;
                            }
                            
                            // Try to fetch and extract dates
                            const extractedDates = await this._extractDatesFromUrl(
                                url, 
                                searchProductId, 
                                originalProductId, 
                                manufacturer,
                                item.snippet,
                                isMerakiPage,
                                isMerakiEOLPage
                            );
                            
                            if (extractedDates && this._hasAnyDates(extractedDates)) {
                                this._mergeDates(allDates, extractedDates, url);
                                
                                // Apply appropriate date logic based on manufacturer
                                let finalDates;
                                if (allDates.isMeraki) {
                                    finalDates = this._applyMerakiDateLogic(allDates);
                                } else {
                                    finalDates = this._applyDateEstimation(allDates);
                                }
                                
                                // Validate and calculate confidence
                                finalDates = this._validateDateSpacing(finalDates);
                                const confidence = this._calculateEnhancedConfidence(finalDates, true);
                                
                                return {
                                    pageFound: true,
                                    datesFound: true,
                                    ...finalDates,
                                    lifecycle_confidence: confidence,
                                    overall_confidence: confidence,
                                    data_sources: allDates.sources
                                };
                            }
                        }
                    }
                }
            } catch (searchError) {
                console.warn(`   ⚠️ Search failed: ${searchError.message}`);
            }
        }
        
        return {
            pageFound: manufacturerPageFound,
            datesFound: false,
            sources: allDates.sources
        };
    }

    // =====================================================
    // THIRD-PARTY SITE SEARCH
    // =====================================================
    async _searchThirdPartySites(searchProductId, originalProductId) {
        console.log(`🔍 Searching third-party sites for ${searchProductId}...`);
        
        const allDates = {
            end_of_sale_date: null,
            end_of_sw_maintenance_date: null,
            end_of_sw_vulnerability_maintenance_date: null,
            last_day_of_support_date: null,
            sources: []
        };
        
        const processedUrls = new Set();
        const queries = this._buildThirdPartyQueries(searchProductId);
        
        for (const query of queries) {
            // Stop if we have the main dates
            if (allDates.end_of_sale_date && allDates.last_day_of_support_date) {
                console.log('   ✅ Found main milestone dates, stopping search');
                break;
            }
            
            console.log(`   🔎 Searching: ${query}`);
            
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
                        
                        if (processedUrls.has(url)) continue;
                        processedUrls.add(url);
                        
                        // Skip manufacturer sites in third-party search
                        if (this._isVendorSite(url)) continue;
                        
                        const title = item.title || '';
                        const snippet = item.snippet || '';
                        
                        if (this._isEOLPage(url, title, snippet, searchProductId)) {
                            console.log(`   📄 Processing third-party EOL page: ${url.substring(0, 60)}...`);
                            
                            const extractedDates = await this._extractDatesFromUrl(
                                url,
                                searchProductId,
                                originalProductId,
                                null, // No manufacturer for third-party
                                snippet,
                                false, // Not a Meraki page
                                false  // Not comprehensive EOL page
                            );
                            
                            // Apply strict verification for third-party sources
                            if (extractedDates && this._hasAnyDates(extractedDates)) {
                                this._mergeDates(allDates, extractedDates, url);
                            }
                        }
                    }
                }
            } catch (searchError) {
                console.warn(`   ⚠️ Search failed: ${searchError.message}`);
            }
        }
        
        // Apply date estimation if we have at least one date
        if (this._hasAnyDates(allDates)) {
            let estimatedDates = this._applyDateEstimation(allDates);
            estimatedDates = this._validateDateSpacing(estimatedDates);
            const confidence = this._calculateEnhancedConfidence(estimatedDates, false);
            
            return {
                ...estimatedDates,
                lifecycle_confidence: confidence,
                overall_confidence: confidence,
                is_current_product: false,
                data_sources: allDates.sources
            };
        }
        
        // No dates found anywhere
        return this._createErrorResult({ product_id: originalProductId }, 'No EOL information found');
    }

    // =====================================================
    // DATE EXTRACTION FROM URLs
    // =====================================================
    async _extractDatesFromUrl(url, searchProductId, originalProductId, manufacturer, snippet, isMerakiPage, isMerakiEOLPage) {
        try {
            let fullContent = snippet;
            let extractedDates = {};
            
            // Try to fetch the full page
            if (this._shouldFetchFullPage(url)) {
                try {
                    console.log(`      📥 Fetching full page content...`);
                    const pageResponse = await axios.get(url, { 
                        timeout: 10000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    fullContent = pageResponse.data.toString();
                    
                    // Use appropriate extraction method based on page type
                    if (isMerakiEOLPage) {
                        console.log(`      🔧 Using Meraki comprehensive EOL page extraction...`);
                        extractedDates = this._extractMerakiComprehensiveEOLDates(fullContent, searchProductId, originalProductId);
                    } else if (isMerakiPage) {
                        console.log(`      🔧 Using Meraki single-table extraction method...`);
                        extractedDates = this._extractMerakiSingleTableDates(fullContent, searchProductId, originalProductId);
                    } else if (manufacturer === 'Cisco' && url.includes('cisco.com')) {
                        console.log(`      🔧 Using Cisco two-table extraction method...`);
                        extractedDates = this._extractCiscoTwoTableDates(fullContent, searchProductId, originalProductId);
                    } else {
                        extractedDates = this._extractLifecycleDates(fullContent, searchProductId);
                    }
                } catch (fetchError) {
                    console.log(`      ⚠️ Could not fetch full page, using snippet`);
                    extractedDates = this._extractLifecycleDates(snippet, searchProductId);
                }
            } else {
                extractedDates = this._extractLifecycleDates(snippet, searchProductId);
            }
            
            // Log what we found
            if (this._hasAnyDates(extractedDates)) {
                console.log(`      ✅ Extracted dates:`);
                if (extractedDates.end_of_sale_date) 
                    console.log(`         EOS: ${extractedDates.end_of_sale_date}`);
                if (extractedDates.end_of_sw_maintenance_date) 
                    console.log(`         SW Maint: ${extractedDates.end_of_sw_maintenance_date}`);
                if (extractedDates.end_of_sw_vulnerability_maintenance_date) 
                    console.log(`         SW Vuln: ${extractedDates.end_of_sw_vulnerability_maintenance_date}`);
                if (extractedDates.last_day_of_support_date) 
                    console.log(`         LDOS: ${extractedDates.last_day_of_support_date}`);
            } else {
                console.log(`      ❌ No dates extracted`);
            }
            
            return extractedDates;
            
        } catch (error) {
            console.error(`      ❌ Extraction error: ${error.message}`);
            return {};
        }
    }

    // =====================================================
    // MERAKI COMPREHENSIVE EOL PAGE EXTRACTION
    // =====================================================
    _extractMerakiComprehensiveEOLDates(html, searchProductId, originalProductId) {
        const dates = {};
        
        // Create MORE variations of the product ID to check
        const productVariations = this._getMerakiProductVariations(searchProductId);
        if (originalProductId !== searchProductId) {
            productVariations.push(...this._getMerakiProductVariations(originalProductId));
        }
        
        console.log(`      🔍 Checking for Meraki product variations: ${productVariations.join(', ')}`);
        
        // Look for the product in a table row with its specific dates
        const tablePattern = /<table[^>]*>[\s\S]*?<\/table>/gi;
        const tables = html.match(tablePattern) || [];
        
        console.log(`      📊 Found ${tables.length} tables in Meraki EOL page`);
        
        // Try to find the product in any table
        for (const table of tables) {
            // First, let's see if this table contains EOL-related headers
            const tableText = table.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
            
            if (!tableText.match(/End.{0,10}(Sale|Life|Support)/i)) {
                continue; // Skip tables that don't look like EOL tables
            }
            
            console.log(`      📋 Processing EOL table...`);
            
            // Extract all rows from the table
            const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
            const rows = [...table.matchAll(rowPattern)];
            
            console.log(`      📋 Found ${rows.length} rows in table`);
            
            // Check each row for our product
            for (const rowMatch of rows) {
                const rowHtml = rowMatch[0];
                const rowText = rowHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                
                // Check if this row contains any of our product variations
                let productFound = false;
                let matchedVariant = null;
                
                for (const variant of productVariations) {
                    // More flexible matching - case insensitive and with word boundaries
                    const variantPattern = new RegExp(`\\b${variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                    if (variantPattern.test(rowText)) {
                        productFound = true;
                        matchedVariant = variant;
                        console.log(`      ✅ Found ${variant} in table row`);
                        break;
                    }
                }
                
                if (productFound) {
                    console.log(`      📋 Row text: ${rowText.substring(0, 200)}...`);
                    
                    // Extract dates from this specific row
                    // Look for date patterns in the row
                    const datePattern = /(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|\d{4}[-\/]\d{2}[-\/]\d{2})/g;
                    const foundDates = [...rowText.matchAll(datePattern)];
                    
                    console.log(`      📅 Found ${foundDates.length} date patterns in row`);
                    
                    if (foundDates.length >= 2) {
                        // For Meraki comprehensive EOL page:
                        // Typically the order is: Product | End of Sale | End of Support
                        // Sometimes it's: Product | Other Info | End of Sale | End of Support
                        
                        // Try to identify which dates are which based on position and context
                        let eosDate = null;
                        let ldosDate = null;
                        
                        // If we have exactly 2 dates, assume first is EOS, second is LDOS
                        if (foundDates.length === 2) {
                            eosDate = this._parseDate(foundDates[0][1]);
                            ldosDate = this._parseDate(foundDates[1][1]);
                        } else if (foundDates.length > 2) {
                            // If more than 2 dates, try to be smarter
                            // Usually the last two dates are EOS and LDOS
                            eosDate = this._parseDate(foundDates[foundDates.length - 2][1]);
                            ldosDate = this._parseDate(foundDates[foundDates.length - 1][1]);
                        }
                        
                        // Validate the dates make sense (LDOS should be after EOS)
                        if (eosDate && ldosDate) {
                            const eosTime = new Date(eosDate).getTime();
                            const ldosTime = new Date(ldosDate).getTime();
                            
                            if (ldosTime > eosTime) {
                                dates.end_of_sale_date = eosDate;
                                dates.last_day_of_support_date = ldosDate;
                                console.log(`         ✅ Found EOS: ${eosDate}`);
                                console.log(`         ✅ Found LDOS: ${ldosDate}`);
                                return dates; // Return immediately when we find the right product
                            } else {
                                console.log(`         ⚠️ Date order seems wrong, trying reverse`);
                                // Maybe they're in reverse order?
                                dates.end_of_sale_date = ldosDate;
                                dates.last_day_of_support_date = eosDate;
                                console.log(`         ✅ Found EOS: ${ldosDate}`);
                                console.log(`         ✅ Found LDOS: ${eosDate}`);
                                return dates;
                            }
                        }
                    } else if (foundDates.length === 1) {
                        // Only one date found - try to determine what it is
                        console.log(`      ⚠️ Only one date found in row, checking context...`);
                        const singleDate = this._parseDate(foundDates[0][1]);
                        
                        // Check if row text indicates what kind of date this is
                        if (rowText.match(/End.{0,10}Sale/i)) {
                            dates.end_of_sale_date = singleDate;
                            console.log(`         ✅ Found EOS: ${singleDate}`);
                        } else if (rowText.match(/End.{0,10}Support/i) || rowText.match(/Last.{0,10}Day/i)) {
                            dates.last_day_of_support_date = singleDate;
                            console.log(`         ✅ Found LDOS: ${singleDate}`);
                        }
                    }
                }
            }
            
            // If we found dates, return them
            if (this._hasAnyDates(dates)) {
                return dates;
            }
        }
        
        // Fallback: Look for the product and dates without strict table structure
        if (!this._hasAnyDates(dates)) {
            console.log(`      ⚠️ No table match found, trying flexible text extraction...`);
            
            // Clean HTML to text
            const pageText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
            
            for (const variant of productVariations) {
                // Find where the product is mentioned
                const variantPattern = new RegExp(`\\b${variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                const variantMatch = pageText.match(variantPattern);
                
                if (variantMatch) {
                    console.log(`      ✅ Found ${variant} in page text`);
                    
                    // Get context around the product mention (500 chars before and after)
                    const matchIndex = pageText.indexOf(variantMatch[0]);
                    const contextStart = Math.max(0, matchIndex - 500);
                    const contextEnd = Math.min(pageText.length, matchIndex + 500);
                    const context = pageText.substring(contextStart, contextEnd);
                    
                    console.log(`      📋 Context: ...${context.substring(0, 200)}...`);
                    
                    // Look for dates in this context
                    const datePattern = /(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|\d{4}[-\/]\d{2}[-\/]\d{2})/g;
                    const foundDates = [...context.matchAll(datePattern)];
                    
                    if (foundDates.length >= 2) {
                        // Assume first is EOS, second is LDOS
                        const firstDate = this._parseDate(foundDates[0][1]);
                        const secondDate = this._parseDate(foundDates[1][1]);
                        
                        if (firstDate && secondDate) {
                            // Determine which is which based on chronology
                            const firstTime = new Date(firstDate).getTime();
                            const secondTime = new Date(secondDate).getTime();
                            
                            if (firstTime < secondTime) {
                                dates.end_of_sale_date = firstDate;
                                dates.last_day_of_support_date = secondDate;
                            } else {
                                dates.end_of_sale_date = secondDate;
                                dates.last_day_of_support_date = firstDate;
                            }
                            
                            console.log(`         ✅ Found EOS: ${dates.end_of_sale_date}`);
                            console.log(`         ✅ Found LDOS: ${dates.last_day_of_support_date}`);
                            return dates;
                        }
                    } else if (foundDates.length === 1) {
                        // Only one date - try to determine type from context
                        const singleDate = this._parseDate(foundDates[0][1]);
                        
                        if (context.match(/End.{0,20}Sale/i) || context.match(/EoS(?!\s*Support)/i)) {
                            dates.end_of_sale_date = singleDate;
                            console.log(`         ✅ Found EOS: ${singleDate}`);
                        } else if (context.match(/End.{0,20}Support/i) || context.match(/Last.{0,20}Day/i)) {
                            dates.last_day_of_support_date = singleDate;
                            console.log(`         ✅ Found LDOS: ${singleDate}`);
                        }
                    }
                    
                    if (this._hasAnyDates(dates)) {
                        return dates;
                    }
                }
            }
        }
        
        return dates;
    }

    // =====================================================
    // IMPROVED MERAKI PRODUCT VARIATIONS
    // =====================================================
    _getMerakiProductVariations(productId) {
        const variations = [productId];
        
        // Handle -HW suffix
        if (productId.endsWith('-HW')) {
            // Add version without -HW
            const withoutHW = productId.replace('-HW', '');
            variations.push(withoutHW);
            
            // For Z3-HW, also try just Z3
            if (withoutHW === 'Z3') {
                variations.push('Z3');
            }
        } else {
            // Add version with -HW
            variations.push(productId + '-HW');
            
            // For Z3, also ensure we have Z3-HW
            if (productId === 'Z3') {
                variations.push('Z3-HW');
            }
        }
        
        // Handle MR33 vs MR-33 format (with hyphen between letters and numbers)
        if (productId.match(/^[A-Z]+\d+/)) {
            // Has letters followed by numbers, try with hyphen
            const withHyphen = productId.replace(/^([A-Z]+)(\d+)/, '$1-$2');
            if (withHyphen !== productId) {
                variations.push(withHyphen);
            }
        } else if (productId.match(/^[A-Z]+-\d+/)) {
            // Has hyphen, try without
            const withoutHyphen = productId.replace(/^([A-Z]+)-(\d+)/, '$1$2');
            variations.push(withoutHyphen);
        }
        
        // Add "Meraki" prefix variations
        variations.push('Meraki ' + productId);
        
        // For single letter+number combos like Z3, Z1, etc.
        if (productId.match(/^[A-Z]\d+/)) {
            variations.push(productId.toLowerCase()); // z3
            variations.push(productId.toUpperCase()); // Z3
        }
        
        // Remove duplicates and return
        return [...new Set(variations)];
    }

    // =====================================================
    // MERAKI SINGLE-TABLE EXTRACTION METHOD
    // =====================================================
    _extractMerakiSingleTableDates(html, searchProductId, originalProductId) {
        const dates = {};
        
        // Create variations of the product ID to check
        const productVariations = this._getMerakiProductVariations(searchProductId);
        if (originalProductId !== searchProductId) {
            productVariations.push(...this._getMerakiProductVariations(originalProductId));
        }
        
        console.log(`      🔍 Checking for Meraki product variations: ${productVariations.join(', ')}`);
        
        // For Meraki single product pages, look for product and dates
        const tablePattern = /<table[^>]*>[\s\S]*?<\/table>/gi;
        const tables = html.match(tablePattern) || [];
        
        console.log(`      📊 Found ${tables.length} tables in Meraki page`);
        
        for (const table of tables) {
            for (const variant of productVariations) {
                const escapedVariant = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                
                // Look for rows containing the product
                const rowPattern = new RegExp(
                    `<tr[^>]*>([^<]*${escapedVariant}[^<]*<[^>]*>.*?)</tr>`,
                    'gi'
                );
                
                const matches = [...table.matchAll(rowPattern)];
                
                if (matches.length > 0) {
                    console.log(`      ✅ Found ${variant} in Meraki table`);
                    
                    for (const match of matches) {
                        const rowContent = match[0];
                        
                        // Extract dates from this row
                        const rowDates = this._extractDatesFromTableRow(rowContent);
                        
                        if (rowDates.end_of_sale_date || rowDates.last_day_of_support_date) {
                            Object.assign(dates, rowDates);
                            console.log(`      ✅ Extracted dates from Meraki table row`);
                            break;
                        }
                    }
                    
                    if (this._hasAnyDates(dates)) break;
                }
            }
            
            if (this._hasAnyDates(dates)) break;
        }
        
        // Fallback: If no table structure found, use standard extraction
        if (!this._hasAnyDates(dates)) {
            console.log(`      ⚠️ No table match, trying standard extraction...`);
            return this._extractLifecycleDates(html, searchProductId);
        }
        
        return dates;
    }

    // =====================================================
    // CISCO TWO-TABLE EXTRACTION METHOD
    // =====================================================
    _extractCiscoTwoTableDates(html, searchProductId, originalProductId) {
        const dates = {};
        
        // Create variations of the product ID to check
        const productVariations = this._getProductVariations(searchProductId);
        if (originalProductId !== searchProductId) {
            productVariations.push(...this._getProductVariations(originalProductId));
        }
        
        console.log(`      🔍 Checking for product variations: ${productVariations.join(', ')}`);
        
        // Check if any product variation is mentioned in the page
        let productFound = false;
        for (const variant of productVariations) {
            const regex = new RegExp(variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            if (regex.test(html)) {
                productFound = true;
                console.log(`      ✅ Found product variant in page: ${variant}`);
                break;
            }
        }
        
        if (!productFound) {
            console.log(`      ❌ Product not found in Cisco page`);
            return dates;
        }
        
        // Look for Cisco's typical table structure with milestones
        const tablePattern = /<table[^>]*>[\s\S]*?<\/table>/gi;
        const tables = html.match(tablePattern) || [];
        
        console.log(`      📊 Found ${tables.length} tables in page`);
        
        for (const table of tables) {
            // Check if this looks like a milestones table
            if (table.includes('End-of-Sale') || table.includes('End of Sale') || 
                table.includes('Last Date') || table.includes('Milestone')) {
                
                console.log(`      📋 Processing milestones table...`);
                
                // Extract dates from the table
                const extractedDates = this._extractDatesFromTable(table);
                Object.assign(dates, extractedDates);
            }
        }
        
        // Fallback: If no tables found, use standard extraction
        if (Object.keys(dates).length === 0) {
            console.log(`      ⚠️ No table structure found, using standard extraction...`);
            return this._extractLifecycleDates(html, searchProductId);
        }
        
        return dates;
    }

    // =====================================================
    // IMPROVED TABLE DATE EXTRACTION (Cisco fix)
    // =====================================================
    _extractDatesFromTable(tableHtml) {
        const dates = {};
        
        // Remove HTML tags but keep content
        const textContent = tableHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        
        // Special check to avoid extracting announcement date as EOS
        const announcementPattern = /End-of-Life\s+Announcement\s+Date[^0-9]*?(\w+\s+\d{1,2},?\s+\d{4})/i;
        const announcementMatch = textContent.match(announcementPattern);
        let announcementDate = null;
        if (announcementMatch) {
            announcementDate = this._parseDate(announcementMatch[1]);
            console.log(`         ⚠️ Skipping announcement date: ${announcementDate}`);
        }
        
        // Enhanced patterns for Cisco tables - ORDER MATTERS!
        const patterns = [
            {
                pattern: /End-of-Sale\s+Date(?:\s*:\s*HW)?[^0-9]*?(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|\d{4}[-\/]\d{2}[-\/]\d{2})/i,
                field: 'end_of_sale_date',
                label: 'End-of-Sale Date'
            },
            {
                pattern: /End\s+of\s+SW\s+Maintenance(?:\s+Releases)?\s+Date(?:\s*:\s*HW)?[^0-9]*?(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|\d{4}[-\/]\d{2}[-\/]\d{2})/i,
                field: 'end_of_sw_maintenance_date',
                label: 'End of SW Maintenance'
            },
            {
                pattern: /End\s+of\s+Vulnerability\/Security\s+Support(?:\s*:\s*HW)?[^0-9]*?(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|\d{4}[-\/]\d{2}[-\/]\d{2})/i,
                field: 'end_of_sw_vulnerability_maintenance_date',
                label: 'End of Vulnerability/Security Support'
            },
            {
                pattern: /Last\s+Date\s+of\s+Support(?:\s*:\s*HW)?[^0-9]*?(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|\d{4}[-\/]\d{2}[-\/]\d{2})/i,
                field: 'last_day_of_support_date',
                label: 'Last Date of Support'
            },
            {
                pattern: /Last\s+Day\s+of\s+Support(?:\s*:\s*HW)?[^0-9]*?(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|\d{4}[-\/]\d{2}[-\/]\d{2})/i,
                field: 'last_day_of_support_date',
                label: 'Last Day of Support'
            }
        ];
        
        // Extract dates using the patterns
        for (const { pattern, field, label } of patterns) {
            if (!dates[field]) {
                const match = textContent.match(pattern);
                if (match && match[1]) {
                    const parsedDate = this._parseDate(match[1]);
                    
                    // Skip if this is the announcement date
                    if (parsedDate && parsedDate !== announcementDate) {
                        dates[field] = parsedDate;
                        console.log(`         ✅ Found ${field}: ${parsedDate}`);
                    } else if (parsedDate === announcementDate) {
                        console.log(`         ⚠️ Skipped ${label} (matches announcement date)`);
                    }
                }
            }
        }
        
        return dates;
    }

    // =====================================================
    // EXTRACT DATES FROM TABLE ROW
    // =====================================================
    _extractDatesFromTableRow(rowHtml) {
        const dates = {};
        
        // Remove HTML tags but keep content
        const textContent = rowHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        
        // Look for date patterns
        const datePattern = /(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|\d{4}[-\/]\d{2}[-\/]\d{2})/g;
        const foundDates = [...textContent.matchAll(datePattern)];
        
        if (foundDates.length > 0) {
            // For Meraki, typically:
            // First date = End of Life (End of Sale)
            // Second date = End of Support (Last Day of Support)
            
            const firstDate = this._parseDate(foundDates[0][1]);
            if (firstDate) {
                dates.end_of_sale_date = firstDate;
                console.log(`         Found EOS in row: ${firstDate}`);
            }
            
            if (foundDates.length > 1) {
                const secondDate = this._parseDate(foundDates[1][1]);
                if (secondDate) {
                    dates.last_day_of_support_date = secondDate;
                    console.log(`         Found LDOS in row: ${secondDate}`);
                }
            }
        }
        
        return dates;
    }

    // =====================================================
    // STANDARD DATE EXTRACTION (FALLBACK)
    // =====================================================
    _extractLifecycleDates(content, productId) {
        if (!content) return {};
        
        const dates = {};
        const contentLower = content.toLowerCase();
        const productVariations = this._getProductVariations(productId);
        
        // Check if product is mentioned
        let productMentioned = false;
        for (const variant of productVariations) {
            if (contentLower.includes(variant.toLowerCase())) {
                productMentioned = true;
                break;
            }
        }
        
        if (!productMentioned) {
            console.log(`         ⚠️ Product ${productId} not found in content`);
            return {};
        }
        
        // Look for announcement date to avoid confusion
        const announcementPattern = /End-of-Life\s+Announcement\s+Date[^:]*?:?\s*(\w+\s+\d{1,2},?\s+\d{4})/i;
        const announcementMatch = content.match(announcementPattern);
        let announcementDate = null;
        if (announcementMatch) {
            announcementDate = this._parseDate(announcementMatch[1]);
            console.log(`         ⚠️ Found announcement date to skip: ${announcementDate}`);
        }
        
        // Enhanced date extraction patterns
        const datePatterns = [
            {
                pattern: /End[\s-]*of[\s-]*Sale\s+Date(?:\s*:\s*HW)?[^:]*?:?\s*(\w+\s+\d{1,2},?\s+\d{4}|\d{4}[-\/]\d{2}[-\/]\d{2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i,
                field: 'end_of_sale_date',
                label: 'End of Sale Date'
            },
            {
                pattern: /End[\s-]*of[\s-]*SW[\s-]*Maintenance(?:\s+Releases)?\s+Date(?:\s*:\s*HW)?[^:]*?:?\s*(\w+\s+\d{1,2},?\s+\d{4}|\d{4}[-\/]\d{2}[-\/]\d{2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i,
                field: 'end_of_sw_maintenance_date',
                label: 'SW Maintenance'
            },
            {
                pattern: /End[\s-]*of[\s-]*Vulnerability\/Security[\s-]*Support(?:\s*:\s*HW)?[^:]*?:?\s*(\w+\s+\d{1,2},?\s+\d{4}|\d{4}[-\/]\d{2}[-\/]\d{2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i,
                field: 'end_of_sw_vulnerability_maintenance_date',
                label: 'Security Vulnerability'
            },
            {
                pattern: /Last[\s-]*Date[\s-]*of[\s-]*Support(?:\s*:\s*HW)?[^:]*?:?\s*(\w+\s+\d{1,2},?\s+\d{4}|\d{4}[-\/]\d{2}[-\/]\d{2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i,
                field: 'last_day_of_support_date',
                label: 'Last Date of Support'
            },
            {
                pattern: /Last[\s-]*Day[\s-]*of[\s-]*Support(?:\s*:\s*HW)?[^:]*?:?\s*(\w+\s+\d{1,2},?\s+\d{4}|\d{4}[-\/]\d{2}[-\/]\d{2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i,
                field: 'last_day_of_support_date',
                label: 'Last Day of Support'
            }
        ];
        
        for (const { pattern, field, label } of datePatterns) {
            if (!dates[field]) {
                const match = content.match(pattern);
                if (match && match[1]) {
                    const parsedDate = this._parseDate(match[1]);
                    
                    // Don't use the announcement date as EOS
                    if (parsedDate && parsedDate !== announcementDate) {
                        dates[field] = parsedDate;
                        console.log(`         ✅ Extracted ${label}: ${parsedDate}`);
                    } else if (parsedDate === announcementDate && field === 'end_of_sale_date') {
                        console.log(`         ⚠️ Skipped EOS (matches announcement date)`);
                    }
                }
            }
        }
        
        return dates;
    }

    // =====================================================
    // MERAKI DATE LOGIC (SW dates = LDOS)
    // =====================================================
    _applyMerakiDateLogic(dates) {
        console.log('\n   📊 Applying Meraki date logic...');
        
        const merakiDates = { ...dates };
        
        // For Meraki, SW Maintenance and SW Vulnerability should equal LDOS
        if (dates.last_day_of_support_date) {
            // Set SW dates to LDOS but DON'T mark them as estimated
            if (!dates.end_of_sw_maintenance_date) {
                merakiDates.end_of_sw_maintenance_date = dates.last_day_of_support_date;
                merakiDates.sw_maintenance_defaulted_to_ldos = true;
                console.log(`      Set SW Maintenance to LDOS: ${dates.last_day_of_support_date}`);
            }
            
            if (!dates.end_of_sw_vulnerability_maintenance_date) {
                merakiDates.end_of_sw_vulnerability_maintenance_date = dates.last_day_of_support_date;
                merakiDates.sw_vulnerability_defaulted_to_ldos = true;
                console.log(`      Set SW Vulnerability to LDOS: ${dates.last_day_of_support_date}`);
            }
        }
        
        // If we only have one date, estimate the other
        if (dates.end_of_sale_date && !dates.last_day_of_support_date) {
            merakiDates.last_day_of_support_date = this._addYears(dates.end_of_sale_date, 5);
            merakiDates.ldos_estimated = true;
            merakiDates.end_of_sw_maintenance_date = merakiDates.last_day_of_support_date;
            merakiDates.end_of_sw_vulnerability_maintenance_date = merakiDates.last_day_of_support_date;
            merakiDates.sw_maintenance_defaulted_to_ldos = true;
            merakiDates.sw_vulnerability_defaulted_to_ldos = true;
            console.log(`      Estimated LDOS from EOS: ${merakiDates.last_day_of_support_date}`);
        } else if (!dates.end_of_sale_date && dates.last_day_of_support_date) {
            merakiDates.end_of_sale_date = this._subtractYears(dates.last_day_of_support_date, 5);
            merakiDates.eos_estimated = true;
            console.log(`      Estimated EOS from LDOS: ${merakiDates.end_of_sale_date}`);
        }
        
        return merakiDates;
    }

    // =====================================================
    // DATE ESTIMATION LOGIC (NON-MERAKI)
    // =====================================================
    _applyDateEstimation(dates) {
        console.log('\n   📊 Applying standard date estimation logic...');
        
        const estimatedDates = { ...dates };
        let baseEOS = null;
        
        // Step 1: Determine or calculate EOS
        if (dates.end_of_sale_date) {
            baseEOS = dates.end_of_sale_date;
            console.log(`      Using actual EOS as base: ${baseEOS}`);
        } else if (dates.last_day_of_support_date) {
            baseEOS = this._subtractYears(dates.last_day_of_support_date, 5);
            estimatedDates.eos_estimated = true;
            console.log(`      Estimated EOS from LDOS: ${baseEOS}`);
            estimatedDates.end_of_sale_date = baseEOS;
        }
        
        // Step 2: Calculate missing dates from EOS
        if (baseEOS) {
            if (!dates.end_of_sw_maintenance_date) {
                estimatedDates.end_of_sw_maintenance_date = this._addYears(baseEOS, 2);
                estimatedDates.sw_maintenance_estimated = true;
                console.log(`      Estimated SW Maintenance: ${estimatedDates.end_of_sw_maintenance_date}`);
            }
            
            if (!dates.end_of_sw_vulnerability_maintenance_date) {
                estimatedDates.end_of_sw_vulnerability_maintenance_date = this._addYears(baseEOS, 3);
                estimatedDates.sw_vulnerability_estimated = true;
                console.log(`      Estimated SW Vulnerability: ${estimatedDates.end_of_sw_vulnerability_maintenance_date}`);
            }
            
            if (!dates.last_day_of_support_date) {
                estimatedDates.last_day_of_support_date = this._addYears(baseEOS, 5);
                estimatedDates.ldos_estimated = true;
                console.log(`      Estimated LDOS: ${estimatedDates.last_day_of_support_date}`);
            }
        }
        
        return estimatedDates;
    }

    // =====================================================
    // ENHANCED CONFIDENCE CALCULATION (NEW SYSTEM)
    // =====================================================
    _calculateEnhancedConfidence(dates, isManufacturerSource) {
        let confidence = 0;
        let extractedCount = 0;
        let estimatedCount = 0;
        
        // Start with base confidence
        if (isManufacturerSource) {
            confidence = 50; // Base confidence for manufacturer page
            console.log(`      📊 Confidence calculation:`);
            console.log(`         Base (manufacturer page found): 50%`);
        } else {
            confidence = 30; // Lower base for third-party sources
            console.log(`      📊 Confidence calculation:`);
            console.log(`         Base (third-party source): 30%`);
        }
        
        // Check each date field
        const dateFields = [
            { field: 'end_of_sale_date', estimated: 'eos_estimated', name: 'EOS' },
            { field: 'end_of_sw_maintenance_date', estimated: 'sw_maintenance_estimated', name: 'SW Maintenance' },
            { field: 'end_of_sw_vulnerability_maintenance_date', estimated: 'sw_vulnerability_estimated', name: 'SW Vulnerability' },
            { field: 'last_day_of_support_date', estimated: 'ldos_estimated', name: 'LDOS' }
        ];
        
        for (const { field, estimated, name } of dateFields) {
            if (dates[field]) {
                // Special handling for Meraki SW dates that default to LDOS
                if ((field === 'end_of_sw_maintenance_date' && dates.sw_maintenance_defaulted_to_ldos) ||
                    (field === 'end_of_sw_vulnerability_maintenance_date' && dates.sw_vulnerability_defaulted_to_ldos)) {
                    // These count as extracted for Meraki
                    confidence += 10;
                    extractedCount++;
                    console.log(`         + 10% for ${name} = LDOS (Meraki standard)`);
                } else if (dates[estimated]) {
                    // This date was estimated/calculated
                    confidence += 5;
                    estimatedCount++;
                    console.log(`         + 5% for estimated ${name} (${dates[field]})`);
                } else {
                    // This date was extracted from the page
                    confidence += 10;
                    extractedCount++;
                    console.log(`         + 10% for extracted ${name} (${dates[field]})`);
                }
            }
        }
        
        // Cap confidence at 100%
        confidence = Math.min(confidence, 100);
        
        // Summary
        console.log(`      📊 Summary:`);
        console.log(`         Extracted dates: ${extractedCount}`);
        console.log(`         Estimated dates: ${estimatedCount}`);
        console.log(`      📊 Final confidence: ${confidence}%`);
        
        return confidence;
    }

    // =====================================================
    // VALIDATE DATE SPACING (ENSURE ~5 YEARS)
    // =====================================================
    _validateDateSpacing(dates) {
        if (dates.end_of_sale_date && dates.last_day_of_support_date) {
            const eosDate = new Date(dates.end_of_sale_date);
            const ldosDate = new Date(dates.last_day_of_support_date);
            
            // Calculate years difference
            const yearsDiff = (ldosDate - eosDate) / (1000 * 60 * 60 * 24 * 365.25);
            
            console.log(`      📏 Date spacing check: ${yearsDiff.toFixed(1)} years between EOS and LDOS`);
            
            // Allow 5 years +/- 3 months for variations
            if (yearsDiff < 4.75 || yearsDiff > 5.25) {
                console.log(`      ⚠️ Unusual spacing detected (expected ~5 years)`);
                dates.spacing_validated = false;
            } else {
                dates.spacing_validated = true;
            }
        }
        
        return dates;
    }

    // =====================================================
    // HELPER: Get Meraki Product Variations
    // =====================================================
    _getMerakiProductVariations(productId) {
        const variations = [productId];
        
        // Handle -HW suffix
        if (productId.endsWith('-HW')) {
            variations.push(productId.replace('-HW', ''));
        } else if (!productId.includes('-HW')) {
            variations.push(productId + '-HW');
        }
        
        // Handle MR33 vs MR-33 format
        if (productId.includes('-') && !productId.endsWith('-HW')) {
            variations.push(productId.replace('-', ''));
        } else if (!productId.includes('-')) {
            // Add hyphen after product line (MR, MS, MX, etc.)
            const hyphenated = productId.replace(/^(MR|MS|MX|MV|MT|MG)(\d+)/, '$1-$2');
            if (hyphenated !== productId) {
                variations.push(hyphenated);
            }
        }
        
        // Add "Meraki" prefix variations
        variations.push('Meraki ' + productId);
        
        return [...new Set(variations)]; // Remove duplicates
    }

    // =====================================================
    // HELPER METHODS - QUERIES
    // =====================================================
    _buildManufacturerQueries(productId, domains) {
        const queries = [];
        
        // Build site-specific queries for each domain
        for (const domain of domains) {
            queries.push(`"${productId}" site:${domain} "End-of-Life"`);
            queries.push(`"${productId}" site:${domain} "End-of-Sale"`);
            queries.push(`"${productId}" site:${domain} "EOL"`);
            queries.push(`"${productId}" site:${domain} "End of Support"`);
        }
        
        return queries;
    }

    _buildThirdPartyQueries(productId) {
        const queries = [];
        
        queries.push(`"${productId}" "End-of-Sale" "End-of-Life"`);
        queries.push(`"${productId}" "EOL" "announcement"`);
        queries.push(`"${productId}" "Last Date of Support"`);
        queries.push(`"${productId}" "End of Service Life"`);
        queries.push(`"${productId}" lifecycle dates`);
        
        return queries;
    }

    // =====================================================
    // HELPER METHODS - PRODUCT VARIATIONS
    // =====================================================
    _getProductVariations(productId) {
        const variations = [productId];
        
        // Add common variations
        if (productId.includes('-')) {
            // Try without dashes
            variations.push(productId.replace(/-/g, ''));
            // Try with spaces instead of dashes
            variations.push(productId.replace(/-/g, ' '));
        }
        
        // For Cisco products, try common transformations
        if (productId.startsWith('N9K-')) {
            variations.push(productId.replace('N9K-', 'Nexus '));
            variations.push(productId.replace('N9K-', ''));
        }
        if (productId.startsWith('WS-')) {
            variations.push(productId.replace('WS-', 'Catalyst '));
            variations.push(productId.replace('WS-', ''));
        }
        if (productId.startsWith('AIR-')) {
            variations.push(productId.replace('AIR-', 'Aironet '));
            variations.push(productId.replace('AIR-', ''));
        }
        
        // For Meraki products
        if (productId.match(/^(MR|MS|MX|MV|MT|MG)/i)) {
            variations.push('Meraki ' + productId);
            // Handle -HW suffix
            if (productId.endsWith('-HW')) {
                variations.push(productId.replace('-HW', ''));
            }
        }
        
        return [...new Set(variations)]; // Remove duplicates
    }

    // =====================================================
    // HELPER METHODS - MANUFACTURER IDENTIFICATION
    // =====================================================
    _extractManufacturer(record) {
        const productId = record.product_id || '';
        
        // Check for Meraki products first
        if (productId.match(/^(MR|MS|MX|MV|MT|MG)\d+/i)) {
            return 'Meraki';
        }
        
        // Check common Cisco prefixes
        if (productId.match(/^(WS-|N9K-|ASA|AIR-|C9[23456789]00|ISR|ASR|UCS|FPR|MDS)/i)) {
            return 'Cisco';
        }
        
        if (productId.match(/^(J[A-Z0-9]+-|EX\d+|SRX|QFX|MX\d+)/i)) return 'Juniper';
        if (productId.match(/^(FG-|FWF-|FAP-|FSW-)/i)) return 'Fortinet';
        if (productId.match(/^(PA-\d+|VM-)/i)) return 'Palo Alto';
        if (productId.match(/^DCS-\d+/i)) return 'Arista';
        
        return record.manufacturer || '';
    }

    _getManufacturerDomains(manufacturer) {
        if (!manufacturer) return null;
        
        // Handle Cisco/Meraki specially - search both domains
        if (manufacturer === 'Cisco' || manufacturer === 'Meraki') {
            return this.ciscoMerakiDomains;
        }
        
        // Try exact match first
        if (this.manufacturerDomains[manufacturer]) {
            return this.manufacturerDomains[manufacturer];
        }
        
        // Try case-insensitive match
        const lowerManufacturer = manufacturer.toLowerCase();
        for (const [key, domains] of Object.entries(this.manufacturerDomains)) {
            if (key.toLowerCase() === lowerManufacturer) {
                return domains;
            }
        }
        
        return null;
    }

    _isManufacturerUrl(url, manufacturerDomains) {
        if (!url || !manufacturerDomains) return false;
        
        for (const domain of manufacturerDomains) {
            if (url.includes(domain)) {
                return true;
            }
        }
        
        return false;
    }

    _isMerakiUrl(url) {
        return url.includes('meraki.com') || url.includes('documentation.meraki.com');
    }

    _isVendorSite(url) {
        return this.vendorDomains.some(domain => url.includes(domain));
    }

    // =====================================================
    // HELPER METHODS - DATE UTILITIES
    // =====================================================
    _parseDate(dateStr) {
        if (!dateStr) return null;
        
        try {
            dateStr = dateStr.trim().replace(/\s+/g, ' ');
            
            const patterns = [
                /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,  // Month DD, YYYY (e.g., "May 27, 2021")
                /(\d{1,2})\s+(\w+)\s+(\d{4})/,     // DD Month YYYY
                /(\d{4})[-\/](\d{2})[-\/](\d{2})/,  // YYYY-MM-DD or YYYY/MM/DD
                /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/  // MM-DD-YYYY or MM/DD/YYYY
            ];
            
            for (const pattern of patterns) {
                const match = dateStr.match(pattern);
                if (match) {
                    let date = null;
                    
                    if (pattern === patterns[0]) {
                        // Month name first (e.g., "May 27, 2021")
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
                        // Validate year is reasonable (1990-2040)
                        const year = date.getFullYear();
                        if (year >= 1990 && year <= 2040) {
                            return date.toISOString().split('T')[0];
                        }
                    }
                }
            }
            
            // Last resort: try native Date parsing
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                const year = date.getFullYear();
                if (year >= 1990 && year <= 2040) {
                    return date.toISOString().split('T')[0];
                }
            }
            
        } catch (error) {
            console.warn(`Failed to parse date: ${dateStr}`);
        }
        
        return null;
    }

    _addYears(dateString, years) {
        const date = new Date(dateString);
        date.setFullYear(date.getFullYear() + years);
        return date.toISOString().split('T')[0];
    }

    _subtractYears(dateString, years) {
        const date = new Date(dateString);
        date.setFullYear(date.getFullYear() - years);
        return date.toISOString().split('T')[0];
    }

    // =====================================================
    // HELPER METHODS - UTILITIES
    // =====================================================
    _hasAnyDates(dates) {
        return !!(dates.end_of_sale_date || 
                  dates.end_of_sw_maintenance_date || 
                  dates.end_of_sw_vulnerability_maintenance_date || 
                  dates.last_day_of_support_date);
    }

    _isEOLPage(url, title, snippet, productId) {
        const combinedText = `${title} ${snippet} ${url}`.toLowerCase();
        const productLower = productId.toLowerCase();
        
        // Check if product is mentioned
        if (!combinedText.includes(productLower)) {
            // Try without dashes
            const productNoDash = productLower.replace(/-/g, '');
            if (!combinedText.includes(productNoDash)) {
                return false;
            }
        }
        
        // Check for EOL keywords
        const eolKeywords = [
            'end-of-life', 'end of life', 'eol',
            'end-of-sale', 'end of sale', 'eos',
            'end-of-support', 'end of support',
            'last date', 'ldos', 'obsolete',
            'discontinued', 'retirement'
        ];
        
        return eolKeywords.some(keyword => combinedText.includes(keyword));
    }

    _shouldFetchFullPage(url) {
        // Always fetch manufacturer pages
        if (this._isVendorSite(url)) {
            return true;
        }
        
        // Fetch known good third-party sites
        const goodSites = [
            'router-switch.com',
            'it-supplier.co.uk',
            'parkplacetechnologies.com'
        ];
        
        return goodSites.some(site => url.includes(site));
    }

    _mergeDates(target, source, url) {
        if (source.end_of_sale_date && !target.end_of_sale_date) {
            target.end_of_sale_date = source.end_of_sale_date;
        }
        if (source.end_of_sw_maintenance_date && !target.end_of_sw_maintenance_date) {
            target.end_of_sw_maintenance_date = source.end_of_sw_maintenance_date;
        }
        if (source.end_of_sw_vulnerability_maintenance_date && !target.end_of_sw_vulnerability_maintenance_date) {
            target.end_of_sw_vulnerability_maintenance_date = source.end_of_sw_vulnerability_maintenance_date;
        }
        if (source.last_day_of_support_date && !target.last_day_of_support_date) {
            target.last_day_of_support_date = source.last_day_of_support_date;
        }
        
        // Add source
        if (url && !target.sources.some(s => s.url === url)) {
            target.sources.push({
                url: url,
                type: this._isVendorSite(url) ? 'vendor' : 'third_party'
            });
        }
    }

    // =====================================================
    // API CALL WITH RETRY
    // =====================================================
    async _performAPICallWithRetry(url, params, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await axios.get(url, {
                    params,
                    timeout: 10000
                });
                
                return response.data;
            } catch (error) {
                lastError = error;
                
                if (error.response && error.response.status === 429) {
                    // Rate limited - wait exponentially
                    const waitTime = Math.pow(2, attempt) * 1000;
                    console.log(`         ⏳ Rate limited, waiting ${waitTime}ms...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else if (attempt < maxRetries) {
                    // Other error - wait briefly
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        
        throw lastError;
    }

    // =====================================================
    // RESULT CREATION METHODS
    // =====================================================
    _createCurrentProductResult(record, sources = []) {
        return {
            success: true,
            manufacturer: record.manufacturer,
            product_category: record.product_category || 'Hardware',
            product_type: record.product_type || 'Unknown',
            description: record.description,
            date_introduced: null,
            end_of_sale_date: null,
            end_of_sw_maintenance_date: null,
            end_of_sw_vulnerability_maintenance_date: null,
            last_day_of_support_date: null,
            is_current_product: true,
            lifecycle_confidence: 90,
            overall_confidence: 90,
            data_sources: sources,
            message: 'Current product - no EOL announced by manufacturer'
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

    _transformDataSources(sources) {
        const result = {
            vendor_site: 0,
            third_party: 0,
            manual_entry: 0
        };
        
        if (Array.isArray(sources)) {
            sources.forEach(source => {
                if (source.type === 'vendor' || (source.url && this._isVendorSite(source.url))) {
                    result.vendor_site++;
                } else if (source.type === 'third_party' || source.url) {
                    result.third_party++;
                }
            });
        }
        
        return result;
    }
}

// Export singleton instance
module.exports = new GoogleAIResearchService();