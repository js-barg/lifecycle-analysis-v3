/**
 * Test file for improved Cisco date extraction
 * Tests various Cisco date formats and extraction scenarios
 */

const { ImprovedCiscoDateExtractor } = require('./improvedCiscoDateExtraction');

// Test cases with actual Cisco EOL content samples
const testCases = [
  {
    name: 'Cisco Date Format (31-Jan-2015)',
    content: `
      Cisco announces the end-of-sale and end-of-life dates for the Cisco Nexus 2248TF-E.
      The last day to order the affected product(s) is 31-Jan-2015. 
      Customers with active service contracts will continue to receive support from the 
      Cisco Technical Assistance Center (TAC) as shown in Table 1 of the EoL bulletin.
      The Last Date of Support is 31-Jan-2020.
    `,
    productId: 'N2K-C2248TF-1GE',
    expected: {
      end_of_sale_date: '2015-01-31',
      last_day_of_support_date: '2020-01-31'
    }
  },
  {
    name: 'Table Format with Cisco Dates',
    content: `
      <table>
        <tr>
          <td>Product Part Number</td>
          <td>Product Description</td>
          <td>End-of-Sale Date</td>
          <td>End-of-Life Date</td>
        </tr>
        <tr>
          <td>WS-C3850-48P</td>
          <td>Catalyst 3850 48 Port PoE</td>
          <td>31-Oct-2021</td>
          <td>31-Oct-2026</td>
        </tr>
      </table>
    `,
    productId: 'WS-C3850-48P',
    expected: {
      end_of_sale_date: '2021-10-31',
      last_day_of_support_date: '2026-10-31'
    }
  },
  {
    name: 'Mixed Date Formats',
    content: `
      End-of-Sale and End-of-Life Announcement for the Cisco ISR4331/K9
      
      Milestone Dates:
      - End-of-Sale Date: November 7, 2023
      - End of Software Maintenance: 07-Nov-2024
      - Last Date of Support: October 31, 2028
    `,
    productId: 'ISR4331/K9',
    expected: {
      end_of_sale_date: '2023-11-07',
      end_of_sw_maintenance_date: '2024-11-07',
      last_day_of_support_date: '2028-10-31'
    }
  },
  {
    name: 'Product Variants (with/without suffix)',
    content: `
      The Cisco Aironet 3700 Series Access Points are being discontinued.
      
      AIR-CAP3702I-A-K9: End-of-Sale Date is April 30, 2019
      AIR-CAP3702I-A: Also affected by the same EOL announcement
      
      All variants will reach End-of-Support on September 30, 2024
    `,
    productId: 'AIR-CAP3702I-A-K9',
    expected: {
      end_of_sale_date: '2019-04-30',
      last_day_of_support_date: '2024-09-30'
    }
  },
  {
    name: 'Quarter Format',
    content: `
      Cisco Product Bulletin: N3K-C3048TP-1GE
      
      This product entered End-of-Sale in Q3FY15 (August 2, 2015)
      Support will continue through Q3FY20
    `,
    productId: 'N3K-C3048TP-1GE',
    expected: {
      end_of_sale_date: '2015-08-02'
    }
  },
  {
    name: 'Proximity-based Extraction',
    content: `
      Product List and EOL Dates
      
      The following products are affected:
      - WS-C2960X-24PS-L: This switch model
      - WS-C2960X-48PS-L: Another variant
      
      Important Dates:
      End-of-Sale: January 31, 2016
      End-of-Support: January 31, 2021
      
      These dates apply to all listed products above.
    `,
    productId: 'WS-C2960X-24PS-L',
    expected: {
      end_of_sale_date: '2016-01-31',
      last_day_of_support_date: '2021-01-31'
    }
  },
  {
    name: 'PDF-style Content',
    content: `
      EoS/EoL for the Cisco Catalyst 3750-X and 3560-X Series Switches
      
      PID                          EOS Date        EOL Date
      WS-C3750X-48P-S             01/31/2016      01/31/2021
      WS-C3750X-24P-S             01/31/2016      01/31/2021
    `,
    productId: 'WS-C3750X-48P-S',
    expected: {
      end_of_sale_date: '2016-01-31',
      last_day_of_support_date: '2021-01-31'
    }
  },
  {
    name: 'ASR Router with Milestones',
    content: `
      Cisco ASR1001-X End-of-Life Announcement
      
      The ASR1001-X aggregation services router reaches the following milestones:
      • End-of-Sale and End-of-Life Announcement Date: July 24, 2015
      • End-of-Sale Date: January 24, 2016  
      • End of SW Maintenance Releases Date: January 24, 2017
      • End of Routine Failure Analysis Date: January 24, 2017
      • End of New Service Attachment Date: January 24, 2017
      • End of Service Contract Renewal Date: April 24, 2020
      • Last Date of Support: January 31, 2021
    `,
    productId: 'ASR1001-X',
    expected: {
      end_of_sale_date: '2016-01-24',
      end_of_sw_maintenance_date: '2017-01-24',
      last_day_of_support_date: '2021-01-31'
    }
  }
];

