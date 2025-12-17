# Deployment Steps for Phase 3 Fix

## Issue
Phase 3 initialization fails in Cloud Run with error: "500 Failed to initialize Phase 3"

## Root Cause
In-memory job storage doesn't work across Cloud Run instances. The fix stores Phase 2 job data in the database.

## Required Steps

### 1. Deploy Code Changes

You **MUST** commit and push the code changes to trigger Cloud Build:

```bash
# Check what files changed
git status

# Add the changed files
git add backend/src/controllers/phase2Controller.js
git add backend/src/controllers/phase3Controller.js
git add backend/src/database/migrations/create_phase2_jobs_table.sql
git add backend/scripts/run-phase2-jobs-migration.js

# Commit the changes
git commit -m "Fix Phase 3 initialization for Cloud Run - add database storage for Phase 2 jobs"

# Push to GitHub (this will trigger Cloud Build)
git push origin main
```

**Note:** Cloud Build is triggered automatically when you push to GitHub (based on your cloudbuild.yaml configuration).

### 2. Wait for Cloud Build to Complete

Check the Cloud Build status:
- Go to [Google Cloud Console > Cloud Build](https://console.cloud.google.com/cloud-build/builds)
- Wait for the build to complete (usually 5-10 minutes)
- Verify the deployment was successful

### 3. Run Database Migration

After deployment, you need to create the `phase2_jobs` table. You have two options:

#### Option A: Auto-Created (Easier)
The code now **auto-creates** the table if it doesn't exist when Phase 3 initializes. This means:
- ✅ **You can skip manual migration** - the table will be created automatically
- ⚠️ Make sure your database user has CREATE TABLE permissions

#### Option B: Manual Migration (More Control)
If you prefer to create the table manually:

**Using Cloud SQL Proxy (local):**
```bash
# Connect to Cloud SQL
gcloud sql connect lifecycle-db --user=postgres

# Run the migration SQL
\i backend/src/database/migrations/create_phase2_jobs_table.sql
```

**Or using the migration script:**
```bash
# Set DATABASE_URL environment variable
export DATABASE_URL="postgresql://user:password@/dbname?host=/cloudsql/lifecycle-analysis-477518:us-central1:lifecycle-db"

# Run migration
cd backend
node scripts/run-phase2-jobs-migration.js
```

### 4. Verify the Fix

1. **Check Cloud Run logs** to see if the table was created:
   ```bash
   gcloud run services logs read lifecycle-analysis --limit 50
   ```
   Look for: `✅ phase2_jobs table verified/created`

2. **Test the application:**
   - Complete Phase 2 analysis
   - Click "Ready for Phase 3"
   - Initialize Phase 3
   - Should work without errors

## Troubleshooting

### If you still get 500 errors:

1. **Check Cloud Run logs** for the actual error:
   ```bash
   gcloud run services logs read lifecycle-analysis --limit 100
   ```

2. **Verify table exists:**
   ```sql
   SELECT EXISTS (
     SELECT FROM information_schema.tables 
     WHERE table_name = 'phase2_jobs'
   );
   ```

3. **Check database permissions:**
   - Ensure the database user has CREATE TABLE permissions (for auto-create)
   - Or manually create the table using Option B above

4. **Verify code was deployed:**
   - Check that the latest commit is deployed
   - Check Cloud Run revision matches your latest code

### Common Issues:

- **"Table doesn't exist"**: Run the migration (Option B) or ensure auto-create has permissions
- **"Permission denied"**: Database user needs CREATE TABLE permissions
- **"Code not updated"**: Make sure you pushed to GitHub and Cloud Build completed

## Summary

1. ✅ **Commit and push code changes** → Triggers Cloud Build automatically
2. ✅ **Wait for deployment** → Cloud Build completes (5-10 min)
3. ✅ **Table auto-creates** → Or run manual migration if needed
4. ✅ **Test Phase 3** → Should work now!

The code now includes auto-creation of the table, so in most cases you only need to deploy the code changes.

