// backend/src/services/generativeAIResearchService.js
// Generative AI-powered lifecycle research service
// Uses Google Gemini API to research product lifecycle dates based on manufacturer and product information

const axios = require('axios');

class GenerativeAIResearchService {
    constructor() {
        // Support multiple AI providers - default to Google Gemini
        // NOTE: API keys are loaded lazily to ensure dotenv has loaded them
        this.provider = null; // Will be loaded on first use
        this.apiKey = null; // Will be loaded on first use
        this.model = process.env.GEMINI_MODEL || 'gemini-2.5-pro';
        this.maxRetries = 3;
        
        // OpenAI configuration (if using OpenAI)
        this.openaiApiKey = null; // Will be loaded on first use
        this.openaiModel = process.env.OPENAI_MODEL || 'gpt-4';
        
        // Anthropic configuration (if using Anthropic)
        this.anthropicApiKey = null; // Will be loaded on first use
        this.anthropicModel = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20240620';
        
        // Manufacturer domain mapping (for data source attribution)
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
    }

    // =====================================================
    // MAIN PRODUCTION INTERFACE - Matches googleAIResearchService exactly
    // =====================================================
    async performResearch(product) {
        console.log(`🤖 Starting generative AI research for ${product.product_id}`);
        
        try {
            // Call the internal research method
            const result = await this._performGenerativeResearch({
                product_id: product.product_id || '',
                manufacturer: product.manufacturer || '',
                product_category: product.product_category || product.category || '',
                product_type: product.product_type || product.type || '',
                description: product.description || product.product_description || ''
            });
            
            // Transform to production format (exact match with googleAIResearchService)
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
            console.error(`❌ Generative AI research failed for ${product.product_id}:`, error.message);
            return this._getDefaultResult();
        }
    }

