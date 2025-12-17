# Cloud Run Secrets Setup Guide

This guide explains how to configure API keys for both local development and Google Cloud Run deployment.

## Overview

The application uses **two different approaches** for environment variables:

1. **Local Development**: Uses `.env` file in the project root (via `dotenv`)
2. **Cloud Run**: Uses Google Secret Manager (secure, recommended for production)

**The code automatically works in both environments** - it just reads from `process.env.GEMINI_API_KEY`, which gets populated from:
- `.env` file (local development)
- Secret Manager (Cloud Run, via `--set-secrets` in cloudbuild.yaml)

## Current Setup

### Local Development (.env file)

The `.env` file in the project root is used for local development:

```bash
# Root directory: c:\development\lifecycle-analysis\.env
AI_RESEARCH_PROVIDER=gemini
GEMINI_API_KEY=AIzaSyBYrz6CYFVbqlwJs8gwMvxZIC8IX__2cXY
GEMINI_MODEL=gemini-1.5-pro
```

**Note:** The `.env` file is in `.gitignore` and will NOT be deployed to Cloud Run.

### Cloud Run (Secret Manager)

Cloud Run uses Google Secret Manager for secure storage of API keys. The `cloudbuild.yaml` is configured to inject secrets as environment variables.

## Setting Up Secrets in Google Cloud

### Step 1: Create the Gemini API Key Secret

Run this command in Google Cloud Shell or your local terminal (with gcloud CLI):

```bash
# Set your project ID
export PROJECT_ID=lifecycle-analysis-477518

# Create the secret for Gemini API key
echo -n "AIzaSyBYrz6CYFVbqlwJs8gwMvxZIC8IX__2cXY" | \
  gcloud secrets create gemini-api-key \
    --project=$PROJECT_ID \
    --data-file=-
```

Or if the secret already exists, update it:

```bash
echo -n "AIzaSyBYrz6CYFVbqlwJs8gwMvxZIC8IX__2cXY" | \
  gcloud secrets versions add gemini-api-key \
    --project=$PROJECT_ID \
    --data-file=-
```

### Step 2: Grant Cloud Run Access to the Secret

```bash
# Grant Cloud Run service account access to the secret
gcloud secrets add-iam-policy-binding gemini-api-key \
  --project=$PROJECT_ID \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

**Note:** Replace `PROJECT_NUMBER` with your actual project number. You can find it with:
```bash
gcloud projects describe $PROJECT_ID --format="value(projectNumber)"
```

Or use the simpler approach - grant access to the default compute service account:

```bash
# Get your project number
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Grant access
gcloud secrets add-iam-policy-binding gemini-api-key \
  --project=$PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Step 3: Verify cloudbuild.yaml is Updated

The `cloudbuild.yaml` file should include the Gemini secret in the `--set-secrets` parameter:

```yaml
- '--set-secrets'
- 'DATABASE_URL=database-url:latest,GOOGLE_CSE_API_KEY=google-cse-api:latest,GOOGLE_CSE_CX=google-cse-cx:latest,GEMINI_API_KEY=gemini-api-key:latest'
```

✅ This has already been updated in your `cloudbuild.yaml`.

## Quick Setup Scripts

### For Linux/Mac (Bash)
Run the provided script:
```bash
chmod +x setup-gemini-secret.sh
./setup-gemini-secret.sh
```

### For Windows (PowerShell)
Run the provided script:
```powershell
.\setup-gemini-secret.ps1
```

Both scripts will:
1. Create/update the `gemini-api-key` secret in Secret Manager
2. Grant Cloud Run service account access to the secret
3. Verify the setup

## Alternative: Set Environment Variables Directly in Cloud Run

If you prefer not to use Secret Manager, you can set environment variables directly in Cloud Run:

```bash
gcloud run services update lifecycle-analysis \
  --project=$PROJECT_ID \
  --region=us-central1 \
  --set-env-vars="AI_RESEARCH_PROVIDER=gemini,GEMINI_API_KEY=AIzaSyBYrz6CYFVbqlwJs8gwMvxZIC8IX__2cXY,GEMINI_MODEL=gemini-1.5-pro"
```

**Note:** This is less secure than Secret Manager, but simpler for testing.

## Verification

After deployment, verify the secret is accessible:

1. Check Cloud Run service logs for:
   ```
   ✅ Generative AI credentials found (Provider: gemini, Key: AIzaSyBYrz...)
   ```

2. Or test the API endpoint:
   ```bash
   curl https://your-cloud-run-url/api/health
   ```

## Summary

- **Local**: Uses `.env` file (already configured)
- **Cloud Run**: Uses Secret Manager (needs setup - see steps above)
- **Both**: Code automatically reads from `process.env.GEMINI_API_KEY`

The application code works the same way in both environments - it just reads from `process.env`, which gets populated from:
- `.env` file (local, via dotenv)
- Secret Manager (Cloud Run, via --set-secrets)

