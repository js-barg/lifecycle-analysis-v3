/**
 * URGENT FIX: Cisco Date Extraction
 * Add these patterns to your googleAIResearchService.js
 */

// ============================================================================
// THE PROBLEM: Your current patterns are NOT matching Cisco's date format
// Cisco uses: 31-Jan-2015 or January 31, 2015
// ============================================================================

// STEP 1: Fix getComprehensiveDatePatterns method (Line ~340)
// REPLACE your entire end_of_sale_date array with this:

end_of_sale_date: [
  // CISCO SPECIFIC - THESE ARE CRITICAL!
  /End-of-Sale Date[:\s]*(\d{1,2}-[A-Z][a-z]{2}-\d{4})/i,
  /End of Sale Date[:\s]*(\d{1,2}-[A-Z][a-z]{2}-\d{4})/i,
  /EoS Date[:\s]*(\d{1,2}-[A-Z][a-z]{2}-\d{4})/i,
  /End-of-Sale[:\s]*(\d{1,2}-[A-Z][a-z]{2}-\d{4})/i,
  
  // Handle variations in spacing and punctuation
  /End[\s-]*of[\s-]*Sale[\s:]*Date[\s:]*(\d{1,2}-[A-Z][a-z]{2}-\d{4})/i,
  /End[\s-]*of[\s-]*Sale[\s:]*(\d{1,2}-[A-Z][a-z]{2}-\d{4})/i,
  
  // Standard formats (keep these)
  /End[\s-]?of[\s-]?Sale[\s:]+([A-Z][a-z]+ \d{1,2},? \d{4})/i,
  /End[\s-]?of[\s-]?Sale[\s:]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i,
  /End[\s-]?of[\s-]?Sale[\s:]+(\d{4}-\d{2}-\d{2})/i,
  
  // Table formats for Cisco
  /EoS[\s\|\t:]*(\d{1,2}-[A-Z][a-z]{2}-\d{4})/i,
  /End.*Sale[\s\|\t:]*(\d{1,2}-[A-Z][a-z]{2}-\d{4})/i,
  
  // Product context - FIX THE TEMPLATE STRING
  new RegExp(`${productId}[\\s\\S]{0,200}End.*Sale[:\\s]+(\d{1,2}-[A-Z][a-z]{2}-\d{4})`, 'i')
],

// REPLACE your last_day_of_support_date array with this:

last_day_of_support_date: [
  // CISCO SPECIFIC - CRITICAL!
  /Last Date of Support[:\s]*(\d{1,2}-[A-Z][a-z]{2}-\d{4})/i,
  /End-of-Service Life Date[:\s]*(\d{1,2}-[A-Z][a-z]{2}-\d{4})/i,
  /End of Service Life[:\s]*(\d{1,2}-[A-Z][a-z]{2}-\d{4})/i,
  /LDoS[:\s]*(\d{1,2}-[A-Z][a-z]{2}-\d{4})/i,
  /Last Day of Support[:\s]*(\d{1,2}-[A-Z][a-z]{2}-\d{4})/i,
  
  // Handle variations
  /Last[\s-]*Date[\s-]*of[\s-]*Support[\s:]*(\d{1,2}-[A-Z][a-z]{2}-\d{4})/i,
  
  // Standard formats (keep these)
  /Last[\s-]?Date?[\s-]?of[\s-]?Support[\s:]+([A-Z][a-z]+ \d{1,2},? \d{4})/i,
  /Last[\s-]?Date?[\s-]?of[\s-]?Support[\s:]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i,
  /Last[\s-]?Date?[\s-]?of[\s-]?Support[\s:]+(\d{4}-\d{2}-\d{2})/i,
  
  // Table formats
  /LDoS[\s\|\t:]*(\d{1,2}-[A-Z][a-z]{2}-\d{4})/i,
  /Last.*Support[\s\|\t:]*(\d{1,2}-[A-Z][a-z]{2}-\d{4})/i
],

// ============================================================================
// STEP 2: FIX normalizeDate method (Line ~478)
// Make sure it handles Cisco format FIRST
// ============================================================================