    // =====================================================
    // GENERATIVE AI RESEARCH IMPLEMENTATION
    // =====================================================
    async _performGenerativeResearch(record) {
        console.log('🤖 ==========================================');
        console.log('🤖 GENERATIVE AI LIFECYCLE RESEARCH');
        console.log('🤖 Product:', record.product_id);
        console.log('🤖 Manufacturer:', record.manufacturer);
        console.log('🤖 ==========================================');
        
        // Lazy load configuration (ensures dotenv has loaded)
        this._loadConfiguration();
        
        if (!this._hasValidCredentials()) {
            console.error('❌ Missing AI API credentials');
            console.error(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'SET' : 'NOT SET'}`);
            console.error(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET'}`);
            console.error(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'SET' : 'NOT SET'}`);
            console.error(`   AI_RESEARCH_PROVIDER: ${process.env.AI_RESEARCH_PROVIDER || 'NOT SET (defaults to gemini)'}`);
            return this._createErrorResult(record, 'AI API credentials not configured');
        }
        
        try {
            // Build the research prompt
            const prompt = this._buildResearchPrompt(record);
            
            // Call the appropriate AI provider
            let aiResponse;
            switch (this.provider.toLowerCase()) {
                case 'openai':
                    aiResponse = await this._callOpenAI(prompt);
                    break;
                case 'anthropic':
                    aiResponse = await this._callAnthropic(prompt);
                    break;
                case 'gemini':
                default:
                    aiResponse = await this._callGemini(prompt);
                    break;
            }
            
            // ENHANCED: Log raw AI response for verification
            console.log(`   📝 Raw AI Response for ${record.product_id}:`);
            console.log(`   ${'='.repeat(80)}`);
            console.log(aiResponse.substring(0, 1000)); // First 1000 chars
            if (aiResponse.length > 1000) {
                console.log(`   ... (${aiResponse.length - 1000} more characters)`);
            }
            console.log(`   ${'='.repeat(80)}`);
            
            // Parse the AI response to extract dates and match information
            const extractedDates = this._parseAIResponse(aiResponse, record);
            
            // Log match information
            if (extractedDates.match_type && extractedDates.match_type !== 'no_match') {
                console.log(`   🔍 Match Information:`);
                console.log(`      Match Type: ${extractedDates.match_type}`);
                console.log(`      Match Found: ${extractedDates.match_found || 'N/A'}`);
                console.log(`      Confidence: ${extractedDates.confidence}% (${extractedDates.match_type === 'direct' ? 'Direct match' : 'Match with extra characters'})`);
            } else {
                console.log(`   ⚠️ No match found for Product ID: ${record.product_id}`);
            }
            
            // ACCURACY CHECK: Validate that dates seem reasonable
            // If we have an End-of-Sale date, check if it's suspiciously early (before 2000) or future
            if (extractedDates.end_of_sale_date) {
                const eosDate = new Date(extractedDates.end_of_sale_date);
                const currentYear = new Date().getFullYear();
                const eosYear = eosDate.getFullYear();
                
                // Check for suspiciously early dates (before 2000)
                if (eosYear < 2000) {
                    console.warn(`   ⚠️ ACCURACY WARNING: End-of-Sale date ${extractedDates.end_of_sale_date} is before 2000`);
                    console.warn(`   ⚠️ This may indicate incorrect date extraction or outdated training data`);
                    // Reduce confidence significantly
                    extractedDates.confidence = Math.max(0, (extractedDates.confidence || 0) - 30);
                }
                
                // Check for future dates (more than 5 years in the future is suspicious)
                if (eosYear > currentYear + 5) {
                    console.warn(`   ⚠️ ACCURACY WARNING: End-of-Sale date ${extractedDates.end_of_sale_date} is more than 5 years in the future`);
                    console.warn(`   ⚠️ This may indicate incorrect date extraction`);
                    extractedDates.confidence = Math.max(0, (extractedDates.confidence || 0) - 20);
                }
            }
            
            // Apply date estimation logic ONLY for MISSING dates (not to override existing dates)
            // If AI provided dates with high confidence, we should NOT estimate over them
            const shouldEstimate = (extractedDates.confidence || 0) < 70 || 
                                   (!extractedDates.end_of_sale_date && !extractedDates.last_day_of_support_date);
            
            let estimatedDates;
            if (shouldEstimate) {
                console.log(`   📊 Applying date estimation for missing dates (confidence: ${extractedDates.confidence}%)`);
                estimatedDates = this._applyDateEstimation(extractedDates);
            } else {
                console.log(`   ✅ Skipping estimation - using AI-provided dates (confidence: ${extractedDates.confidence}%)`);
                // Only estimate missing dates, don't override what AI found
                estimatedDates = this._applyDateEstimation(extractedDates, true); // true = only estimate missing
            }
            
            // Validate date spacing
            const validatedDates = this._validateDateSpacing(estimatedDates);
            
            // ENHANCED: Quality validation checks
            const qualityChecks = this._performQualityChecks(validatedDates, record);
            if (qualityChecks.issues.length > 0) {
                console.warn(`   ⚠️ Quality issues detected for ${record.product_id}:`);
                qualityChecks.issues.forEach(issue => {
                    console.warn(`      - ${issue}`);
                });
            }
            
            // Calculate confidence (reduce if quality issues found)
            let confidence = this._calculateConfidence(validatedDates, record);
            if (qualityChecks.issues.length > 0) {
                confidence = Math.max(0, confidence - (qualityChecks.issues.length * 10));
                console.log(`   📉 Confidence reduced to ${confidence}% due to quality issues`);
            }
            
            // Determine if product is current
            const isCurrent = this._determineIfCurrent(validatedDates, aiResponse);
            
            // Build data sources using parsed dates (which includes sources from AI)
            const dataSources = this._buildDataSources(record, aiResponse, extractedDates);
            
            // Also preserve the sources array from extractedDates for direct access
            const sourcesArray = extractedDates.sources || [];
            
            return {
                ...validatedDates,
                is_current_product: isCurrent,
                lifecycle_confidence: confidence,
                overall_confidence: confidence,
                data_sources: dataSources, // Array of {url, type} objects
                sources: sourcesArray, // Also include sources directly for easier access
                // ENHANCED: Add match information for verification
                match_type: extractedDates.match_type || 'no_match',
                match_found: extractedDates.match_found || null,
                // ENHANCED: Add metadata for verification
                research_method: 'generative',
                ai_provider: this.provider,
                raw_ai_response: aiResponse.substring(0, 2000), // Store first 2000 chars for debugging
                quality_checks: qualityChecks,
                research_timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Generative AI research error:', error.message);
            return this._createErrorResult(record, error.message);
        }
    }

    // =====================================================
    // PROMPT BUILDING
    // =====================================================
    _buildResearchPrompt(record) {
        const manufacturer = record.manufacturer || 'Unknown';
        const productId = record.product_id || '';
        const description = record.description || '';
        const category = record.product_category || record.category || '';
        
        // Build manufacturer site URLs
        const manufacturerSites = this._getManufacturerDomains(manufacturer);
        const manufacturerSitesList = manufacturerSites ? manufacturerSites.join(', ') : `${manufacturer.toLowerCase().replace(/\s+/g, '')}.com`;
        
        // Build a clear, direct search query focusing on Product ID
        const searchQuery = `${manufacturer} ${productId} EOL end of life lifecycle dates`;
        
        // Build manufacturer-specific EOL page patterns for guidance
        let manufacturerGuidance = '';
        const mfrLower = manufacturer.toLowerCase();
        if (mfrLower.includes('cisco')) {
            manufacturerGuidance = `
OFFICIAL CISCO EOL PAGES TO PRIORITIZE:
- Look for pages like: cisco.com/c/en/us/products/.../...-eol.html or .../eos-eol-notice-listing.html
- Cisco EOL pages contain tables with exact Product Part Numbers and milestone dates
- Key milestones: End-of-Sale Date, End of SW Maintenance, End of Vulnerability/Security Support, Last Date of Support
- Example: If searching for "WS-C3560CX-8PC-S", look for it in the "Product part numbers" table on Cisco EOL pages
- The Product ID "${productId}" MUST appear EXACTLY in the EOL announcement table`;
        } else if (mfrLower.includes('hp') || mfrLower.includes('hpe')) {
            manufacturerGuidance = `
OFFICIAL HPE EOL PAGES TO PRIORITIZE:
- Look for pages on hpe.com or support.hpe.com with "End of Life" or "Product Lifecycle" information
- HPE lifecycle pages list products with specific EOL dates`;
        } else if (mfrLower.includes('dell')) {
            manufacturerGuidance = `
OFFICIAL DELL EOL PAGES TO PRIORITIZE:
- Look for pages on dell.com/support or delltechnologies.com with "End of Life" information
- Dell EOL pages contain product-specific lifecycle dates`;
        }
        
        return `You are an expert IT hardware lifecycle analyst. Your task is to find the EXACT, OFFICIAL End-of-Life (EOL) dates for a specific product by locating official manufacturer EOL announcements and product bulletins.

PRODUCT DETAILS:
- Manufacturer: ${manufacturer}
- Product ID/Model: "${productId}" (CRITICAL: This exact Product ID must be found in official EOL documentation)
- Description: ${description}
- Category: ${category}

CRITICAL SEARCH PRIORITY - MUST FOLLOW THIS ORDER:

1. FIRST PRIORITY: Official Manufacturer EOL Announcements
   - Search for "${productId}" in official ${manufacturer} End-of-Life/End-of-Sale announcements
   - Look for official EOL pages like:
     * Cisco: cisco.com/c/en/us/products/.../...-eol.html or .../eos-eol-notice-listing.html
     * HPE: hpe.com lifecycle pages or support.hpe.com
     * Dell: dell.com/support lifecycle pages
     * Meraki: meraki.com EOL announcements
     * Other manufacturers: their official lifecycle/product support pages
   ${manufacturerGuidance}
   
2. SECOND PRIORITY: Product-Specific EOL Tables/Bulletins
   - Look for "${productId}" in EOL announcement tables that list Product Part Numbers
   - Extract dates from official milestone tables (End-of-Sale Date, End of SW Maintenance, etc.)
   - Verify the Product ID appears EXACTLY as "${productId}" in the table

3. THIRD PRIORITY: Product Series/Line EOL Information
   - If "${productId}" is part of a series (e.g., "3560-CX" series), check series-level EOL pages
   - Look for the exact Product ID in product part number tables
   - Only use series-level dates if the exact "${productId}" is listed in the announcement

4. LAST RESORT: Similar Products (use with lower confidence)
   - Only if you cannot find "${productId}" in any official EOL documentation
   - Consider similar products in the same product line
   - Set confidence to 50-60% and clearly indicate this is an estimate

MATCH REQUIREMENTS - VERIFICATION IS CRITICAL:

- DIRECT MATCH (95% confidence): 
  * You found "${productId}" EXACTLY as shown in an official manufacturer EOL announcement table
  * The dates come directly from the official EOL milestone table for this specific product
  * Example: "${productId}" appears in a "Product Part Numbers" table with specific milestone dates
  
- MATCH WITH EXTRA CHARACTERS (85% confidence):
  * You found "${productId}" with additional characters but the full Product ID is present
  * Example: "${productId}-TAA", "NAL-${productId}", or "${manufacturer} ${productId}"
  * The dates come from official documentation listing this variant
  
- PARTIAL MATCH (60-70% confidence):
  * You found EOL information for the product SERIES (e.g., "3560-CX series") that likely includes "${productId}"
  * The exact Product ID isn't listed but dates are provided for the product family
  * Use only if no exact match is available
  
- NO MATCH (0% confidence):
  * You cannot find "${productId}" or similar products in any official EOL documentation
  * Return null for dates and set confidence to 0%

ACCURACY REQUIREMENTS:

- DATE PRECISION IS CRITICAL: If an official EOL page shows "April 30, 2024", return "2024-04-30" NOT "2024-01-27" or any other date
- DO NOT ESTIMATE if you find an official EOL announcement - use the EXACT dates from the table
- DO NOT use general patterns or estimates if official dates are available
- If you find the Product ID in an EOL table, extract the dates directly from that table
- Cross-check dates: End-of-Sale Date should be before Last Date of Support
- If dates seem inconsistent in your knowledge, prioritize official EOL announcement dates

REQUIRED INFORMATION TO FIND (Extract from Official EOL Tables):

1. End of Sale (EOS) date - "End-of-Sale Date" from official EOL announcement (format: YYYY-MM-DD)
2. End of Software Maintenance (EOSM) date - "End of SW Maintenance" or "End of Software Maintenance" from EOL announcement (format: YYYY-MM-DD)
3. End of Software Vulnerability Maintenance (EOSV) date - "End of Vulnerability/Security Support" or "End of Security Support" from EOL announcement (format: YYYY-MM-DD)
4. Last Day of Support (LDOS) date - "Last Date of Support" from official EOL announcement (format: YYYY-MM-DD)
5. Date Introduced - when the product was first released (format: YYYY-MM-DD) - only if found in official documentation
6. Current Status - whether the product is still active/current

CRITICAL DATE EXTRACTION RULES - EXACT DAY ACCURACY REQUIRED:

- Extract dates DIRECTLY from official EOL milestone tables - do NOT estimate or approximate
- If an EOL table shows "December 29, 2016", extract it as "2016-12-29" (day 29) - use the EXACT day number
- CRITICAL: The day number must match EXACTLY what is in the table (e.g., if table shows "29", use "29", NOT "28")
- Do NOT subtract days, do NOT adjust for timezones, do NOT convert to UTC - use the exact date as shown
- If an EOL table shows "April 30, 2024", extract it as "2024-04-30" (day 30) - be precise to the day
- When converting from "Month DD, YYYY" format to "YYYY-MM-DD", preserve the EXACT day number
- Verify date order: End-of-Sale < End of SW Maintenance < End of Vulnerability Support < Last Date of Support
- If you find "${productId}" in an EOL table, use the dates from that specific row
- DO NOT substitute similar product dates unless you explicitly note it as a partial match
- If dates are shown as "December 29, 2016" format, convert to "2016-12-29" format with the EXACT same day (29)

RESPONSE FORMAT:
Respond with ONLY a valid JSON object (no markdown, no code blocks, no additional text):

{
  "end_of_sale_date": "YYYY-MM-DD or null",
  "end_of_sw_maintenance_date": "YYYY-MM-DD or null",
  "end_of_sw_vulnerability_maintenance_date": "YYYY-MM-DD or null",
  "last_day_of_support_date": "YYYY-MM-DD or null",
  "date_introduced": "YYYY-MM-DD or null",
  "is_current_product": true or false,
  "match_type": "direct" or "with_extra_chars" or "partial" or "no_match",
  "match_found": "exact product ID as found in source" or "similar product" or null,
  "confidence": 95 for direct match, 85 for match with extra chars, 60-70 for partial, 0 for no match,
  "reasoning": "Brief explanation of where you found the information or how you estimated the dates, what match type it was, and why dates are null if not found",
  "sources": ["URLs if available, or 'knowledge_base' if using general knowledge", "manufacturer_site if information comes from typical manufacturer patterns"]
}

CRITICAL REQUIREMENTS - ACCURACY FIRST:

1. PRIORITIZE OFFICIAL SOURCES: If you find "${productId}" in an official manufacturer EOL announcement, use the EXACT dates from that announcement table
2. VERIFY PRODUCT ID: Before extracting dates, confirm that "${productId}" (or a close variant) appears in the EOL documentation
3. EXTRACT EXACT DATES: If an EOL table shows "April 30, 2024" for End-of-Sale Date, return "2024-04-30" - do NOT approximate or estimate
4. CHECK DATE LOGIC: Ensure End-of-Sale Date < End of SW Maintenance < End of Vulnerability Support < Last Date of Support
5. CONFIDENCE SCORING:
   - 95% = Found "${productId}" EXACTLY in official EOL table, dates extracted directly from table
   - 85% = Found "${productId}" with extra characters in official EOL table, dates from official source
   - 60-70% = Found product series EOL info, "${productId}" likely included but not explicitly listed
   - 50% = Estimated based on similar products, no official EOL found
   - 0% = No information found, return null
6. SOURCE DOCUMENTATION: In your "reasoning" field, specify:
   - The exact URL or page type where you found the information (e.g., "Cisco EOL announcement page", "cisco.com/c/en/us/products/.../...-eol.html")
   - Whether "${productId}" was listed exactly or as part of a series
   - The milestone table structure you used to extract dates
   - If you did NOT find "${productId}" in an official EOL table, clearly state this and explain why you're providing dates anyway
7. DATE FORMAT: Always use YYYY-MM-DD format (e.g., "2024-04-30", not "April 30, 2024")
8. NO HALLUCINATION: Only return dates you actually found in official EOL documentation. 
   - DO NOT invent dates based on patterns or estimates
   - DO NOT use dates from similar products without explicitly stating it's a partial match
   - If you're uncertain about a date, DO NOT guess - set it to null and lower confidence
   - If you find "${productId}" in an EOL table but can't read the dates clearly, return null rather than guessing
9. VERIFICATION REQUIRED: Before returning any date, ask yourself:
   - "Did I see this exact date in an official EOL announcement table for '${productId}'?"
   - "Am I estimating or inferring this date, or did I extract it directly from a table?"
   - "If I'm not 100% certain, should I lower confidence or return null?"

EXAMPLES OF CORRECT DATE EXTRACTION:

Example 1 - Product in EOL Table:
If you find "${productId}" in a Cisco EOL announcement table (e.g., on a page like cisco.com/c/en/us/products/collateral/switches/...-eol.html) showing:
  - End-of-Sale Date: HW: April 30, 2024
  - End of SW Maintenance Releases Date: HW: April 30, 2025
  - End of Vulnerability/Security Support: HW: April 30, 2029
  - Last Date of Support: HW: April 30, 2029

Return EXACTLY:
{
  "end_of_sale_date": "2024-04-30",
  "end_of_sw_maintenance_date": "2025-04-30",
  "end_of_sw_vulnerability_maintenance_date": "2029-04-30",
  "last_day_of_support_date": "2029-04-30",
  "match_type": "direct",
  "confidence": 95,
  "reasoning": "Found '${productId}' exactly listed in Product Part Numbers table of Cisco EOL announcement. Dates extracted directly from End-of-Life milestones table: End-of-Sale April 30, 2024, End of SW Maintenance April 30, 2025, End of Vulnerability Support April 30, 2029, Last Date of Support April 30, 2029.",
  "sources": ["https://www.cisco.com/c/en/us/products/collateral/switches/.../...-eol.html"]
}

Example 2 - Cisco Aironet 2600 Series (Real Example - CRITICAL: Use EXACT day):
If you find "AIR-CAP2602I-A-K9" in a Cisco EOL announcement (cisco.com/c/en/us/products/collateral/wireless/aironet-2600-series/eos-eol-notice-c51-737512.html), the EOL milestones table shows:
  - End-of-Sale Date: December 29, 2016
  - Last Date of Support: December 31, 2021
  - End of SW Maintenance Releases Date: December 29, 2017

CRITICAL: The date is "December 29, 2016" (the 29th day) - NOT "December 28, 2016" (the 28th day).
Extract the EXACT day number from the table - do NOT subtract days, do NOT adjust for timezones, do NOT approximate.

Return EXACTLY (using the 29th day, not the 28th):
{
  "end_of_sale_date": "2016-12-29",
  "end_of_sw_maintenance_date": "2017-12-29",
  "end_of_sw_vulnerability_maintenance_date": "2021-12-31",
  "last_day_of_support_date": "2021-12-31",
  "match_type": "direct",
  "confidence": 95,
  "reasoning": "Found AIR-CAP2602I-A-K9 exactly listed in Product Part Numbers table of Cisco EOL announcement. Dates extracted directly from End-of-Life milestones table: End-of-Sale December 29, 2016 (the 29th day), End of SW Maintenance December 29, 2017 (the 29th day), Last Date of Support December 31, 2021 (the 31st day).",
  "sources": ["https://www.cisco.com/c/en/us/products/collateral/wireless/aironet-2600-series/eos-eol-notice-c51-737512.html"]
}

IMPORTANT: When you see "December 29, 2016" in the table, extract "2016-12-29" (day 29). Do NOT extract "2016-12-28" (day 28). The day number must match EXACTLY what is in the table.

CRITICAL - EXACT DATE ACCURACY:
- If you see "${productId}" in an EOL table with dates, use THOSE EXACT DATES from the milestone table
- EXTRACT THE EXACT DAY NUMBER: If the table shows "December 29, 2016", use day 29 (2016-12-29), NOT day 28 (2016-12-28)
- Do NOT subtract days, do NOT adjust for timezones, do NOT convert dates - use exactly what's shown
- Do NOT estimate, approximate, or use dates from similar products
- Do NOT use dates from your training data if they differ from what's in the official EOL announcement
- If you find the product in an official EOL page, the dates from that page take precedence over any general knowledge
- Before returning a date, verify: Does the day number match what's in the EOL table? (e.g., if table shows "29th", your JSON should have "-29" not "-28")

ACCURACY CHECK:
- Before returning dates, verify: Does the official EOL documentation show "${productId}" exactly?
- If yes, extract dates directly from the milestone table for that row
- If no, do not use dates from similar products without explicitly noting it as a partial match with lower confidence

- Only return valid JSON. Do not include any explanatory text before or after the JSON object.`;
    }

    // =====================================================
    // AI PROVIDER CALLS
    // =====================================================
    async _listAvailableGeminiModels() {
        // List available models to see what's actually accessible
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`;
        try {
            const response = await axios.get(listUrl);
            if (response.data && response.data.models) {
                const modelNames = response.data.models.map(m => m.name).filter(n => n);
                console.log(`   📋 Available Gemini models: ${modelNames.join(', ')}`);
                return modelNames;
            }
        } catch (error) {
            console.error(`   ⚠️  Could not list models: ${error.message}`);
        }
        return [];
    }
    
