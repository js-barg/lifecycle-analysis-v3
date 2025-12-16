# Fix: Phase 3 Initialization Error in Cloud Run

## Problem
The app works locally but fails in Cloud Run with error: **"500 Failed to initialize Phase 3"**

## Root Cause
The application uses **in-memory storage** (`jobStorage`) to store Phase 2 job data. In Cloud Run:
- Multiple instances can handle requests
- Each instance has its own memory
- When Phase 3 initialization hits a different instance than Phase 2, the job data isn't found
- This causes a 404/500 error

## Solution
Store Phase 2 job metadata in the **database** instead of (or in addition to) in-memory storage. This ensures data is available across all Cloud Run instances.

## Changes Made

### 1. Database Migration
Created `backend/src/database/migrations/create_phase2_jobs_table.sql` to add a `phase2_jobs` table.

### 2. Updated `saveForPhase3` (phase2Controller.js)
- Now stores Phase 2 job data in the database when saving for Phase 3
- Still maintains in-memory storage for backward compatibility

### 3. Updated `initializePhase3` (phase3Controller.js)
- First tries to get data from in-memory storage (for local dev)
- If not found, retrieves from database (for Cloud Run)
- Handles JSONB data parsing correctly

## Deployment Steps

### 1. Run Database Migration
Before deploying, run the migration to create the `phase2_jobs` table:

```bash
cd backend
node scripts/run-phase2-jobs-migration.js
```

Or manually run the SQL:
```bash
psql $DATABASE_URL -f src/database/migrations/create_phase2_jobs_table.sql
```

### 2. Deploy to Cloud Run
The code changes are backward compatible:
- Local development: Still uses in-memory storage (works as before)
- Cloud Run: Falls back to database if not in memory (fixes the issue)

### 3. Verify
After deployment:
1. Complete Phase 2 analysis
2. Click "Ready for Phase 3"
3. Initialize Phase 3
4. Should work without errors

## Testing Locally
The fix maintains backward compatibility. Test locally:
1. Run Phase 2 analysis
2. Save for Phase 3
3. Initialize Phase 3
4. Should work as before

## Notes
- The migration uses `CREATE TABLE IF NOT EXISTS`, so it's safe to run multiple times
- Database storage is optional - if it fails, in-memory storage still works (for local dev)
- JSONB columns are automatically handled by PostgreSQL

