// backend/scripts/verify-research-quality.js
// Script to verify research quality and method used

const db = require('../src/database/dbConnection');
const ResearchQualityChecker = require('../src/utils/researchQualityChecker');

async function verifyResearchQuality(jobId) {
    try {
        console.log(`\n🔍 Verifying research quality for job: ${jobId}\n`);
        console.log('='.repeat(80));
        
        // Get all products for this job
        const query = `
            SELECT 
                product_id,
                manufacturer,
                end_of_sale_date,
                end_of_sw_maintenance_date,
                end_of_sw_vulnerability_maintenance_date,
                last_day_of_support_date,
                overall_confidence,
                lifecycle_confidence,
                data_sources,
                ai_enhanced,
                is_current_product,
                lifecycle_status
            FROM phase3_analysis
            WHERE job_id = $1
            ORDER BY product_id
        `;
        
        const result = await db.query(query, [jobId]);
        const products = result.rows;
        
        if (products.length === 0) {
            console.log('❌ No products found for this job ID');
            return;
        }
        
        console.log(`\n📊 Found ${products.length} products\n`);
        
        // Analyze each product
        let generativeAICount = 0;
        let googleSearchCount = 0;
        let unknownMethodCount = 0;
        let qualityIssuesCount = 0;
        let lowConfidenceCount = 0;
        
        const issues = [];
        
        for (const product of products) {
            // Parse data_sources to check method
            let dataSources = {};
            try {
                if (typeof product.data_sources === 'string') {
                    dataSources = JSON.parse(product.data_sources);
                } else {
                    dataSources = product.data_sources || {};
                }
            } catch (e) {
                // Ignore parse errors
            }
            
            // Check research method
            const method = dataSources.research_method || 'unknown';
            if (method === 'generative') {
                generativeAICount++;
            } else if (method === 'google') {
                googleSearchCount++;
            } else {
                unknownMethodCount++;
            }
            
            // Quality checks
            const qualityReport = ResearchQualityChecker.getQualityReport(product);
            
            if (!qualityReport.passed) {
                qualityIssuesCount++;
                issues.push({
                    product_id: product.product_id,
                    issues: qualityReport.issues,
                    warnings: qualityReport.warnings,
                    score: qualityReport.score
                });
            }
            
            if (product.overall_confidence < 50) {
                lowConfidenceCount++;
            }
            
            // Display product info
            console.log(`\n📦 ${product.product_id} (${product.manufacturer})`);
            console.log(`   Method: ${method === 'generative' ? '🤖 Generative AI' : method === 'google' ? '🔍 Google Search' : '❓ Unknown'}`);
            console.log(`   Confidence: ${product.overall_confidence}%`);
            console.log(`   Quality Score: ${qualityReport.score}/100 (${qualityReport.status})`);
            console.log(`   Dates:`);
            console.log(`      EOS: ${product.end_of_sale_date || 'null'}`);
            console.log(`      SW Maint: ${product.end_of_sw_maintenance_date || 'null'}`);
            console.log(`      SW Vuln: ${product.end_of_sw_vulnerability_maintenance_date || 'null'}`);
            console.log(`      LDOS: ${product.last_day_of_support_date || 'null'}`);
            
            if (qualityReport.issues.length > 0) {
                console.log(`   ⚠️  Issues:`);
                qualityReport.issues.forEach(issue => {
                    console.log(`      - ${issue}`);
                });
            }
            
            if (qualityReport.warnings.length > 0) {
                console.log(`   ⚠️  Warnings:`);
                qualityReport.warnings.forEach(warning => {
                    console.log(`      - ${warning}`);
                });
            }
        }
        
        // Summary
        console.log('\n' + '='.repeat(80));
        console.log('\n📊 SUMMARY\n');
        console.log(`Total Products: ${products.length}`);
        console.log(`🤖 Generative AI: ${generativeAICount}`);
        console.log(`🔍 Google Search: ${googleSearchCount}`);
        console.log(`❓ Unknown Method: ${unknownMethodCount}`);
        console.log(`⚠️  Products with Quality Issues: ${qualityIssuesCount}`);
        console.log(`📉 Low Confidence (<50%): ${lowConfidenceCount}`);
        
        if (issues.length > 0) {
            console.log('\n⚠️  PRODUCTS WITH QUALITY ISSUES:\n');
            issues.forEach(issue => {
                console.log(`   ${issue.product_id}:`);
                console.log(`      Score: ${issue.score}/100`);
                issue.issues.forEach(i => console.log(`      - ${i}`));
            });
        }
        
        console.log('\n' + '='.repeat(80));
        
    } catch (error) {
        console.error('❌ Error verifying research quality:', error);
        throw error;
    } finally {
        await db.end();
    }
}

// Get job ID from command line
const jobId = process.argv[2];

if (!jobId) {
    console.error('Usage: node verify-research-quality.js <job_id>');
    process.exit(1);
}

verifyResearchQuality(jobId)
    .then(() => {
        console.log('\n✅ Verification complete');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Verification failed:', error);
        process.exit(1);
    });

