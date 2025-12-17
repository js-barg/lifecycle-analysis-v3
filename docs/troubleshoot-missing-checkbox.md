# Troubleshooting: Checkbox Missing After Build

## Current Situation
- ✅ Build completed successfully
- ❌ Checkbox not found in production (`null` in browser console)
- ❌ Checkbox not found in JavaScript bundle
- ⚠️ Build used storage source (local files), not GitHub directly

## Possible Issues

### Issue 1: Build Used Wrong Directory/Commit

The build might have been submitted from a directory that didn't have the latest code.

**Check in Cloud Shell:**
```bash
# Check what commit the built code came from
cd ~/lifecycle-analysis

# Verify current commit
git log -1 --oneline
# Should show: 072ff30 Fix: Move cache research checkbox...

# Check if checkbox code exists in current directory
grep -n "use-cached-research-checkbox" src/components/Phase3Results.jsx

# If not found, pull latest
git pull origin main

# Verify again
grep -n "use-cached-research-checkbox" src/components/Phase3Results.jsx
```

### Issue 2: Build Was Run Before Pulling Latest Code

If you built before pulling the latest code, the old version was deployed.

**Solution:**
```bash
cd ~/lifecycle-analysis

# Pull latest code
git pull origin main

# Verify checkbox exists
grep -n "use-cached-research-checkbox" src/components/Phase3Results.jsx

# If it exists, rebuild:
gcloud builds submit --config=cloudbuild.yaml
```

### Issue 3: Check What Was Actually Built

Check the build logs to see what was included:

```bash
# Get latest build ID
LATEST_BUILD=$(gcloud builds list --limit=1 --format="value(id)")

# Check build logs for file paths
gcloud builds log $LATEST_BUILD | grep -i "Phase3Results\|checkbox"

# Check when the source was uploaded
gcloud builds describe $LATEST_BUILD --format="yaml" | grep -A 5 "createTime"
```

## Quick Fix: Rebuild with Latest Code

Run these commands in Cloud Shell to ensure you're building the latest code:

```bash
cd ~/lifecycle-analysis

# Ensure we have latest code
git fetch origin main
git pull origin main

# Verify we have the checkbox commit
git log -1 --oneline
# Should show: 072ff30 Fix: Move cache research checkbox...

# Verify checkbox code exists locally
if grep -q "use-cached-research-checkbox" src/components/Phase3Results.jsx; then
    echo "✅ Checkbox code found - ready to build"
    echo "File location: src/components/Phase3Results.jsx"
    echo ""
    echo "Showing checkbox code:"
    grep -A 5 "use-cached-research-checkbox" src/components/Phase3Results.jsx | head -10
else
    echo "❌ Checkbox code NOT found!"
    echo "Please pull latest code: git pull origin main"
    exit 1
fi

# If code is present, rebuild
echo ""
echo "=== Submitting new build with verified code ==="
gcloud builds submit --config=cloudbuild.yaml
```

## Alternative: Build Directly from GitHub

Instead of building from local files, trigger a build that pulls directly from GitHub:

```bash
# Option 1: Use trigger (if configured)
gcloud builds triggers list
# If trigger exists, run it:
# gcloud builds triggers run TRIGGER_NAME --branch=main

# Option 2: Create a manual build from GitHub source via Cloud Console
# Go to: https://console.cloud.google.com/cloud-build/builds
# Click "TRIGGER BUILD"
# Select: GitHub source
# Branch: main
# Config: cloudbuild.yaml
```

## Verification After Rebuild

After rebuilding, wait for completion (~10-15 min), then:

1. **Hard refresh browser** (Ctrl+Shift+R)
2. **Check console:**
   ```javascript
   document.querySelector('#use-cached-research-checkbox')
   ```
   Should return element (not null)

3. **Check in Network tab:**
   - Load main JS file
   - Search for: `use-cached-research-checkbox`
   - Should find it

4. **Visual check:**
   - Phase 3 page
   - Checkbox should be visible in Control Panel



