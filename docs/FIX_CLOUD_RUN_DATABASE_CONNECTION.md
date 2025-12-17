# Fix Cloud Run Database Connection Issue

## Problem

When running Phase 3 in Google Cloud Run, you see this error:
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

This indicates the application is trying to connect to `localhost:5432`, which doesn't work in Cloud Run. Cloud Run requires using a Unix socket connection to Cloud SQL.

## Root Cause

The `DATABASE_URL` secret in Google Cloud Secret Manager is set to a localhost connection string instead of the Cloud SQL Unix socket format.

## Solution

Update the `DATABASE_URL` secret to use the Cloud SQL Unix socket connection format.

### Option 1: Use the provided script (Recommended)

**On Linux/Mac/Cloud Shell:**
```bash
chmod +x update-database-secret.sh
./update-database-secret.sh
```

**On Windows (PowerShell):**
```powershell
.\update-database-secret.ps1
```

### Option 2: Manual update

Run this command in Cloud Shell or your local terminal (with gcloud authenticated):

```bash
echo "postgresql://postgres:labyrinth@/lifecycle_db?host=/cloudsql/lifecycle-analysis-477518:us-central1:lifecycle-db&sslmode=disable" | \
  gcloud secrets versions add database-url --data-file=-
```

**Important:** Replace:
- `postgres` with your actual database user
- `labyrinth` with your actual database password
- `lifecycle_db` with your actual database name
- `lifecycle-analysis-477518:us-central1:lifecycle-db` with your actual Cloud SQL instance connection name

### Connection String Format

The correct format for Cloud Run with Cloud SQL is:
```
postgresql://USER:PASSWORD@/DATABASE_NAME?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME&sslmode=disable
```

**Key points:**
- No `host:port` in the main connection string (notice `@/` instead of `@host:port/`)
- The `host` parameter uses `/cloudsql/` prefix (Unix socket path)
- Format: `/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME`

## Verify the Fix

1. **Check the secret was updated:**
   ```bash
   gcloud secrets versions list database-url
   ```

2. **Redeploy your Cloud Run service:**
   ```bash
   gcloud builds submit --config=cloudbuild.yaml
   ```

3. **Check the logs:**
   ```bash
   gcloud run services logs read lifecycle-analysis --region=us-central1 --limit=20
   ```

   You should see:
   - `✅ DATABASE_URL uses Cloud SQL Unix socket format (correct for Cloud Run)`
   - `✅ Database connection test successful`

## Troubleshooting

### Still seeing ECONNREFUSED?

1. **Verify the secret format:**
   - Make sure there are no newlines or extra spaces
   - The connection string should be on a single line
   - Check that the Cloud SQL instance name is correct

2. **Verify Cloud SQL instance connection:**
   ```bash
   gcloud sql instances describe lifecycle-db
   ```
   Check that the instance exists and is in the correct region.

3. **Verify Cloud Run has access:**
   - The Cloud Run service must have the Cloud SQL connection added:
     ```bash
     gcloud run services describe lifecycle-analysis --region=us-central1
     ```
   - Look for `cloudsql-instances` in the output
   - It should include: `lifecycle-analysis-477518:us-central1:lifecycle-db`

4. **Check Cloud Run service account permissions:**
   - The Cloud Run service account needs Cloud SQL Client role
   - Check: `gcloud projects get-iam-policy lifecycle-analysis-477518`

### Connection String Examples

**❌ WRONG (localhost - won't work in Cloud Run):**
```
postgresql://postgres:password@localhost:5432/lifecycle_db
```

**✅ CORRECT (Unix socket - works in Cloud Run):**
```
postgresql://postgres:password@/lifecycle_db?host=/cloudsql/lifecycle-analysis-477518:us-central1:lifecycle-db&sslmode=disable
```

## Additional Notes

- The `--add-cloudsql-instances` flag in `cloudbuild.yaml` is correct and necessary
- The Unix socket path `/cloudsql/...` is automatically mounted by Cloud Run
- SSL mode is set to `disable` for Unix socket connections (they're already secure)
- The connection string format is specific to Cloud Run + Cloud SQL

## Related Files

- `backend/src/database/dbConnection.js` - Database connection configuration
- `cloudbuild.yaml` - Cloud Run deployment configuration
- `update-database-secret.sh` - Script to update the secret (Linux/Mac)
- `update-database-secret.ps1` - Script to update the secret (Windows)
