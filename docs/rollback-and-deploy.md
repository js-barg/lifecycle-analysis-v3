# Rollback to Previous Revision

The current revision is broken. Let's rollback to the previous working one.

## Step 1: List Revisions to Find Previous Working One

```bash
gcloud run revisions list --service=lifecycle-analysis --region=us-central1
```

Look for a revision that's not the broken one (lifecycle-analysis-00009-hgb).

## Step 2: Rollback to Previous Revision

```bash
# Replace XXXX with the previous revision number (probably 00008-something)
gcloud run services update-traffic lifecycle-analysis \
  --region=us-central1 \
  --to-revisions=lifecycle-analysis-00008-849=100
```

Or simply route 100% traffic to the previous revision that was working.

## Step 3: Deploy Code Fix from Local Machine

Once service is restored, then commit and push the code fix:

```powershell
# From your LOCAL machine
cd C:\development\lifecycle-analysis
git add backend/src/database/dbConnection.js
git commit -m "Fix database connection: Trim DATABASE_URL to remove trailing newlines"
git push origin main
```

This will trigger Cloud Build and deploy the fixed code.