normalizeDate(dateStr) {
  if (!dateStr) return null;
  
  // Remove any weird formatting issues
  dateStr = dateStr.trim().replace(/\s+/g, ' ');
  
  // FIX for malformed dates like "2020-03-AUG"
  if (dateStr.match(/^\d{4}-\d{2}-[A-Z]{3}/i)) {
    // This is backwards, fix it
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      dateStr = `${parts[1]}-${parts[2]}-${parts[0]}`; // Convert to DD-Mon-YYYY
    }
  }
  
  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // CRITICAL: Handle Cisco's DD-Mon-YYYY format (e.g., "31-Jan-2015")
  const ciscoPattern = /^(\d{1,2})-([A-Z][a-z]{2,3})-(\d{4})$/i;
  const ciscoMatch = dateStr.match(ciscoPattern);
  if (ciscoMatch) {
    const [, day, monthStr, year] = ciscoMatch;
    const monthMap = {
      'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
      'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
      'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    };
    const month = monthMap[monthStr.toLowerCase().substring(0, 3)];
    if (month) {
      return `${year}-${month}-${day.padStart(2, '0')}`;
    }
  }
  
  // Continue with other formats...
  // (rest of your existing normalizeDate code)
}

// ============================================================================
// STEP 3: INCREASE CONTEXT RADIUS (Line ~430)
// ============================================================================

// Change from:
const contextRadius = 500;

// To:
const contextRadius = 1500; // Cisco tables can be large

// ============================================================================
// STEP 4: ADD DEBUG LOGGING (temporary)
// In extractDatesNearProduct method, add logging to see what's happening
// ============================================================================

extractDatesNearProduct(content, productId, patterns) {
  const dates = {};
  const contextRadius = 1500; // INCREASED
  
  // Find all product mentions
  const productPattern = new RegExp(productId.replace(/[-\/]/g, '[-\\/]?'), 'gi');
  const matches = [...content.matchAll(productPattern)];
  
  // ADD DEBUG LOGGING
  if (productId.includes('C3850') || productId.includes('C2248')) {
    console.log(`\n🔍 DEBUG: Looking for ${productId} dates`);
    
    // Look for any Cisco date pattern in the entire content
    const ciscoDatePattern = /(\d{1,2}-[A-Z][a-z]{2}-\d{4})/gi;
    const allCiscoDates = content.match(ciscoDatePattern);
    if (allCiscoDates) {
      console.log(`   Found ${allCiscoDates.length} Cisco dates in content:`);
      allCiscoDates.slice(0, 5).forEach(d => console.log(`     - ${d}`));
    }
    
    // Look for "End-of-Sale" mentions
    const eosPattern = /End[\s-]*of[\s-]*Sale/gi;
    const eosMatches = content.match(eosPattern);
    if (eosMatches) {
      console.log(`   Found ${eosMatches.length} "End-of-Sale" mentions`);
    }
  }
  
  // Continue with existing extraction logic...
  // (rest of your existing code)
}

// ============================================================================
// STEP 5: MANUAL PATTERN TEST
// Add this temporary test function to verify patterns work
// ============================================================================

function testCiscoPatterns() {
  const testTexts = [
    "End-of-Sale Date: 31-Jan-2015",
    "End of Sale Date: 31-Oct-2021",
    "Last Date of Support: 30-Apr-2020",
    "EoS Date: 15-Mar-2019",
    "End-of-Sale Date:31-Jan-2015", // No space
    "End-of-Sale Date : 31-Jan-2015", // Extra space
  ];
  
  const patterns = [
    /End-of-Sale Date[:\s]*(\d{1,2}-[A-Z][a-z]{2}-\d{4})/i,
    /End of Sale Date[:\s]*(\d{1,2}-[A-Z][a-z]{2}-\d{4})/i,
    /Last Date of Support[:\s]*(\d{1,2}-[A-Z][a-z]{2}-\d{4})/i,
  ];
  
  console.log("Testing Cisco patterns:");
  testTexts.forEach(text => {
    let matched = false;
    patterns.forEach(pattern => {
      const match = text.match(pattern);
      if (match) {
        console.log(`✅ "${text}" matched, extracted: ${match[1]}`);
        matched = true;
      }
    });
    if (!matched) {
      console.log(`❌ "${text}" - NO MATCH`);
    }
  });
}

// Run the test
// testCiscoPatterns();

// ============================================================================
// IMMEDIATE ACTION REQUIRED:
// 
// 1. Update your date patterns with the Cisco-specific ones above
// 2. Fix the normalizeDate method to handle DD-Mon-YYYY
// 3. Increase context radius to 1500
// 4. Test with N2K-C2248TF-1GE first
// 
// The main issue is your patterns don't match "31-Jan-2015" format!
// ============================================================================