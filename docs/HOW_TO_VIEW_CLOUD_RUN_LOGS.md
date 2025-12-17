# How to View Google Cloud Run Backend Console Logs

## Method 1: Google Cloud Console (Web UI) - Easiest

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com
   - Make sure you're in the correct project

2. **Navigate to Cloud Run**
   - In the left sidebar, go to **"Cloud Run"** (under "Serverless")
   - Or search for "Cloud Run" in the top search bar

3. **Select Your Service**
   - Click on **"lifecycle-analysis"** service

4. **View Logs**
   - Click on the **"LOGS"** tab at the top
   - You'll see real-time logs from your backend
   - Use the filter/search box to find specific log messages

## Method 2: Google Cloud CLI (Command Line)

If you have `gcloud` CLI installed:

```bash
# View recent logs
gcloud run services logs read lifecycle-analysis --region=us-central1 --limit=50

# Follow logs in real-time (like tail -f)
gcloud run services logs tail lifecycle-analysis --region=us-central1

# Filter logs by text
gcloud run services logs read lifecycle-analysis --region=us-central1 | grep "Cache toggle"
```

## Method 3: Cloud Logging (Advanced)

1. Go to **Cloud Logging** in Google Cloud Console
2. Use the query builder to filter:
   - Resource type: Cloud Run Revision
   - Service name: lifecycle-analysis
   - Add text filters for specific log messages

## Quick Access URL

Direct link to your service logs (replace PROJECT_ID):
```
https://console.cloud.google.com/run/detail/us-central1/lifecycle-analysis/logs?project=YOUR_PROJECT_ID
```

## What to Look For

When checking logs for the cache toggle issue, look for:
- `Cache toggle changed:` - When checkbox is clicked
- `🔵 CacheToggle component rendering` - When component renders
- Any errors related to Phase3Results component
- Build/deployment messages

