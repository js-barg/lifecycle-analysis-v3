# Fix: Database Connection Issue in Cloud Run

## Problem
Error: `connect ECONNREFUSED 127.0.0.1:5432`

This means `DATABASE_URL` environment variable is not being read in Cloud Run, so it's falling back to `localhost:5432`.

## Solution

### Step 1: Verify the Secret Exists

Check if the `database-url` secret exists in Secret Manager:

```bash
gcloud secrets list --filter="name:database-url"
```

### Step 2: Check the Secret Value

View the secret (this will show the connection string):

```bash
gcloud secrets versions access latest --secret="database-url"
```

**Expected format:**
```
postgresql://postgres:password@/lifecycle_db?host=/cloudsql/lifecycle-analysis-477518:us-central1:lifecycle-db&sslmode=disable
```

### Step 3: If Secret Doesn't Exist or is Wrong

Create/update the secret with the correct connection string:

```bash
echo "postgresql://postgres:labyrinth@/lifecycle_db?host=/cloudsql/lifecycle-analysis-477518:us-central1:lifecycle-db&sslmode=disable" | \
  gcloud secrets create database-url --data-file=- || \
  echo "postgresql://postgres:labyrinth@/lifecycle_db?host=/cloudsql/lifecycle-analysis-477518:us-central1:lifecycle-db&sslmode=disable" | \
    gcloud secrets versions add database-url --data-file=-
```

**Important:** Replace `labyrinth` with your actual database password if different.

### Step 4: Grant Cloud Run Access to the Secret

```bash
PROJECT_ID="lifecycle-analysis-477518"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding database-url \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Step 5: Verify cloudbuild.yaml

Make sure `cloudbuild.yaml` includes `DATABASE_URL` in `--set-secrets`:

```yaml
- '--set-secrets'
- 'DATABASE_URL=database-url:latest,GOOGLE_CSE_API_KEY=google-cse-api:latest,GOOGLE_CSE_CX=google-cse-cx:latest,GEMINI_API_KEY=gemini-api-key:latest'
```

### Step 6: Redeploy

After fixing the secret, redeploy:

```bash
git add backend/src/database/dbConnection.js
git commit -m "Fix database connection: Add better logging and error handling"
git push
```

Wait for Cloud Build to complete, then check logs:

```bash
gcloud run services logs read lifecycle-analysis --limit 50 | grep -i "database"
```

You should see:
- `📊 Database connection: postgresql://...` (connection info)
- `✅ Database connection successful` (if connection works)

## Troubleshooting

### If you see "DATABASE_URL environment variable is not set!"

The secret is not being injected. Check:
1. Secret exists: `gcloud secrets list | grep database-url`
2. Secret is in cloudbuild.yaml: `--set-secrets` includes `DATABASE_URL=database-url:latest`
3. Cloud Run service account has access (see Step 4)

### If connection still fails

1. Check Cloud Run logs for the actual connection string (it will be partially masked)
2. Verify the Cloud SQL instance name matches: `lifecycle-analysis-477518:us-central1:lifecycle-db`
3. Verify database credentials (username/password)
4. Check if Cloud SQL instance allows connections from Cloud Run

