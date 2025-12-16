// backend/src/utils/researchQualityChecker.js
// Utility for checking research quality and verifying which method was used

class ResearchQualityChecker {
    /**
     * Verify that generative AI was actually used
     */
    static verifyGenerativeAIUsed(researchResult) {
        const checks = {
            hasMetadata: !!researchResult.research_metadata,
            methodIsGenerative: researchResult.research_metadata?.method === 'generative',
            hasRawResponse: !!researchResult.research_metadata?.raw_response,
            hasProvider: !!researchResult.research_metadata?.provider,
            providerIsAI: ['gemini', 'openai', 'anthropic'].includes(researchResult.research_metadata?.provider),
            hasQualityChecks: !!researchResult.research_metadata?.quality_checks
        };
        
        const allPassed = Object.values(checks).every(v => v === true);
        
        return {
            verified: allPassed,
            checks,
            method: researchResult.research_metadata?.method || 'unknown',
            provider: researchResult.research_metadata?.provider || 'unknown'
        };
    }
    
    /**
     * Get quality report for a research result
     */
    static getQualityReport(researchResult) {
        const qualityChecks = researchResult.research_metadata?.quality_checks || researchResult.quality_checks;
        
        if (!qualityChecks) {
            return {
                score: 0,
                issues: ['No quality checks available'],
                warnings: [],
                status: 'unknown'
            };
        }
        
        let status = 'good';
        if (qualityChecks.score < 50) {
            status = 'poor';
        } else if (qualityChecks.score < 80) {
            status = 'fair';
        }
        
        return {
            score: qualityChecks.score,
            issues: qualityChecks.issues || [],
            warnings: qualityChecks.warnings || [],
            status,
            passed: qualityChecks.passed !== false
        };
    }
    
    /**
     * Compare results from different methods
     */
    static compareResults(googleResult, generativeResult) {
        const differences = [];
        
        const dateFields = [
            'end_of_sale_date',
            'end_of_sw_maintenance_date',
            'end_of_sw_vulnerability_maintenance_date',
            'last_day_of_support_date'
        ];
        
        dateFields.forEach(field => {
            const googleDate = googleResult[field];
            const generativeDate = generativeResult[field];
            
            if (googleDate !== generativeDate) {
                differences.push({
                    field,
                    google: googleDate,
                    generative: generativeDate
                });
            }
        });
        
        return {
            identical: differences.length === 0,
            differences,
            google_confidence: googleResult.overall_confidence || 0,
            generative_confidence: generativeResult.overall_confidence || 0
        };
    }
}

module.exports = ResearchQualityChecker;

