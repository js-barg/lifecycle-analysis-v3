# Verify and Fix DATABASE_URL Secret

## Problem
The secret is set, but the code is still connecting to localhost. This means either:
1. The secret isn't actually being injected
2. The latest code with debugging hasn't been deployed

## Solution

### Step 1: Verify Secret is Actually Set

**In Cloud Shell:**
```bash
# Check if DATABASE_URL is in the service configuration
gcloud run services describe lifecycle-analysis \
  --region=us-central1 \
  --format="value(spec.template.spec.containers[0].env)" | grep -i DATABASE_URL
```

If this returns nothing, the secret isn't set.

### Step 2: Check Secret Permissions

The Cloud Run service account needs permission to access the secret:

```bash
# Get project number
PROJECT_NUMBER=$(gcloud projects describe lifecycle-analysis-477518 --format="value(projectNumber)")

# Grant access to the secret
gcloud secrets add-iam-policy-binding database-url \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Step 3: Force New Deployment with Secret

Since the code needs to be redeployed anyway (to get the debugging), trigger a new build:

```bash
# This will deploy with the latest code AND ensure secrets are set
gcloud builds submit --config=cloudbuild.yaml
```

Or manually update the service again with all secrets:

```bash
gcloud run services update lifecycle-analysis \
  --region=us-central1 \
  --update-secrets=DATABASE_URL=database-url:latest,GOOGLE_CSE_API_KEY=google-cse-api:latest,GOOGLE_CSE_CX=google-cse-cx:latest,GEMINI_API_KEY=gemini-api-key:latest
```

### Step 4: Check Logs After Deployment

After deployment, check startup logs:

```bash
gcloud run services logs read lifecycle-analysis \
  --region=us-central1 \
  --limit=100 | grep -i -E "(DATABASE_URL|🔍|📊|❌)" | head -20
```

You should see the debug logs showing if DATABASE_URL is set.