// Run tests
async function runTests() {
  console.log('🔷 Testing Improved Cisco Date Extraction');
  console.log('═'.repeat(70));
  
  const extractor = new ImprovedCiscoDateExtractor();
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    console.log(`\n📋 Test: ${testCase.name}`);
    console.log(`   Product: ${testCase.productId}`);
    
    // Create mock search result
    const searchResults = {
      pages: [{
        url: 'https://cisco.com/test',
        title: 'Test Page',
        content: testCase.content,
        snippet: 'Test snippet'
      }],
      sources: {
        vendor_site: 1,
        third_party: 0
      }
    };
    
    const product = {
      product_id: testCase.productId,
      manufacturer: 'Cisco'
    };
    
    try {
      const results = extractor.extractLifecycleDates(searchResults, product);
      
      let testPassed = true;
      const failedFields = [];
      
      for (const [field, expectedValue] of Object.entries(testCase.expected)) {
        if (results[field] !== expectedValue) {
          testPassed = false;
          failedFields.push({
            field,
            expected: expectedValue,
            actual: results[field]
          });
        }
      }
      
      if (testPassed) {
        console.log('   ✅ PASSED');
        passed++;
        
        // Show what was extracted
        for (const [field, value] of Object.entries(testCase.expected)) {
          console.log(`      ${field}: ${results[field]}`);
        }
      } else {
        console.log('   ❌ FAILED');
        failed++;
        
        for (const failure of failedFields) {
          console.log(`      ${failure.field}:`);
          console.log(`         Expected: ${failure.expected}`);
          console.log(`         Actual: ${failure.actual || 'null'}`);
        }
      }
      
      // Show any additional dates found
      const additionalDates = {};
      const expectedFields = Object.keys(testCase.expected);
      const dateFields = [
        'end_of_sale_date',
        'last_day_of_support_date', 
        'end_of_sw_maintenance_date',
        'end_of_routine_failure_date',
        'end_of_new_service_date'
      ];
      
      for (const field of dateFields) {
        if (results[field] && !expectedFields.includes(field)) {
          additionalDates[field] = results[field];
        }
      }
      
      if (Object.keys(additionalDates).length > 0) {
        console.log('   📌 Additional dates found:');
        for (const [field, value] of Object.entries(additionalDates)) {
          console.log(`      ${field}: ${value}`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      failed++;
    }
  }
  
  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('═'.repeat(70));
  console.log(`Total Tests: ${testCases.length}`);
  console.log(`✅ Passed: ${passed} (${Math.round(passed/testCases.length*100)}%)`);
  console.log(`❌ Failed: ${failed} (${Math.round(failed/testCases.length*100)}%)`);
  
  if (passed === testCases.length) {
    console.log('\n🎉 All tests passed! The improved extractor is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Review the implementation for these cases.');
  }
}

// Test individual date parsing
function testDateParsing() {
  console.log('\n🔧 Testing Date Format Parsing');
  console.log('═'.repeat(70));
  
  const extractor = new ImprovedCiscoDateExtractor();
  
  const dateTests = [
    { input: '31-Jan-2015', expected: '2015-01-31' },
    { input: 'January 31, 2015', expected: '2015-01-31' },
    { input: '31-Oct-2021', expected: '2021-10-31' },
    { input: 'October 31, 2021', expected: '2021-10-31' },
    { input: '2021-10-31', expected: '2021-10-31' },
    { input: '10/31/2021', expected: '2021-10-31' },
    { input: '31.10.2021', expected: '2021-10-31' },
    { input: 'October 2021', expected: '2021-10-31' }, // Should use last day
    { input: 'Q3 2015', expected: '2015-09-30' }, // Q3 ends September 30
    { input: 'Q3FY15', expected: '2015-09-30' }
  ];
  
  for (const test of dateTests) {
    const dates = extractor.extractAllDatesFromText(test.input);
    const result = dates.length > 0 ? dates[0].date : null;
    
    if (result === test.expected) {
      console.log(`✅ "${test.input}" → ${result}`);
    } else {
      console.log(`❌ "${test.input}" → Expected: ${test.expected}, Got: ${result}`);
    }
  }
}

// Run all tests
console.log('🚀 Starting Cisco Date Extraction Tests\n');
runTests().then(() => {
  testDateParsing();
  console.log('\n✅ Testing Complete!');
}).catch(error => {
  console.error('Test execution failed:', error);
});