# Generative AI Setup Guide

## Quick Answer

**No, you don't need Google for Generative AI research!** You have **three options**:

1. **Google Gemini** (requires Google API key - but different from Google Custom Search)
2. **OpenAI GPT-4** (requires OpenAI API key - no Google needed)
3. **Anthropic Claude** (requires Anthropic API key - no Google needed)

## Important: Google Gemini vs Google Custom Search

These are **TWO DIFFERENT APIs** from Google:

| Service | Purpose | API Key Type | What You Need |
|---------|---------|--------------|---------------|
| **Google Custom Search** | Web search (finds web pages) | `GOOGLE_API_KEY` or `GOOGLE_CSE_API_KEY` | Custom Search Engine ID + API Key |
| **Google Gemini** | AI/LLM (generates responses) | `GEMINI_API_KEY` | Just API Key (no Engine ID needed) |

**You can use Generative AI with OpenAI or Anthropic and skip Google entirely!**

## Setup Options

### Option 1: OpenAI GPT-4 (Recommended - No Google Required)

**Pros:**
- ✅ No Google setup needed
- ✅ Very accurate results
- ✅ Well-documented API

**Cons:**
- ⚠️ More expensive (~$0.03 per product research)
- ⚠️ Requires OpenAI account with billing

**Setup:**
1. Sign up at https://platform.openai.com/
2. Get API key from https://platform.openai.com/api-keys
3. Add to your `.env` file:
   ```bash
   AI_RESEARCH_PROVIDER=openai
   OPENAI_API_KEY=sk-your-api-key-here
   ```

**Cost:** ~$0.03 per product research (varies by token usage)

---

### Option 2: Anthropic Claude (No Google Required)

**Pros:**
- ✅ No Google setup needed
- ✅ Competitive pricing
- ✅ Excellent for technical research

**Cons:**
- ⚠️ Requires Anthropic account
- ⚠️ Newer service (less widely used)

**Setup:**
1. Sign up at https://console.anthropic.com/
2. Get API key from https://console.anthropic.com/settings/keys
3. Add to your `.env` file:
   ```bash
   AI_RESEARCH_PROVIDER=anthropic
   ANTHROPIC_API_KEY=sk-ant-your-api-key-here
   ```

**Cost:** ~$0.015 per product research (varies by token usage)

---

### Option 3: Google Gemini (Requires Google API Key)

**Pros:**
- ✅ Free tier available
- ✅ Very affordable after free tier
- ✅ Good performance

**Cons:**
- ⚠️ Requires Google account
- ⚠️ Different API key than Google Custom Search

**Setup:**
1. Go to https://makersuite.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the API key
5. Add to your `.env` file:
   ```bash
   AI_RESEARCH_PROVIDER=gemini
   GEMINI_API_KEY=your-gemini-api-key-here
   ```

**Cost:** 
- Free tier: Generous free quota
- After free tier: Very affordable pay-per-use

**Note:** This is a **different API key** than your Google Custom Search API key!

---

## Current Setup Status

### For Google Search Method:
You already have:
- `GOOGLE_API_KEY` or `GOOGLE_CSE_API_KEY` ✅
- `GOOGLE_SEARCH_ENGINE_ID` or `GOOGLE_CSE_CX` ✅

### For Generative AI Method:
You need **ONE** of these (choose any):

**Option A - OpenAI (Easiest, No Google):**
```bash
AI_RESEARCH_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
```

**Option B - Anthropic (No Google):**
```bash
AI_RESEARCH_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Option C - Google Gemini (Different from Custom Search):**
```bash
AI_RESEARCH_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-key-here
```

## Recommendation

**If you want to avoid Google setup entirely:**
- Use **OpenAI GPT-4** (most popular, well-supported)
- Or use **Anthropic Claude** (cheaper, excellent quality)

**If you want free/low-cost option:**
- Use **Google Gemini** (free tier available, very affordable)

## Environment Variables Summary

### For Google Search (You Already Have):
```bash
GOOGLE_API_KEY=your-custom-search-key
GOOGLE_SEARCH_ENGINE_ID=your-search-engine-id
```

### For Generative AI (Choose ONE):
```bash
# Option 1: OpenAI
AI_RESEARCH_PROVIDER=openai
OPENAI_API_KEY=sk-your-key

# Option 2: Anthropic
AI_RESEARCH_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-key

# Option 3: Google Gemini (different from Custom Search!)
AI_RESEARCH_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-key
```

## Testing Your Setup

After setting up your chosen provider, test it:

1. Start your backend server
2. Select "Generative AI" in the Phase 3 UI
3. Start research on a test product
4. Check console logs for:
   ```
   🤖 Starting generative AI research for [PRODUCT]
   ✅ VERIFICATION: Using Generative AI method
   📋 Research Metadata: {"provider":"openai",...}  # or "gemini" or "anthropic"
   ```

## Troubleshooting

### Error: "AI API credentials not configured"
- Make sure you set `AI_RESEARCH_PROVIDER` environment variable
- Make sure you set the corresponding API key for your provider
- Restart your backend server after adding environment variables

### Error: "Invalid API key"
- Verify your API key is correct
- Check that billing is enabled (for OpenAI/Anthropic)
- For Gemini, ensure you're using the Gemini API key (not Custom Search key)

### Want to switch providers?
Just change the `AI_RESEARCH_PROVIDER` and corresponding API key in your `.env` file and restart.

## Cost Comparison

| Provider | Free Tier | Cost per Product Research |
|----------|-----------|---------------------------|
| Google Gemini | ✅ Yes (generous) | Very low after free tier |
| OpenAI GPT-4 | ❌ No | ~$0.03 |
| Anthropic Claude | ❌ No | ~$0.015 |

## Summary

- **You DON'T need Google for Generative AI** - you can use OpenAI or Anthropic
- **Google Gemini uses a different API** than Google Custom Search (different key)
- **Choose the provider that fits your budget and needs**
- **All three providers work the same way** - just set the environment variables

