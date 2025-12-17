# Deployment Guide - Where to Run Each Fix

## Fix 1: Database Secret (Cloud Shell)

**Location:** Cloud Shell (Google Cloud Console)

**What it does:** Fixes the `database-url` secret to remove trailing newline

**Steps:**
```bash
# In Cloud Shell
printf "postgresql://postgres:labyrinth@/lifecycle_db?host=/cloudsql/lifecycle-analysis-477518:us-central1:lifecycle-db&sslmode=disable" | \
  gcloud secrets versions add database-url --data-file=-

gcloud run services update lifecycle-analysis \
  --region=us-central1 \
  --update-secrets=DATABASE_URL=database-url:latest
```

**GitHub needed?** ❌ No - this is a configuration change, not code

---

## Fix 2: Code Fix (Local Machine → GitHub)

**Location:** Your local machine (C:\development\lifecycle-analysis)

**What it does:** Updates code to trim DATABASE_URL, making it more robust

**Steps:**
```powershell
# From your LOCAL machine (PowerShell)
cd C:\development\lifecycle-analysis

# Check status
git status

# Add the changed file
git add backend/src/database/dbConnection.js

# Commit
git commit -m "Fix database connection: Trim DATABASE_URL to remove trailing newlines"

# Push to GitHub - THIS TRIGGERS CLOUD BUILD AUTOMATICALLY
git push origin main
```

**After pushing:**
1. Cloud Build automatically starts (check: https://console.cloud.google.com/cloud-build/builds)
2. Wait 5-10 minutes for build to complete
3. New code is deployed to Cloud Run
4. Service should now work!

**GitHub needed?** ✅ Yes - pushing to GitHub triggers Cloud Build

---

## Complete Workflow

1. ✅ **Fix secret in Cloud Shell** (immediate fix)
2. ✅ **Fix code locally, commit, push** (long-term fix)
3. ✅ **Wait for Cloud Build to complete** (5-10 min)
4. ✅ **Test Phase 3 initialization** (should work!)

---

## Quick Reference

| Fix | Where | GitHub? | Triggers Cloud Build? |
|-----|-------|---------|----------------------|
| Secret fix | Cloud Shell | ❌ No | ❌ No (direct update) |
| Code fix | Local machine | ✅ Yes | ✅ Yes (automatic) |