    async _listAvailableAnthropicModels() {
        // List available Anthropic models dynamically
        this._loadConfiguration();
        
        if (!this.anthropicApiKey) {
            console.error(`   ⚠️  Cannot list Anthropic models: API key not configured`);
            return [];
        }
        
        const listUrl = 'https://api.anthropic.com/v1/models';
        try {
            console.log(`   📋 Querying Anthropic API for available models...`);
            const response = await axios.get(listUrl, {
                headers: {
                    'x-api-key': this.anthropicApiKey,
                    'anthropic-version': '2023-06-01'
                }
            });
            
            if (response.data && response.data.data && Array.isArray(response.data.data)) {
                const modelIds = response.data.data.map(m => m.id).filter(id => id);
                console.log(`   ✅ Available Anthropic models: ${modelIds.join(', ')}`);
                return modelIds;
            }
        } catch (error) {
            console.error(`   ⚠️  Could not list Anthropic models: ${error.message}`);
            if (error.response && error.response.data) {
                console.error(`      Error response:`, JSON.stringify(error.response.data, null, 2));
            }
        }
        return [];
    }
    
    async _callGemini(prompt) {
        // Ensure configuration is loaded
        this._loadConfiguration();
        
        if (!this.apiKey) {
            throw new Error('Gemini API key not configured');
        }
        
        // Remove 'models/' prefix if present (we'll add it in the URL)
        const cleanModelName = this.model.replace(/^models\//, '');
        
        const payload = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.1,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 2048,
            }
        };
        
