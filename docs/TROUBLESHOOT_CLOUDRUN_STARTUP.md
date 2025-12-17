# Troubleshooting Cloud Run Startup Failure

## Issue
Cloud Run service fails to start with error: "The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable"

## Check Logs First

The most important thing is to see what's actually happening in the logs:

```bash
# Get recent logs for the failed revision
gcloud run services logs read lifecycle-analysis \
  --region=us-central1 \
  --limit=100 \
  --format="table(timestamp,severity,textPayload)"
```

Look for:
- Syntax errors
- Database connection errors
- Missing environment variables
- Any uncaught exceptions

## Common Causes

### 1. Syntax Error in Code
If there's a JavaScript syntax error, the app won't start.

### 2. Database Connection Blocking Startup
If the database connection test is blocking or throwing an uncaught error.

### 3. Missing Environment Variables
If required env vars are missing and code doesn't handle it gracefully.

## Quick Fix: Rollback to Previous Revision

If the current revision is broken, rollback to the previous working revision:

```bash
# List revisions
gcloud run revisions list --service=lifecycle-analysis --region=us-central1

# Update service to use previous revision
gcloud run services update-traffic lifecycle-analysis \
  --region=us-central1 \
  --to-revisions=lifecycle-analysis-00008-848=100
```

(Replace `lifecycle-analysis-00008-848` with the previous working revision name)

## Fix and Redeploy

After fixing the code:

1. **From your local machine**, commit and push:
   ```bash
   git add backend/src/database/dbConnection.js
   git commit -m "Fix database connection: Make startup test non-blocking"
   git push
   ```

2. Wait for Cloud Build to complete

3. The new revision should start successfully

## Alternative: Update Secret Without Code Changes

If you just want to test the secret fix without code changes, you can:

1. Rollback to previous working revision (see above)
2. Update the secret on that revision:
   ```bash
   gcloud run services update lifecycle-analysis \
     --region=us-central1 \
     --update-secrets=DATABASE_URL=database-url:latest \
     --revision-suffix=v2
   ```

This creates a new revision with updated secrets but same code.

