# Fix Cloud Build Trigger - Wrong Repository

## The Problem
- **Trigger Name**: `github-main-auto-build`
- **Trigger Repository**: `js-barg/lifecycle-analysis-v3` ❌ (wrong)
- **Actual Repository**: `js-barg/lifecycle-analysis` ✅ (correct)

The trigger is watching the wrong repository, so pushes to `lifecycle-analysis` don't trigger builds.

## Solution: Update the Trigger

### Option 1: Update Existing Trigger (Recommended)

1. **Go to Cloud Build Triggers:**
   - https://console.cloud.google.com/cloud-build/triggers?project=lifecycle-analysis-477518

2. **Click on the trigger**: `github-main-auto-build`

3. **Click "EDIT"** (top right)

4. **Update the Source/Repository:**
   - Change from: `js-barg/lifecycle-analysis-v3`
   - Change to: `js-barg/lifecycle-analysis`
   - (If you don't see the correct repo, you may need to connect it first)

5. **Click "SAVE"**

### Option 2: Delete and Recreate

If you can't edit the repository, delete and recreate:

1. **Delete the old trigger:**
   - In the Triggers page, click the 3-dot menu next to `github-main-auto-build`
   - Click "Delete"

2. **Create new trigger:**
   - Click "CREATE TRIGGER"
   - Connect repository: `js-barg/lifecycle-analysis` (the correct one)
   - Configure as before
   - Name: `github-main-auto-build` (or a new name)

### Option 3: Create New Trigger for Correct Repo

Keep the old one and create a new one for the correct repo:

1. **Create new trigger:**
   - Name: `github-main-auto-build-v2`
   - Repository: `js-barg/lifecycle-analysis` (correct one)
   - Branch: `^main$`
   - Config: `cloudbuild.yaml`

## After Fixing

Once the trigger points to the correct repository:
1. Make a test commit and push
2. Build should automatically start
3. Check: https://console.cloud.google.com/cloud-build/builds



