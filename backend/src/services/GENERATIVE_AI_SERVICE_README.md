# Generative AI Research Service

This service provides a generative AI-powered alternative to the Google Custom Search API for researching product lifecycle dates. It uses large language models (LLMs) to intelligently research and extract lifecycle dates based on manufacturer and product information.

## Features

- **Multiple AI Provider Support**: Works with Google Gemini, OpenAI GPT-4, or Anthropic Claude
- **Exact Interface Compatibility**: Matches the `googleAIResearchService.js` interface exactly
- **Intelligent Date Extraction**: Uses AI to understand context and extract accurate dates
- **Date Estimation**: Applies the same estimation logic as the Google service
- **Confidence Scoring**: Calculates confidence based on AI certainty and date completeness

## Configuration

**Important:** You can use Generative AI with **any of these providers** - you don't need Google! Choose the one that fits your needs.

### Environment Variables

#### Option 1: OpenAI GPT-4 (Recommended - No Google Required)
```bash
AI_RESEARCH_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4  # Optional, defaults to gpt-4
```
**Get API key:** https://platform.openai.com/api-keys

#### Option 2: Anthropic Claude (No Google Required)
```bash
AI_RESEARCH_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022  # Optional, defaults to claude-3-5-sonnet-20241022
```
**Get API key:** https://console.anthropic.com/settings/keys

#### Option 3: Google Gemini (Default - Different from Google Custom Search)
```bash
AI_RESEARCH_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-pro  # Optional, defaults to gemini-2.5-pro
```
**Get API key:** https://makersuite.google.com/app/apikey

**Note:** Google Gemini uses a **different API key** than Google Custom Search. If you already have `GOOGLE_API_KEY` for Custom Search, you'll need a separate key for Gemini.

## Usage

The service has the exact same interface as `googleAIResearchService.js`:

```javascript
const generativeAIResearchService = require('./generativeAIResearchService');

// Perform research
const result = await generativeAIResearchService.performResearch({
  product_id: 'WS-C3560X-24P-L',
  manufacturer: 'Cisco',
  description: 'Catalyst 3560-X Switch',
  product_category: 'Network Switch',
  product_type: 'Hardware'
});

// Result format (matches googleAIResearchService exactly):
// {
//   date_introduced: null,
//   end_of_sale_date: '2021-05-27',
//   end_of_sw_maintenance_date: '2023-05-27',
//   end_of_sw_vulnerability_maintenance_date: '2024-05-27',
//   last_day_of_support_date: '2026-05-27',
//   is_current_product: false,
//   lifecycle_confidence: 85,
//   overall_confidence: 85,
//   data_sources: {
//     vendor_site: 1,
//     third_party: 0,
//     manual_entry: 0
//   }
// }
```

## Integration

To use this service instead of the Google Custom Search service, simply replace the import in `phase3Controller.js`:

```javascript
// Old:
const googleAIResearchService = require('../services/googleAIResearchService');

// New:
const generativeAIResearchService = require('../services/generativeAIResearchService');

// Then use it the same way:
const result = await generativeAIResearchService.performResearch(product);
```

## How It Works

1. **Prompt Building**: Constructs a detailed prompt with product information asking the AI to research lifecycle dates
2. **AI Research**: Calls the configured AI provider (Gemini/OpenAI/Anthropic) with the research prompt
3. **Response Parsing**: Extracts JSON-formatted dates from the AI response
4. **Date Estimation**: Applies the same estimation logic as the Google service if dates are missing
5. **Validation**: Validates date spacing and calculates confidence scores
6. **Format Transformation**: Returns results in the exact same format as `googleAIResearchService`

## Advantages Over Google Custom Search

- **Context Understanding**: AI can understand product context and make intelligent inferences
- **No Web Scraping**: Doesn't require fetching and parsing HTML pages
- **Better Date Extraction**: AI can extract dates from various formats and contexts
- **Current Product Detection**: Better at determining if a product is still current/active
- **Flexible**: Can be easily switched between different AI providers

## Cost Considerations

- **Google Gemini**: Free tier available, then pay-per-use
- **OpenAI GPT-4**: Pay-per-token, more expensive but very accurate
- **Anthropic Claude**: Pay-per-token, competitive pricing

## Error Handling

The service includes comprehensive error handling:
- Falls back to default empty result on errors
- Retries API calls with exponential backoff
- Handles rate limiting gracefully
- Logs detailed error information for debugging

## Testing

To test the service, you can create a simple test script:

```javascript
const generativeAIResearchService = require('./generativeAIResearchService');

async function test() {
  const result = await generativeAIResearchService.performResearch({
    product_id: 'MR33-HW',
    manufacturer: 'Meraki',
    description: 'Meraki MR33 Access Point',
    product_category: 'Wireless Access Point'
  });
  
  console.log('Result:', JSON.stringify(result, null, 2));
}

test();
```

