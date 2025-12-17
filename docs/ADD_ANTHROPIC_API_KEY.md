# Adding Anthropic API Key for Claude AI

Your Anthropic API key has been configured. Add it to your `.env` file:

## Step 1: Open your `.env` file

Navigate to: `backend\.env`

## Step 2: Add the Anthropic API Key

Add this line to your `.env` file:

```
ANTHROPIC_API_KEY=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
```

## Step 3: Verify Setup

Your `.env` file should now have:
- `GEMINI_API_KEY` (for Gemini AI option)
- `ANTHROPIC_API_KEY` (for Claude AI option) ✅ NEW
- `AI_RESEARCH_PROVIDER` (optional - defaults to gemini if not set)

## Step 4: Restart Server

After adding the API key, restart your backend server for the changes to take effect.

## Usage

In Phase3Results.jsx, you can now choose:
1. **Google Search** - Uses Google Custom Search API
2. **Gemini AI** - Uses Google Gemini AI
3. **Claude AI** - Uses Anthropic Claude AI ✅ NEW

The system will automatically use the correct API key based on your selection.

