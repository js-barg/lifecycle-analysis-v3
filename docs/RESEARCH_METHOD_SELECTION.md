# Research Method Selection Feature

## Overview

Users can now choose between **Google Search** and **Generative AI** research methods directly from the Phase 3 interface. This gives you flexibility to use the method that works best for your needs.

## UI Changes

In the Phase 3 Results component, you'll now see a **Research Method** selector with two radio button options:

- **Google Search**: Uses Google Custom Search API to find product lifecycle information from web pages
- **Generative AI**: Uses AI (Gemini/OpenAI/Claude) to intelligently research product lifecycle dates

The selector is located in the AI Research Control Panel, right before the "Use Cached Research" checkbox.

## How It Works

1. **Select Research Method**: Choose either "Google Search" or "Generative AI" before starting research
2. **Start Research**: Click "Start AI Research" as usual
3. **Backend Processing**: The system uses your selected method for all products in the batch
4. **Results**: Results are displayed in the same format regardless of which method was used

## Configuration

### For Google Search Method
```bash
GOOGLE_API_KEY=your_google_api_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
```

### For Generative AI Method
Choose one of the following:

**Google Gemini (Recommended - Free tier available):**
```bash
AI_RESEARCH_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key
```

**OpenAI GPT-4:**
```bash
AI_RESEARCH_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key
```

**Anthropic Claude:**
```bash
AI_RESEARCH_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## When to Use Each Method

### Google Search
- ✅ When you need to find official manufacturer documentation
- ✅ When you want to verify information from multiple sources
- ✅ When you have Google Custom Search API quota available
- ✅ Good for products with well-documented EOL pages

### Generative AI
- ✅ When you need intelligent context understanding
- ✅ When products have limited online documentation
- ✅ When you want faster research (no web scraping)
- ✅ When you need better date extraction from various formats
- ✅ Good for determining if products are still current/active

## Technical Details

### Frontend Changes
- Added `researchMethod` state variable (defaults to 'google')
- Added radio button UI control in Phase3Results component
- Passes `researchMethod` parameter in API request

### Backend Changes
- Updated `runAIResearch` to accept `researchMethod` parameter
- Updated `researchwithAI` to use appropriate service based on method
- Both services maintain identical output format for compatibility

## Code Changes Summary

### Frontend (`src/components/Phase3Results.jsx`)
1. Added `researchMethod` state: `const [researchMethod, setResearchMethod] = useState('google');`
2. Added radio button UI for method selection
3. Updated API call to include `researchMethod` in request body

### Backend (`backend/src/controllers/phase3Controller.js`)
1. Added import for `generativeAIResearchService`
2. Updated `runAIResearch` to accept `researchMethod` parameter
3. Updated `researchwithAI` to select and use appropriate service
4. Added credential validation for both methods

## Testing

1. **Test Google Search Method:**
   - Select "Google Search" radio button
   - Start research
   - Verify logs show "Google Search" method
   - Check that results are returned

2. **Test Generative AI Method:**
   - Select "Generative AI" radio button
   - Start research
   - Verify logs show "Generative AI" method
   - Check that results are returned

3. **Test Method Switching:**
   - Start with one method
   - Stop research
   - Switch to other method
   - Start research again
   - Verify correct method is used

## Error Handling

- If credentials are missing for selected method, an error is thrown with clear message
- The UI disables method selection during active research
- Both methods use the same error handling and fallback logic

## Benefits

1. **User Choice**: Users can select the method that works best for their use case
2. **Flexibility**: Easy to switch between methods without code changes
3. **Cost Optimization**: Choose the method that fits your budget
4. **Performance**: Select the method that performs best for your products
5. **Compatibility**: Both methods return identical output format

## Future Enhancements

Potential future improvements:
- Hybrid mode (try AI first, fall back to Google)
- Method-specific caching
- Performance metrics comparison
- Auto-selection based on product type
- Batch method selection per product

