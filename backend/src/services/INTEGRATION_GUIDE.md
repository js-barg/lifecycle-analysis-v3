# Integration Guide: Switching to Generative AI Research Service

This guide explains how to switch from the Google Custom Search service to the new Generative AI Research Service.

## Quick Switch

To use the generative AI service instead of Google Custom Search, update `backend/src/controllers/phase3Controller.js`:

### Step 1: Update the Import

**Find this line (around line 6):**
```javascript
const googleAIResearchService = require('../services/googleAIResearchService');
```

**Replace with:**
```javascript
const generativeAIResearchService = require('../services/generativeAIResearchService');
```

### Step 2: Update the Service Call

**Find this line (around line 623):**
```javascript
const researchResult = await googleAIResearchService.performResearch({
```

**Replace with:**
```javascript
const researchResult = await generativeAIResearchService.performResearch({
```

That's it! The interface is identical, so no other changes are needed.

## Configuration

### Option 1: Google Gemini (Recommended - Free tier available)

Add to your `.env` file or environment variables:
```bash
AI_RESEARCH_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
```

Get your API key from: https://makersuite.google.com/app/apikey

### Option 2: OpenAI GPT-4

```bash
AI_RESEARCH_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here
```

### Option 3: Anthropic Claude

```bash
AI_RESEARCH_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

## Testing the Switch

1. Set up your API key in environment variables
2. Make the code changes above
3. Run a Phase 3 research job
4. Check the logs - you should see `🤖 Starting generative AI research` instead of `🔍 Starting research`

## Rollback

If you need to switch back to Google Custom Search:
1. Revert the import to `googleAIResearchService`
2. Revert the service call
3. Ensure `GOOGLE_API_KEY` and `GOOGLE_CSE_CX` are set

## Hybrid Approach (Optional)

You could also implement a hybrid approach that tries generative AI first, then falls back to Google Search:

```javascript
let researchResult;
try {
  researchResult = await generativeAIResearchService.performResearch({
    product_id: product.product_id,
    manufacturer: product.manufacturer,
    description: product.description,
    product_category: product.product_category,
    product_type: product.product_type
  });
  
  // If no dates found, try Google Search as fallback
  if (!researchResult.end_of_sale_date && !researchResult.last_day_of_support_date) {
    console.log('No dates from AI, trying Google Search...');
    researchResult = await googleAIResearchService.performResearch({
      product_id: product.product_id,
      manufacturer: product.manufacturer,
      description: product.description,
      product_category: product.product_category,
      product_type: product.product_type
    });
  }
} catch (error) {
  // Fallback to Google Search on error
  console.log('AI research failed, falling back to Google Search...');
  researchResult = await googleAIResearchService.performResearch({
    product_id: product.product_id,
    manufacturer: product.manufacturer,
    description: product.description,
    product_category: product.product_category,
    product_type: product.product_type
  });
}
```

## Benefits of Generative AI Service

1. **Better Context Understanding**: AI can understand product context and make intelligent inferences
2. **No Web Scraping**: Doesn't require fetching and parsing HTML pages
3. **Better Date Extraction**: AI can extract dates from various formats and contexts
4. **Current Product Detection**: Better at determining if a product is still current/active
5. **Flexible**: Can be easily switched between different AI providers

## Cost Comparison

- **Google Custom Search**: Free tier: 100 queries/day, then $5 per 1,000 queries
- **Google Gemini**: Free tier available, then pay-per-use (very affordable)
- **OpenAI GPT-4**: ~$0.03 per product research (varies by token usage)
- **Anthropic Claude**: ~$0.015 per product research (varies by token usage)

## Support

If you encounter issues:
1. Check that your API key is correctly set
2. Verify the provider name matches exactly (case-sensitive)
3. Check the logs for detailed error messages
4. Ensure your API key has sufficient credits/quota

