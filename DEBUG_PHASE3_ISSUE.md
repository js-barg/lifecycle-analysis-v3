# Debugging Phase 3 Initialization Issue

## Steps to Debug

### 1. Check Cloud Run Logs

Run this command to see recent logs:

```bash
gcloud run services logs read lifecycle-analysis --limit 200 --format="table(timestamp,severity,textPayload)" | grep -i -E "(phase|error|fail|phase2_jobs|initialize)"
```

Or view in console: [Cloud Run Logs](https://console.cloud.google.com/run/detail/us-central1/lifecycle-analysis/logs)

**Look for:**
- `Phase 3 init request for Phase 2 job: <job-id>`
- `Phase 2 job not in memory, checking database...`
- `✅ phase2_jobs table verified/created`
- `✅ Found Phase 2 job in database`
- Any error messages

### 2. Verify Table Exists

Connect to your Cloud SQL database and check:

```sql
-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'phase2_jobs'
);

-- Check if data exists for your job
SELECT job_id, customer_name, phase3_ready, phase3_ready_at 
FROM phase2_jobs 
WHERE phase3_ready = true
ORDER BY phase3_ready_at DESC
LIMIT 10;
```

### 3. Important: Workflow Must Be Correct

**The workflow MUST be:**
1. ✅ Complete Phase 2 analysis
2. ✅ Click "Ready for Phase 3" button → This calls `saveForPhase3` which saves to database
3. ✅ Then initialize Phase 3 → This calls `initializePhase3` which reads from database

**If you're trying to initialize Phase 3 for a job that was created BEFORE the code was deployed:**
- The data won't be in the database because `saveForPhase3` wasn't called with the new code
- You need to click "Ready for Phase 3" again after deployment

### 4. Check Specific Error

When Phase 3 initialization fails, check what error you get:

- **"Phase 2 job not found"** → Data not in database, need to re-run "Ready for Phase 3"
- **"Table does not exist"** → Table creation failed (check permissions)
- **"Failed to retrieve Phase 2 job data"** → Database query failed (check connection/permissions)

### 5. Test with Fresh Data

1. Create a NEW Phase 2 analysis (after code is deployed)
2. Complete Phase 2
3. Click "Ready for Phase 3" → Should see: `✅ Phase 2 job data saved to database`
4. Initialize Phase 3 → Should work

### 6. Common Issues

**Issue: "Phase 2 job not found"**
- **Cause:** Data not saved to database (table didn't exist when saving, or saveForPhase3 wasn't called)
- **Fix:** Click "Ready for Phase 3" again after deployment

**Issue: Database permission errors**
- **Cause:** Database user doesn't have CREATE TABLE permissions
- **Fix:** Grant permissions or manually create the table

**Issue: Code not deployed**
- **Cause:** Build succeeded but old code still running
- **Fix:** Check Cloud Run revision, wait for new revision to get traffic

