# How to Verify Latest Code is Deployed to Cloud

## After Build Completes

Once your Cloud Build finishes (check status at https://console.cloud.google.com/cloud-build/builds), use these methods to verify:

---

## Method 1: Check Build Commit SHA ⭐ (Easiest)

This verifies which commit the build used:

```bash
# Get latest build details
gcloud builds list --limit=1 --format="yaml" | grep -i "commit\|sha"

# Or get full details
LATEST_BUILD=$(gcloud builds list --limit=1 --format="value(id)")
gcloud builds describe $LATEST_BUILD --format="yaml" | grep -A 5 "source:"
```

**Expected Result:**
- Commit SHA should be: `072ff301a6abd2cde4987f3004bda890e3d7a0c9`
- If it matches your latest commit, the build used the correct code ✅

---

## Method 2: Verify in Browser (Production Check) ⭐⭐ (Most Reliable)

### Step 1: Open Production App
- Go to your Cloud Run service URL
- Navigate to Phase 3 page

### Step 2: Check Browser Console
Open DevTools (F12) → Console tab, then run:

```javascript
// Check if checkbox element exists
document.querySelector('#use-cached-research-checkbox')

// Should return: <input id="use-cached-research-checkbox" ...>

// Check if label exists
document.querySelector('label[for="use-cached-research-checkbox"]')

// Check for the checkbox text
document.body.innerText.includes('Use Cached Research')

// Search in the DOM
document.querySelectorAll('input[type="checkbox"]')
```

### Step 3: Inspect Network Tab
1. Open DevTools → Network tab
2. Reload page (Ctrl+Shift+R for hard refresh)
3. Find the main JavaScript bundle (usually `index-*.js`)
4. Right-click → "Open in Sources" or "View Source"
5. Search for: `use-cached-research-checkbox`
6. If found: ✅ Code is deployed!

---

## Method 3: Check Cloud Run Deployment

```bash
# Get Cloud Run service details
gcloud run services describe lifecycle-analysis --region=us-central1 --format="yaml" | grep -i image

# Check when service was last updated
gcloud run services describe lifecycle-analysis --region=us-central1 --format="value(status.latestCreatedRevisionName)"
gcloud run revisions describe REVISION_NAME --region=us-central1 --format="yaml" | grep -A 10 "spec:"
```

**Compare:**
- Image should have timestamp matching your latest build
- Revision creation time should match build completion time

---

## Method 4: Inspect Container Image (Advanced)

If you have Docker access, you can inspect the built container:

```bash
# Pull the latest image
docker pull gcr.io/lifecycle-analysis-477518/lifecycle-analysis:latest

# Run a shell in the container
docker run --rm -it gcr.io/lifecycle-analysis-477518/lifecycle-analysis:latest sh

# Inside container, check the built files
find /app/backend/public -name "*.js" -exec grep -l "use-cached-research-checkbox" {} \;

# Or check directly
grep -r "use-cached-research-checkbox" /app/backend/public/
```

---

## Method 5: Quick Visual Check ✅ (Fastest)

1. **Open production URL**
2. **Navigate to Phase 3**
3. **Look for checkbox** in the Control Panel section
   - Should be visible BEFORE "Start AI Research" button
   - Label: "Use Cached Research"
   - Has an Info icon next to it

**If you see it:** ✅ Deployed successfully!

**If you don't see it:**
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache
- Check build actually completed successfully
- Verify build used correct commit (Method 1)

---

## Method 6: Check Build Logs

```bash
# Get latest build ID
BUILD_ID=$(gcloud builds list --limit=1 --format="value(id)")

# Check build logs for commit info
gcloud builds log $BUILD_ID | grep -i "commit\|sha\|checkout"

# Check for any errors during build
gcloud builds log $BUILD_ID | grep -i "error\|fail"
```

**Look for:**
- ✅ "Cloning" or "Checking out" with commit SHA
- ✅ Build completed successfully
- ❌ No errors during build process

---

## Verification Checklist

After build completes, verify:

- [ ] **Build Status:** SUCCESS (not FAILURE or TIMEOUT)
- [ ] **Build Commit SHA:** Matches `072ff30` (latest commit)
- [ ] **Cloud Run Revision:** Updated after build completed
- [ ] **Browser Checkbox:** Visible in production UI
- [ ] **Browser Console:** `document.querySelector('#use-cached-research-checkbox')` returns element
- [ ] **No Cache Issues:** Hard refresh shows checkbox

---

## If Checkbox Still Missing After Verification

1. **Clear Cloud Run cache:**
   ```bash
   # Force new deployment
   gcloud run services update lifecycle-analysis \
     --region=us-central1 \
     --update-env-vars=CLEAR_CACHE=true
   ```

2. **Check browser cache:**
   - Clear cache completely
   - Use incognito/private mode
   - Different browser

3. **Verify build actually deployed:**
   - Check Cloud Run revision timestamp
   - Compare with build completion time

4. **Check for JavaScript errors:**
   - Browser Console → Any errors?
   - Network tab → Any failed requests?

5. **Inspect deployed files:**
   - Check if checkbox code is in the built JS bundle
   - Method 2 (Network tab) is best for this

---

## Quick Verification Script

Save this as `verify-deployment.sh` and run after build:

```bash
#!/bin/bash
echo "=== Verifying Deployment ==="

# Check latest build
BUILD_ID=$(gcloud builds list --limit=1 --format="value(id)")
echo "Latest Build ID: $BUILD_ID"

# Get commit SHA from build
COMMIT_SHA=$(gcloud builds describe $BUILD_ID --format="value(substitutions.COMMIT_SHA)")
if [ -z "$COMMIT_SHA" ]; then
    COMMIT_SHA=$(gcloud builds describe $BUILD_ID --format="yaml" | grep -oP "commitSha: \K[^\s]+" || echo "N/A")
fi

echo "Build Commit SHA: $COMMIT_SHA"
echo "Expected SHA: 072ff301a6abd2cde4987f3004bda890e3d7a0c9"

if [[ "$COMMIT_SHA" == *"072ff30"* ]]; then
    echo "✅ Build used latest commit!"
else
    echo "⚠️ Build may have used older commit"
fi

# Check Cloud Run service
echo ""
echo "=== Cloud Run Service ==="
gcloud run services describe lifecycle-analysis --region=us-central1 --format="value(status.latestReadyRevisionName)" 2>/dev/null

echo ""
echo "✅ Verification complete!"
echo "Next: Check production URL and look for checkbox"
```
