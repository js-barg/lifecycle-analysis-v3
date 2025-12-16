# Research Quality Verification Guide

This guide explains how to verify that the Generative AI research is actually running and how to perform quality checks on the results.

## Verification Methods

### 1. Console Logs

When Generative AI is used, you'll see specific log messages:

```
🤖 Starting generative AI research for [PRODUCT_ID]
   📝 Raw AI Response for [PRODUCT_ID]:
   ================================================================================
   [Raw AI response text here...]
   ================================================================================
   ✅ VERIFICATION: Using Generative AI method
   📋 Research Metadata: {...}
   📊 Quality Score: 85/100
```

**Key indicators:**
- Look for `🤖` emoji (robot) - indicates Generative AI
- Look for `📝 Raw AI Response` - shows the actual AI response
- Look for `✅ VERIFICATION: Using Generative AI method`
- Look for `📋 Research Metadata` - contains method verification

### 2. Database Verification

Check the `phase3_analysis` table for the `data_sources` or `research_metadata` field:

```sql
SELECT 
  product_id,
  data_sources,
  overall_confidence,
  lifecycle_confidence
FROM phase3_analysis
WHERE job_id = 'YOUR_JOB_ID'
ORDER BY product_id;
```

The `data_sources` field should contain metadata indicating the research method used.

### 3. API Response Verification

When calling the research endpoint, check the response for `research_metadata`:

```json
{
  "research_metadata": {
    "method": "generative",
    "method_name": "Generative AI",
    "provider": "gemini",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "raw_response": "...",
    "quality_checks": {
      "score": 85,
      "issues": [],
      "warnings": []
    }
  }
}
```

## Quality Checks

The system automatically performs quality checks on all research results:

### Automatic Quality Validations

1. **Date Order Validation**
   - End of Sale must be before Last Day of Support
   - Software maintenance dates should be between EOS and LDOS

2. **Date Reasonableness**
   - Dates shouldn't be more than 5 years in the past (unless product is EOL)
   - Dates shouldn't be more than 10 years in the future

3. **Lifecycle Span Validation**
   - EOS to LDOS should typically be ~5 years (allows 1-10 year range)
   - Flags unusually short (<1 year) or long (>10 years) spans

4. **Current Product Validation**
   - If product is marked as current, EOS should be null or in the future

5. **Confidence Adjustment**
   - Confidence is reduced by 10% for each quality issue
   - Confidence is reduced by 5% for each warning

### Quality Score Calculation

- **100 points** base score
- **-20 points** per critical issue
- **-5 points** per warning
- **Final score** = max(0, 100 - (issues × 20) - (warnings × 5))

### Quality Status Levels

- **Good**: Score ≥ 80, no critical issues
- **Fair**: Score 50-79, some warnings
- **Poor**: Score < 50, critical issues present

## Manual Quality Verification

### Step 1: Check Console Logs

Look for these log patterns:

**Generative AI (Correct):**
```
🤖 Starting generative AI research for WS-C3560X-24P-L
   📝 Raw AI Response for WS-C3560X-24P-L:
   ================================================================================
   {
     "end_of_sale_date": "2021-05-27",
     ...
   }
   ================================================================================
   ✅ VERIFICATION: Using Generative AI method
   📋 Research Metadata: {"method":"generative","provider":"gemini",...}
```

**Google Search (Incorrect if you selected Generative AI):**
```
🔍 Starting research for WS-C3560X-24P-L
   🔎 Searching: "WS-C3560X-24P-L" site:cisco.com "End-of-Life"
   ✅ VERIFICATION: Using Google Search method
```

### Step 2: Verify Dates Make Sense

Check for common issues:

1. **EOS after LDOS**: This is a critical error
   ```sql
   SELECT product_id, end_of_sale_date, last_day_of_support_date
   FROM phase3_analysis
   WHERE end_of_sale_date > last_day_of_support_date;
   ```

2. **Unrealistic dates**: Dates too far in past or future
   ```sql
   SELECT product_id, end_of_sale_date, last_day_of_support_date
   FROM phase3_analysis
   WHERE end_of_sale_date < '2010-01-01'
      OR last_day_of_support_date > '2035-01-01';
   ```

3. **Missing dates for EOL products**: Products marked as EOL but no dates
   ```sql
   SELECT product_id, lifecycle_status, end_of_sale_date, last_day_of_support_date
   FROM phase3_analysis
   WHERE lifecycle_status = 'End of Life'
     AND (end_of_sale_date IS NULL OR last_day_of_support_date IS NULL);
   ```

### Step 3: Compare with Known Good Data

If you have verified dates for some products, compare:

```sql
-- Compare research results with known good dates
SELECT 
  r.product_id,
  r.end_of_sale_date as research_eos,
  k.end_of_sale_date as known_eos,
  r.last_day_of_support_date as research_ldos,
  k.last_day_of_support_date as known_ldos,
  CASE 
    WHEN r.end_of_sale_date = k.end_of_sale_date 
     AND r.last_day_of_support_date = k.last_day_of_support_date 
    THEN 'MATCH'
    ELSE 'MISMATCH'
  END as status
FROM phase3_analysis r
JOIN known_good_dates k ON r.product_id = k.product_id;
```

## Debugging Incorrect Dates

### 1. Check Raw AI Response

The raw AI response is logged and stored in metadata. Look for:
- Did the AI understand the product correctly?
- Did the AI find the right dates?
- Was the JSON parsing successful?

### 2. Check Quality Checks

Review the quality check results:
```javascript
// In console logs, look for:
📊 Quality Score: 85/100
⚠️ Quality Issues: 2
   - Issue 1: ...
   - Issue 2: ...
```

### 3. Check Confidence Scores

Low confidence scores (< 50) indicate uncertain results:
```sql
SELECT product_id, overall_confidence, lifecycle_confidence
FROM phase3_analysis
WHERE overall_confidence < 50
ORDER BY overall_confidence;
```

### 4. Verify Method Used

Ensure Generative AI was actually used:
```sql
-- Check if research_metadata indicates generative AI
SELECT 
  product_id,
  data_sources->>'research_method' as method,
  overall_confidence
FROM phase3_analysis
WHERE job_id = 'YOUR_JOB_ID';
```

## Best Practices

1. **Always check logs** when research completes
2. **Review quality scores** for products with low confidence
3. **Verify method** using console logs or database metadata
4. **Compare results** between Google Search and Generative AI for critical products
5. **Flag products** with quality issues for manual review

## Troubleshooting

### Issue: Generative AI not being used

**Symptoms:**
- Logs show `🔍 Starting research` instead of `🤖 Starting generative AI research`
- No raw AI response in logs
- Research metadata shows `method: "google"`

**Solutions:**
1. Check that "Generative AI" radio button is selected in UI
2. Verify API credentials are set (GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY)
3. Check backend logs for credential errors
4. Verify `researchMethod` parameter is being passed correctly

### Issue: Incorrect dates returned

**Symptoms:**
- Dates don't match known good data
- Quality checks show issues
- Low confidence scores

**Solutions:**
1. Check raw AI response in logs
2. Verify product information (manufacturer, product ID) is correct
3. Review quality check issues
4. Consider using Google Search method for comparison
5. Manually verify dates from manufacturer website

### Issue: No dates found

**Symptoms:**
- All dates are null
- Quality score is 0
- Confidence is very low

**Solutions:**
1. Check if product is marked as "current" (dates may be intentionally null)
2. Verify product ID format matches manufacturer's format
3. Try different product ID variations
4. Check if manufacturer has published EOL information
5. Consider manual research for this product