        // Try the configured model first (from .env file)
        const apiVersions = ['v1beta', 'v1'];
        
        for (const apiVersion of apiVersions) {
            const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${cleanModelName}:generateContent?key=${this.apiKey}`;
            
            try {
                console.log(`   🔗 Calling Gemini API: ${apiVersion}/${cleanModelName}`);
                
                const response = await this._performAPICallWithRetry(url, payload, 'POST');
                
                if (response.candidates && response.candidates[0] && response.candidates[0].content) {
                    const text = response.candidates[0].content.parts[0].text;
                    console.log(`   ✅ Gemini API success with ${apiVersion}/${cleanModelName} (${text.length} characters)`);
                    return text;
                }
            } catch (error) {
                // Handle 429 (quota/rate limit) errors specially
                if (error.response && error.response.status === 429) {
                    const errorData = error.response.data;
                    const isQuotaExceeded = errorData?.error?.details?.some(d => 
                        d['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure'
                    ) || errorData?.error?.message?.includes('quota');
                    
                    if (isQuotaExceeded) {
                        console.error(`   ❌ QUOTA EXCEEDED for ${cleanModelName}`);
                        console.error(`   💡 Free tier limit: 50 requests/day for ${cleanModelName}`);
                        console.error(`   💡 Suggestions:`);
                        console.error(`      - Enable "Use Cached Research" to avoid API calls`);
                        console.error(`      - Switch to a different model (gemini-2.0-flash-exp, gemini-pro, or gemini-pro-vision)`);
                        console.error(`      - Wait until tomorrow for quota reset`);
                        console.error(`      - Upgrade to paid plan for higher limits`);
                        // Try fallback models below instead of throwing immediately
                    }
                    // Re-throw to let _performAPICallWithRetry handle retry logic
                    throw error;
                }
                
                // If it's not a 404, re-throw (might be auth error, etc.)
                if (error.response && error.response.status !== 404) {
                    console.error(`   ❌ Non-404 error with ${apiVersion}/${cleanModelName}: ${error.response.status}`);
                    throw error;
                }
                // 404 means model not found, try next API version
                if (error.response && error.response.status === 404) {
                    console.log(`   ⚠️  ${apiVersion}/${cleanModelName} not found, trying ${apiVersion === 'v1beta' ? 'v1' : 'fallback'}...`);
                    continue;
                }
            }
        }
        
        // Check if we had a quota exceeded error - try fallback models
        let quotaExceeded = false;
        try {
            const lastError = await new Promise((_, reject) => {
                // This won't execute, but we'll check the error in the catch below
            });
        } catch (checkError) {
            // Check if previous error was quota exceeded
            if (checkError && checkError.response && checkError.response.status === 429) {
                const errorData = checkError.response.data;
                quotaExceeded = errorData?.error?.details?.some(d => 
                    d['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure'
                ) || errorData?.error?.message?.includes('quota');
            }
        }
        
        // If quota exceeded, try alternative models that might have different limits
        if (quotaExceeded || cleanModelName.includes('2.5-pro')) {
            console.log(`   🔄 Trying alternative models that may have different quota limits...`);
            const fallbackModels = ['gemini-2.0-flash-exp', 'gemini-2.0-flash-thinking-exp', 'gemini-pro', 'gemini-pro-vision'];
            
            for (const fallbackModel of fallbackModels) {
                const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${this.apiKey}`;
                try {
                    console.log(`   🔗 Trying fallback model: ${fallbackModel}`);
                    const fallbackResponse = await this._performAPICallWithRetry(fallbackUrl, payload, 'POST');
                    if (fallbackResponse.candidates && fallbackResponse.candidates[0] && fallbackResponse.candidates[0].content) {
                        const text = fallbackResponse.candidates[0].content.parts[0].text;
                        console.log(`   ✅ Success with fallback model ${fallbackModel}`);
                        console.log(`   💡 Consider updating GEMINI_MODEL in .env to: ${fallbackModel}`);
                        return text;
                    }
                } catch (fallbackError) {
                    // Try next fallback model
                    continue;
                }
            }
        }
        
        // If configured model failed, try listing available models and use the first one
        console.log(`   ⚠️  Configured model '${cleanModelName}' not found, listing available models...`);
        const availableModels = await this._listAvailableGeminiModels();
        
        if (availableModels.length > 0) {
            // Find a model that supports generateContent
                const workingModel = availableModels.find(m => 
                m.includes('2.5-pro') || m.includes('2.0-flash') || m.includes('pro-latest') || m.includes('pro')
            ) || availableModels[0];
            
            const modelToUse = workingModel.replace(/^models\//, '');
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${this.apiKey}`;
            
            try {
                console.log(`   🔗 Trying available model: ${modelToUse}`);
                const response = await this._performAPICallWithRetry(url, payload, 'POST');
                if (response.candidates && response.candidates[0] && response.candidates[0].content) {
                    const text = response.candidates[0].content.parts[0].text;
                    console.log(`   ✅ Success with available model ${modelToUse}`);
                    console.log(`   💡 Consider updating GEMINI_MODEL in .env to: ${modelToUse}`);
                    return text;
                }
            } catch (error) {
                console.error(`   ❌ Even available model failed: ${error.message}`);
            }
        }
        
        // If we got here, model wasn't found (404) or other error
        const errorMsg = lastQuotaError 
            ? `Gemini API quota exceeded for ${cleanModelName}. Free tier limit: 50 requests/day. Suggestions: Enable "Use Cached Research", switch to gemini-2.0-flash-exp or gemini-pro, or upgrade to paid plan.`
            : `Could not find a working Gemini model. Configured model '${cleanModelName}' not available. Please check your API key permissions and update GEMINI_MODEL in .env file.`;
        
        throw new Error(errorMsg);
    }
    

    async _callOpenAI(prompt) {
        // Ensure configuration is loaded
        this._loadConfiguration();
        
        if (!this.openaiApiKey) {
            throw new Error('OpenAI API key not configured');
        }
        
        const url = 'https://api.openai.com/v1/chat/completions';
        
        const payload = {
            model: this.openaiModel,
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert IT hardware lifecycle analyst. Provide accurate product lifecycle dates in JSON format only.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.1,
            max_tokens: 2048
        };
        
        try {
            const response = await this._performAPICallWithRetry(
                url,
                payload,
                'POST',
                {
                    'Authorization': `Bearer ${this.openaiApiKey}`,
                    'Content-Type': 'application/json'
                }
            );
            
            if (response.choices && response.choices[0] && response.choices[0].message) {
                return response.choices[0].message.content;
            }
            
            throw new Error('Invalid response format from OpenAI API');
        } catch (error) {
            console.error('OpenAI API error:', error.message);
            throw error;
        }
    }

    async _callAnthropic(prompt) {
        // Ensure configuration is loaded
        this._loadConfiguration();
        
        if (!this.anthropicApiKey) {
            throw new Error('Anthropic API key not configured');
        }
        
        const url = 'https://api.anthropic.com/v1/messages';
        
        const payload = {
            model: this.anthropicModel,
            max_tokens: 4096, // Increased from 2048 for better responses
            temperature: 0.1,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        };
        
        try {
            console.log(`   🔗 Calling Anthropic API: ${url}`);
            console.log(`      Model: ${this.anthropicModel}`);
            console.log(`      Max tokens: ${payload.max_tokens}`);
            
            const response = await this._performAPICallWithRetry(
                url,
                payload,
                'POST',
                {
                    'x-api-key': this.anthropicApiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                }
            );
            
            console.log(`   ✅ Anthropic API response received`);
            
            if (response.content && response.content[0] && response.content[0].text) {
                return response.content[0].text;
            }
            
            throw new Error('Invalid response format from Anthropic API');
        } catch (error) {
            console.error('Anthropic API error:', error.message);
            
            // Enhanced error logging
            if (error.response) {
                console.error(`   ❌ API Error Response:`);
                console.error(`      Status: ${error.response.status}`);
                console.error(`      Status Text: ${error.response.statusText}`);
                console.error(`      URL: ${url}`);
                console.error(`      Model: ${this.anthropicModel}`);
                
                if (error.response.data) {
                    console.error(`      Response Data:`, JSON.stringify(error.response.data, null, 2));
                }
                
                // If 404, try to list available models and use one that works
                if (error.response.status === 404) {
                    console.error(`   ⚠️  404 Error - Model '${this.anthropicModel}' not found`);
                    console.error(`   🔄 Attempting to discover available Anthropic models...`);
                    
                    try {
                        const availableModels = await this._listAvailableAnthropicModels();
                        
                        if (availableModels.length > 0) {
                            // Try to find a suitable model (prioritize sonnet, then opus, then others)
                            const modelPriority = [
                                'sonnet',
                                'opus',
                                'haiku',
                                'claude'
                            ];
                            
                            let fallbackModel = null;
                            for (const priority of modelPriority) {
                                fallbackModel = availableModels.find(m => 
                                    m.toLowerCase().includes(priority)
                                );
                                if (fallbackModel) break;
                            }
                            
                            // If no priority match, just use the first available
                            if (!fallbackModel) {
                                fallbackModel = availableModels[0];
                            }
                            
                            console.log(`   🔗 Trying fallback model: ${fallbackModel}`);
                            
                            // Update payload with the available model
                            payload.model = fallbackModel;
                            
                            // Retry the API call with the available model
                            const fallbackResponse = await this._performAPICallWithRetry(
                                url,
                                payload,
                                'POST',
                                {
                                    'x-api-key': this.anthropicApiKey,
                                    'anthropic-version': '2023-06-01',
                                    'Content-Type': 'application/json'
                                }
                            );
                            
                            if (fallbackResponse.content && fallbackResponse.content[0] && fallbackResponse.content[0].text) {
                                console.log(`   ✅ Success with fallback model: ${fallbackModel}`);
                                console.log(`   💡 Consider updating ANTHROPIC_MODEL in .env to: ${fallbackModel}`);
                                
                                // Optionally update the configured model for future use
                                this.anthropicModel = fallbackModel;
                                
                                return fallbackResponse.content[0].text;
                            }
                        } else {
                            console.error(`   ⚠️  Could not retrieve available models. Using fallback suggestions...`);
                            console.error(`   💡 Try updating ANTHROPIC_MODEL in .env to one of these common models:`);
                            console.error(`      - claude-3-5-sonnet-20240620`);
                            console.error(`      - claude-3-opus-20240229`);
                            console.error(`      - claude-3-sonnet-20240229`);
                            console.error(`      - claude-3-haiku-20240307`);
                        }
                    } catch (listError) {
                        console.error(`   ⚠️  Failed to list available models: ${listError.message}`);
                        console.error(`   💡 Manual fix: Update ANTHROPIC_MODEL in .env file`);
                    }
                } else if (error.response.status === 401) {
                    console.error(`   ⚠️  401 Error - Authentication failed:`);
                    console.error(`      1. Check that ANTHROPIC_API_KEY is correct`);
                    console.error(`      2. Verify your API key is active and not expired`);
                    console.error(`      3. Check API key permissions in Anthropic console`);
                } else if (error.response.status === 400) {
                    console.error(`   ⚠️  400 Error - Bad request:`);
                    console.error(`      1. Check that the payload format is correct`);
                    console.error(`      2. Verify model name format`);
                    console.error(`      3. Check request parameters`);
                }
            } else if (error.request) {
                console.error(`   ❌ No response received from Anthropic API`);
                console.error(`      URL: ${url}`);
                console.error(`      This might indicate a network issue or API endpoint problem`);
            } else {
                console.error(`   ❌ Request setup error: ${error.message}`);
            }
            
            throw error;
        }
    }

    // =====================================================
    // RESPONSE PARSING
    // =====================================================
    _parseAIResponse(aiResponse, record) {
        const productId = record.product_id || '';
        const dates = {
            end_of_sale_date: null,
            end_of_sw_maintenance_date: null,
            end_of_sw_vulnerability_maintenance_date: null,
            last_day_of_support_date: null,
            date_introduced: null,
            is_current_product: false,
            confidence: 0,
            reasoning: '',
            sources: [],
            match_type: 'no_match',
            match_found: null
        };
        
        try {
            // Extract JSON from response (AI might wrap it in markdown or text)
            let jsonText = aiResponse.trim();
            
            // Remove markdown code blocks if present
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            
            // Try to find JSON object in the response
            const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonText = jsonMatch[0];
            }
            
            const parsed = JSON.parse(jsonText);
            
            // Extract dates
            dates.end_of_sale_date = this._parseDate(parsed.end_of_sale_date);
            dates.end_of_sw_maintenance_date = this._parseDate(parsed.end_of_sw_maintenance_date);
            dates.end_of_sw_vulnerability_maintenance_date = this._parseDate(parsed.end_of_sw_vulnerability_maintenance_date);
            dates.last_day_of_support_date = this._parseDate(parsed.last_day_of_support_date);
            dates.date_introduced = this._parseDate(parsed.date_introduced);
            dates.is_current_product = parsed.is_current_product === true;
            dates.reasoning = parsed.reasoning || '';
            dates.sources = parsed.sources || [];
            
            // Extract match information
            dates.match_type = parsed.match_type || 'no_match';
            dates.match_found = parsed.match_found || null;
            
            // Set confidence based on match type
            if (dates.match_type === 'direct') {
                dates.confidence = 95;
            } else if (dates.match_type === 'with_extra_chars') {
                dates.confidence = 85;
            } else if (dates.match_type === 'partial') {
                // Partial match - use AI-provided confidence or default to 60%
                dates.confidence = parsed.confidence && parsed.confidence > 0 ? parsed.confidence : 60;
            } else if (parsed.confidence && parsed.confidence > 0) {
                // Use AI-provided confidence if match type not specified
                dates.confidence = parsed.confidence;
            } else {
                // Only set to 0 if truly no match - otherwise use a base confidence if dates found
                const hasDates = dates.end_of_sale_date || dates.last_day_of_support_date || 
                               dates.end_of_sw_maintenance_date || dates.end_of_sw_vulnerability_maintenance_date;
                dates.confidence = hasDates ? Math.max(parsed.confidence || 50, 50) : 0;
            }
            
            // Verify match_found actually contains the product ID
            if (dates.match_found && productId) {
                const matchFoundUpper = (dates.match_found || '').toUpperCase();
                const productIdUpper = productId.toUpperCase();
                if (!matchFoundUpper.includes(productIdUpper)) {
                    console.warn(`   ⚠️ match_found "${dates.match_found}" does not contain Product ID "${productId}"`);
                    console.warn(`   ⚠️ This may indicate the AI confused this product with a different one`);
                    // Adjust confidence downward if match doesn't actually match
                    if (dates.confidence > 0) {
                        dates.confidence = Math.max(0, dates.confidence - 20);
                    }
                }
            }
            
            // ACCURACY VALIDATION: Check for suspicious dates or potential errors
            if (dates.end_of_sale_date && dates.last_day_of_support_date) {
                const eosDate = new Date(dates.end_of_sale_date + 'T12:00:00'); // Use noon to avoid timezone issues
                const ldosDate = new Date(dates.last_day_of_support_date + 'T12:00:00');
                
                // Check if dates are suspiciously close together (less than 1 year apart)
                const daysDiff = (ldosDate - eosDate) / (1000 * 60 * 60 * 24);
                if (daysDiff < 365) {
                    console.warn(`   ⚠️ ACCURACY WARNING: End-of-Sale (${dates.end_of_sale_date}) and Last Date of Support (${dates.last_day_of_support_date}) are less than 1 year apart`);
                    console.warn(`   ⚠️ This is unusual - typical lifecycle is 3-5 years between EOS and LDOS`);
                    console.warn(`   ⚠️ This may indicate incorrect date extraction`);
                    // Reduce confidence if dates seem suspiciously close
                    if (dates.confidence > 0) {
                        dates.confidence = Math.max(0, dates.confidence - 15);
                    }
                }
                
                // Check if EOS is after LDOS (impossible)
                if (eosDate > ldosDate) {
                    console.error(`   ❌ DATE ERROR: End-of-Sale (${dates.end_of_sale_date}) is AFTER Last Date of Support (${dates.last_day_of_support_date})`);
                    console.error(`   ❌ This is impossible - dates may be swapped or incorrect`);
                    // If dates are reversed, this is a serious error
                    dates.confidence = Math.max(0, dates.confidence - 30);
                }
            }
            
            // NEW: Check if dates are 1 day off from common patterns (suspicious timezone conversion)
            // If AI returns dates that are exactly 1 day off, it might be a timezone conversion issue
            // Log a warning for manual verification
            if (dates.end_of_sale_date && dates.match_type === 'direct') {
                // For now, we'll just log - we can't automatically fix this without knowing the source
                // But we'll add it to the warning list if we detect the pattern
                console.log(`   ✅ Date validation: End-of-Sale date ${dates.end_of_sale_date} extracted`);
            }
            
            // Check reasoning for indications of uncertainty or estimation
            const reasoningLower = (dates.reasoning || '').toLowerCase();
            const uncertainIndicators = ['estimate', 'likely', 'probably', 'similar', 'pattern', 'typical', 'approximate', 'guess', 'infer', 'based on'];
            const hasUncertainty = uncertainIndicators.some(indicator => reasoningLower.includes(indicator));
            if (hasUncertainty && dates.confidence >= 85) {
                console.warn(`   ⚠️ ACCURACY WARNING: Reasoning contains uncertainty indicators but confidence is high (${dates.confidence}%)`);
                console.warn(`   ⚠️ Reasoning: "${dates.reasoning.substring(0, 200)}..."`);
                console.warn(`   ⚠️ Consider if dates are estimates rather than exact official dates`);
                // Reduce confidence if uncertainty indicators found
                dates.confidence = Math.max(0, dates.confidence - 15);
            }
            
            // Log parsed response
            console.log(`   ✅ Parsed AI response:`);
            console.log(`      EOS: ${dates.end_of_sale_date || 'null'}`);
            console.log(`      LDOS: ${dates.last_day_of_support_date || 'null'}`);
            console.log(`      SW Maint: ${dates.end_of_sw_maintenance_date || 'null'}`);
            console.log(`      SW Vuln: ${dates.end_of_sw_vulnerability_maintenance_date || 'null'}`);
            console.log(`      Match Type: ${dates.match_type}`);
            console.log(`      Match Found: ${dates.match_found || 'null'}`);
            console.log(`      Confidence: ${dates.confidence}% (based on match type)`);
            if (dates.sources && dates.sources.length > 0) {
                console.log(`      Sources: ${dates.sources.length} URL(s)`);
                dates.sources.slice(0, 3).forEach((src, idx) => {
                    const url = typeof src === 'string' ? src : src.url;
                    console.log(`         ${idx + 1}. ${url}`);
                });
            }
            
        } catch (error) {
            console.error('   ⚠️ Failed to parse AI response as JSON:', error.message);
            console.error('   Response text:', aiResponse.substring(0, 500));
            
            // Fallback: Try to extract dates using regex patterns
            dates = this._extractDatesFromText(aiResponse);
            dates.match_type = 'no_match';
            dates.match_found = null;
            dates.confidence = 0;
        }
        
        return dates;
    }

    _extractDatesFromText(text) {
        const dates = {
            end_of_sale_date: null,
            end_of_sw_maintenance_date: null,
            end_of_sw_vulnerability_maintenance_date: null,
            last_day_of_support_date: null
        };
        
        // Look for date patterns with context
        const patterns = [
            {
                regex: /end[\s-]*of[\s-]*sale[^:]*:?\s*(\d{4}[-\/]\d{2}[-\/]\d{2}|\w+\s+\d{1,2},?\s+\d{4})/i,
                field: 'end_of_sale_date'
            },
            {
                regex: /end[\s-]*of[\s-]*sw[\s-]*maintenance[^:]*:?\s*(\d{4}[-\/]\d{2}[-\/]\d{2}|\w+\s+\d{1,2},?\s+\d{4})/i,
                field: 'end_of_sw_maintenance_date'
            },
            {
                regex: /end[\s-]*of[\s-]*vulnerability[^:]*:?\s*(\d{4}[-\/]\d{2}[-\/]\d{2}|\w+\s+\d{1,2},?\s+\d{4})/i,
                field: 'end_of_sw_vulnerability_maintenance_date'
            },
            {
                regex: /last[\s-]*day[\s-]*of[\s-]*support[^:]*:?\s*(\d{4}[-\/]\d{2}[-\/]\d{2}|\w+\s+\d{1,2},?\s+\d{4})/i,
                field: 'last_day_of_support_date'
            }
        ];
        
        for (const { regex, field } of patterns) {
            const match = text.match(regex);
            if (match && match[1]) {
                dates[field] = this._parseDate(match[1]);
            }
        }
        
        return dates;
    }

    // =====================================================
    // DATE ESTIMATION LOGIC (Same as Google service)
    // =====================================================
    _applyDateEstimation(dates, onlyEstimateMissing = false) {
        console.log('\n   📊 Applying date estimation logic...');
        if (onlyEstimateMissing) {
            console.log(`      Mode: Only estimating MISSING dates (not overriding existing dates)`);
        }
        
        const estimatedDates = { ...dates };
        let baseEOS = null;
        
        // Step 1: Determine or calculate EOS
        if (dates.end_of_sale_date) {
            baseEOS = dates.end_of_sale_date;
            console.log(`      Using actual EOS as base: ${baseEOS}`);
            // If only estimating missing, don't override this date
            if (onlyEstimateMissing) {
                // Keep the existing date, don't estimate
            }
        } else if (dates.last_day_of_support_date && !onlyEstimateMissing) {
            // Only estimate EOS from LDOS if we're allowed to estimate (not in "only missing" mode)
            baseEOS = this._subtractYears(dates.last_day_of_support_date, 5);
            estimatedDates.eos_estimated = true;
            console.log(`      Estimated EOS from LDOS: ${baseEOS}`);
            estimatedDates.end_of_sale_date = baseEOS;
        } else if (dates.last_day_of_support_date && onlyEstimateMissing) {
            // In "only missing" mode, we don't estimate EOS from LDOS if EOS is missing
            console.log(`      Skipping EOS estimation (only estimating missing dates mode)`);
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
    // DATE VALIDATION
    // =====================================================
    _validateDateSpacing(dates) {
        if (dates.end_of_sale_date && dates.last_day_of_support_date) {
            const eosDate = new Date(dates.end_of_sale_date);
            const ldosDate = new Date(dates.last_day_of_support_date);
            
            const yearsDiff = (ldosDate - eosDate) / (1000 * 60 * 60 * 24 * 365.25);
            
            console.log(`      📏 Date spacing check: ${yearsDiff.toFixed(1)} years between EOS and LDOS`);
            
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
    // CONFIDENCE CALCULATION
    // =====================================================
    _calculateConfidence(dates, record) {
        // Use confidence from match type first (set in _parseAIResponse)
        // Match types: direct = 95%, with_extra_chars = 85%, no_match = 0%
        let confidence = dates.confidence || 0;
        
        // If confidence was set based on match type, use it
        if (dates.match_type === 'direct' && confidence === 95) {
            // Direct match = 95% (already set)
        } else if (dates.match_type === 'with_extra_chars' && confidence === 85) {
            // Match with extra chars = 85% (already set)
        } else if (dates.match_type === 'no_match') {
            confidence = 0;
        } else if (confidence === 0) {
            // Fallback: calculate based on dates found if no match type
            const dateFields = [
                'end_of_sale_date',
                'end_of_sw_maintenance_date',
                'end_of_sw_vulnerability_maintenance_date',
                'last_day_of_support_date'
            ];
            
            const datesFound = dateFields.filter(field => dates[field]).length;
            confidence = 50; // Base confidence for AI research
            confidence += datesFound * 10; // +10% per date found
        }
        
        // Reduce confidence if dates were estimated
        if (dates.eos_estimated) confidence -= 5;
        if (dates.sw_maintenance_estimated) confidence -= 5;
        if (dates.sw_vulnerability_estimated) confidence -= 5;
        if (dates.ldos_estimated) confidence -= 5;
        
        // Cap at 100%
        confidence = Math.min(Math.max(confidence, 0), 100);
        
        console.log(`      📊 Final confidence: ${confidence}% (Match Type: ${dates.match_type || 'unknown'})`);
        
        return confidence;
    }

    // =====================================================
    // CURRENT PRODUCT DETERMINATION
    // =====================================================
    _determineIfCurrent(dates, aiResponse) {
        // If AI explicitly said it's current
        if (dates.is_current_product === true) {
            return true;
        }
        
        // If no dates found and AI didn't find EOL info, likely current
        if (!this._hasAnyDates(dates)) {
            const responseLower = (aiResponse || '').toLowerCase();
            if (responseLower.includes('current') || 
                responseLower.includes('active') || 
                responseLower.includes('no eol') ||
                responseLower.includes('still supported')) {
                return true;
            }
        }
        
        return false;
    }

    // =====================================================
    // QUALITY VALIDATION CHECKS
    // =====================================================
    _performQualityChecks(dates, record) {
        const issues = [];
        const warnings = [];
        
        // Check 1: EOS should be before LDOS
        if (dates.end_of_sale_date && dates.last_day_of_support_date) {
            const eos = new Date(dates.end_of_sale_date);
            const ldos = new Date(dates.last_day_of_support_date);
            if (eos >= ldos) {
                issues.push(`End of Sale (${dates.end_of_sale_date}) is not before Last Day of Support (${dates.last_day_of_support_date})`);
            }
        }
        
        // Check 2: Dates shouldn't be too far in the past (unless product is EOL)
        const currentDate = new Date();
        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(currentDate.getFullYear() - 5);
        
        if (dates.end_of_sale_date) {
            const eos = new Date(dates.end_of_sale_date);
            if (eos < fiveYearsAgo && !dates.is_current_product) {
                warnings.push(`End of Sale date (${dates.end_of_sale_date}) is more than 5 years in the past`);
            }
        }
        
        // Check 3: Dates shouldn't be too far in the future
        const tenYearsFromNow = new Date();
        tenYearsFromNow.setFullYear(currentDate.getFullYear() + 10);
        
        if (dates.last_day_of_support_date) {
            const ldos = new Date(dates.last_day_of_support_date);
            if (ldos > tenYearsFromNow) {
                warnings.push(`Last Day of Support (${dates.last_day_of_support_date}) is more than 10 years in the future`);
            }
        }
        
        // Check 4: SW maintenance should be between EOS and LDOS
        if (dates.end_of_sale_date && dates.last_day_of_support_date && dates.end_of_sw_maintenance_date) {
            const eos = new Date(dates.end_of_sale_date);
            const ldos = new Date(dates.last_day_of_support_date);
            const swMaint = new Date(dates.end_of_sw_maintenance_date);
            
            if (swMaint < eos || swMaint > ldos) {
                issues.push(`SW Maintenance date (${dates.end_of_sw_maintenance_date}) is outside the range of EOS (${dates.end_of_sale_date}) to LDOS (${dates.last_day_of_support_date})`);
            }
        }
        
        // Check 5: Typical lifecycle span (EOS to LDOS should be ~5 years, allow 3-7 years)
        if (dates.end_of_sale_date && dates.last_day_of_support_date) {
            const eos = new Date(dates.end_of_sale_date);
            const ldos = new Date(dates.last_day_of_support_date);
            const yearsDiff = (ldos - eos) / (1000 * 60 * 60 * 24 * 365.25);
            
            if (yearsDiff < 1) {
                issues.push(`Lifecycle span is too short: ${yearsDiff.toFixed(1)} years (expected ~5 years)`);
            } else if (yearsDiff > 10) {
                warnings.push(`Lifecycle span is unusually long: ${yearsDiff.toFixed(1)} years (expected ~5 years)`);
            }
        }
        
        // Check 6: If product is marked as current, dates should be null or in the future
        if (dates.is_current_product) {
            if (dates.end_of_sale_date) {
                const eos = new Date(dates.end_of_sale_date);
                if (eos < currentDate) {
                    issues.push(`Product marked as current but End of Sale (${dates.end_of_sale_date}) is in the past`);
                }
            }
        }
        
        return {
            issues,
            warnings,
            passed: issues.length === 0,
            score: Math.max(0, 100 - (issues.length * 20) - (warnings.length * 5))
        };
    }

    // =====================================================
    // DATA SOURCES BUILDING
    // =====================================================
    _buildDataSources(record, aiResponse, parsedDates) {
        const sources = [];
        
        // Use sources from parsed AI response if available
        if (parsedDates && parsedDates.sources && Array.isArray(parsedDates.sources) && parsedDates.sources.length > 0) {
            parsedDates.sources.forEach(src => {
                const url = typeof src === 'string' ? src : src.url;
                const type = typeof src === 'object' && src.type ? src.type : 'vendor';
                
                // Determine if it's a manufacturer site
                const manufacturer = record.manufacturer || '';
                const manufacturerDomains = this._getManufacturerDomains(manufacturer);
                let isVendorSite = false;
                
                if (manufacturerDomains && url) {
                    const urlLower = url.toLowerCase();
                    for (const domain of manufacturerDomains) {
                        if (urlLower.includes(domain.toLowerCase())) {
                            isVendorSite = true;
                            break;
                        }
                    }
                }
                
                sources.push({
                    url: url,
                    type: isVendorSite ? 'vendor' : type || 'third_party'
                });
            });
        }
        
        // If no sources from AI response, check if AI mentioned manufacturer sites
        if (sources.length === 0) {
            const manufacturer = record.manufacturer || '';
            const manufacturerDomains = this._getManufacturerDomains(manufacturer);
            
            if (manufacturerDomains && aiResponse) {
                const responseLower = aiResponse.toLowerCase();
                for (const domain of manufacturerDomains) {
                    if (responseLower.includes(domain.toLowerCase())) {
                        sources.push({
                            url: `https://${domain}`,
                            type: 'vendor'
                        });
                        break;
                    }
                }
            }
        }
        
        // If still no sources, mark as third-party
        if (sources.length === 0) {
            sources.push({
                url: 'ai_research',
                type: 'third_party'
            });
        }
        
        return sources;
    }

    // =====================================================
    // HELPER METHODS
    // =====================================================
    _loadConfiguration() {
        // Lazy load configuration to ensure environment variables are available
        if (this.provider === null) {
            this.provider = process.env.AI_RESEARCH_PROVIDER || 'gemini';
            this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
            this.openaiApiKey = process.env.OPENAI_API_KEY;
            this.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
            
            console.log(`   📋 Loaded configuration:`);
            console.log(`      Provider: ${this.provider}`);
            console.log(`      GEMINI_API_KEY: ${this.apiKey ? this.apiKey.substring(0, 20) + '...' : 'NOT SET'}`);
            console.log(`      OPENAI_API_KEY: ${this.openaiApiKey ? 'SET' : 'NOT SET'}`);
            console.log(`      ANTHROPIC_API_KEY: ${this.anthropicApiKey ? 'SET' : 'NOT SET'}`);
        }
    }
    
    _hasValidCredentials() {
        // Ensure configuration is loaded
        this._loadConfiguration();
        
        switch (this.provider.toLowerCase()) {
            case 'openai':
                return !!this.openaiApiKey;
            case 'anthropic':
                return !!this.anthropicApiKey;
            case 'gemini':
            default:
                return !!this.apiKey;
        }
    }

    _getManufacturerDomains(manufacturer) {
        if (!manufacturer) return null;
        
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

    _parseDate(dateStr) {
        if (!dateStr || dateStr === 'null' || dateStr === null) return null;
        
        try {
            dateStr = dateStr.trim().replace(/\s+/g, ' ');
            
            // PRIORITY: If it's already in YYYY-MM-DD format, use it directly to avoid timezone issues
            const isoDatePattern = /^(\d{4})[-\/](\d{2})[-\/](\d{2})$/;
            const isoMatch = dateStr.match(isoDatePattern);
            if (isoMatch) {
                // Direct ISO format - return as-is without any Date object conversion to avoid timezone shifts
                const year = isoMatch[1];
                const month = isoMatch[2];
                const day = isoMatch[3];
                return `${year}-${month}-${day}`;
            }
            
            const patterns = [
                /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,  // Month DD, YYYY
                /(\d{1,2})\s+(\w+)\s+(\d{4})/,     // DD Month YYYY
                /(\d{4})[-\/](\d{2})[-\/](\d{2})/,  // YYYY-MM-DD (already handled above)
                /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/  // MM-DD-YYYY
            ];
            
            for (const pattern of patterns) {
                const match = dateStr.match(pattern);
                if (match) {
                    let date = null;
                    
                    if (pattern === patterns[0]) {
                        date = new Date(`${match[1]} ${match[2]}, ${match[3]}`);
                    } else if (pattern === patterns[1]) {
                        date = new Date(`${match[2]} ${match[1]}, ${match[3]}`);
                    } else if (pattern === patterns[2]) {
                        date = new Date(match[0]);
                    } else if (pattern === patterns[3]) {
                        date = new Date(`${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`);
                    }
                    
                    if (date && !isNaN(date.getTime())) {
                        const year = date.getFullYear();
                        if (year >= 1990 && year <= 2040) {
                            // CRITICAL: Use UTC methods to avoid timezone shifts that can cause day changes
                            // Extract year, month, day directly using UTC to preserve exact date
                            const utcYear = date.getUTCFullYear();
                            const utcMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
                            const utcDay = String(date.getUTCDate()).padStart(2, '0');
                            
                            // Double-check: If we parsed "December 29, 2016", make sure day is 29, not 28
                            // This helps catch timezone conversion issues
                            if (pattern === patterns[0]) {
                                // Month name first (e.g., "December 29, 2016")
                                const expectedDay = parseInt(match[2]);
                                const parsedDay = parseInt(utcDay);
                                if (expectedDay !== parsedDay) {
                                    console.warn(`   ⚠️ DATE PARSING WARNING: Expected day ${expectedDay} but parsed day ${parsedDay}. This may indicate a timezone conversion issue.`);
                                    console.warn(`   ⚠️ Original date string: "${dateStr}"`);
                                    console.warn(`   ⚠️ Using expected day ${expectedDay} from original string to avoid timezone shift.`);
                                    // Use the expected day from the original string to avoid timezone shift
                                    return `${utcYear}-${utcMonth}-${String(expectedDay).padStart(2, '0')}`;
                                }
                            }
                            
                            return `${utcYear}-${utcMonth}-${utcDay}`;
                        }
                    }
                }
            }
            
            // Last resort: try native Date parsing (use UTC methods to avoid timezone shifts)
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                const year = date.getUTCFullYear();
                if (year >= 1990 && year <= 2040) {
                    // Use UTC methods to preserve exact day
                    const utcMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
                    const utcDay = String(date.getUTCDate()).padStart(2, '0');
                    return `${year}-${utcMonth}-${utcDay}`;
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

    _hasAnyDates(dates) {
        return !!(dates.end_of_sale_date || 
                  dates.end_of_sw_maintenance_date || 
                  dates.end_of_sw_vulnerability_maintenance_date || 
                  dates.last_day_of_support_date);
    }

    async _performAPICallWithRetry(url, payload, method = 'POST', headers = {}) {
        let lastError;
        
        const defaultHeaders = {
            'Content-Type': 'application/json',
            ...headers
        };
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const config = {
                    method,
                    url,
                    headers: defaultHeaders,
                    timeout: 30000 // 30 second timeout for AI calls
                };
                
                if (method === 'POST' && payload) {
                    config.data = payload;
                } else if (method === 'GET' && payload) {
                    config.params = payload;
                }
                
                const response = await axios(config);
                return response.data;
            } catch (error) {
                lastError = error;
                
                // Log detailed error information for debugging
                if (error.response) {
                    console.error(`         API Error (attempt ${attempt}/${this.maxRetries}): Status ${error.response.status}`);
                    if (error.response.data) {
                        console.error(`         Response: ${JSON.stringify(error.response.data)}`);
                    }
                } else if (error.request) {
                    console.error(`         API Error (attempt ${attempt}/${this.maxRetries}): No response received`);
                } else {
                    console.error(`         API Error (attempt ${attempt}/${this.maxRetries}): ${error.message}`);
                }
                
                if (error.response && error.response.status === 429) {
                    // Rate limited - try to extract retry delay from API response
                    let waitTime = Math.pow(2, attempt) * 1000; // Default exponential backoff
                    
                    try {
                        // Try to extract RetryInfo from error response
                        const errorData = error.response.data;
                        if (errorData?.error?.details) {
                            const retryInfo = errorData.error.details.find(d => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
                            if (retryInfo?.retryDelay) {
                                // RetryDelay can be in seconds (string like "16s") or as an object
                                const delay = retryInfo.retryDelay;
                                if (typeof delay === 'string') {
                                    // Parse "16s" or "16.014679155s"
                                    const seconds = parseFloat(delay.replace('s', ''));
                                    waitTime = Math.ceil(seconds * 1000);
                                } else if (delay.seconds) {
                                    waitTime = delay.seconds * 1000;
                                }
                            }
                        }
                        
                        // Check if it's a quota exceeded error (daily limit hit)
                        const quotaFailure = errorData?.error?.details?.find(d => d['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure');
                        if (quotaFailure || errorData?.error?.message?.includes('quota')) {
                            console.error(`         ❌ QUOTA EXCEEDED: ${errorData.error?.message || 'Daily quota limit reached'}`);
                            console.error(`         💡 Solution: The free tier has a 50 requests/day limit for ${this.model || 'gemini-2.5-pro'}`);
                            console.error(`         💡 Suggestions:`);
                            console.error(`            - Use cached research results (enable "Use Cached Research")`);
                            console.error(`            - Switch to a different model (gemini-2.0-flash-exp, gemini-pro, or gemini-pro-vision)`);
                            console.error(`            - Wait until tomorrow for quota reset`);
                            console.error(`            - Upgrade to a paid plan for higher limits`);
                            
                            // If quota exceeded, don't retry - it won't help
                            throw new Error(`Gemini API quota exceeded. Free tier limit: 50 requests/day for ${this.model || 'gemini-2.5-pro'}. Please use cached results or wait for quota reset.`);
                        }
                    } catch (parseError) {
                        // If parsing fails, use default wait time
                    }
                    
                    if (attempt < this.maxRetries) {
                        console.log(`         ⏳ Rate limited, waiting ${Math.ceil(waitTime / 1000)}s (${waitTime}ms)...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    } else {
                        throw new Error(`Rate limit exceeded after ${this.maxRetries} attempts. Please wait before retrying or use cached research results.`);
                    }
                } else if (attempt < this.maxRetries) {
                    // Other error - wait briefly
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }
        
        throw lastError;
    }

    // =====================================================
    // RESULT CREATION METHODS
    // =====================================================
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
                if (source.type === 'vendor') {
                    result.vendor_site++;
                } else if (source.type === 'third_party' || source.url === 'ai_research') {
                    result.third_party++;
                }
            });
        }
        
        return result;
    }
}

// Export singleton instance
module.exports = new GenerativeAIResearchService();

