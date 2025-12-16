# Fix Browser Cache Issue

## Problem Identified

- **Browser requesting:** `index-DJ6PX1-3.js` (OLD file)
- **Actually deployed:** `index-uu6Fwxyn.js` (NEW file with checkbox)
- **Response:** `304 Not Modified` (cached)

This means the HTML file still references the old JavaScript file, or there's aggressive caching.

## Solution Steps

### Step 1: Check What's Actually in the Container

Run in Cloud Shell:

```bash
SERVICE_IMAGE=$(gcloud run services describe lifecycle-analysis --region=us-central1 --format="value(spec.template.spec.containers[0].image)")

docker run --rm $SERVICE_IMAGE sh -c "
    echo '=== Checking deployed files ==='
    echo ''
    echo 'HTML file:'
    find /app/backend/public -name 'index.html' -exec head -100 {} \;
    echo ''
    echo 'JavaScript files:'
    ls -lh /app/backend/public/assets/*.js
    echo ''
    echo 'Which JS file is referenced in HTML?'
    grep -o 'assets/index-[^"]*' /app/backend/public/index.html | head -3
"
```

### Step 2: Check HTML File

The HTML file should reference the NEW JS file (`index-uu6Fwxyn.js`). If it references the old one, the build didn't update properly.

### Step 3: Force Browser to Load New Files

**Option A: Hard Refresh with Cache Bypass**
1. Open DevTools (F12)
2. Network tab → Check "Disable cache"
3. Keep DevTools open
4. Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R)

**Option B: Clear All Site Data**
1. Chrome: F12 → Application tab → Storage → "Clear site data"
2. Or: Settings → Privacy → Clear browsing data → "Cached images and files" → "Last hour"

**Option C: Service Worker Issue**
If there's a service worker:
1. DevTools → Application tab → Service Workers
2. Click "Unregister" if any exist
3. Hard refresh

**Option D: Direct URL Access**
Try accessing the new JS file directly:
```
https://lifecycle-analysis-122356767765.us-central1.run.app/assets/index-uu6Fwxyn.js
```
If this loads, the file exists. The issue is the HTML referencing the old file.

### Step 4: Verify New HTML is Deployed

Check if the HTML file references the correct JS file:

```bash
# In browser console:
fetch('/index.html')
  .then(r => r.text())
  .then(html => {
    const match = html.match(/assets\/index-[^"]*\.js/);
    console.log('Referenced JS file:', match ? match[0] : 'NOT FOUND');
  });
```

Should show: `assets/index-uu6Fwxyn.js` (or similar, with the new hash)

### Step 5: If HTML Still References Old File

If the HTML references the old file, the build didn't complete properly or there's a caching layer.

**Check:**
1. Was the build truly complete?
2. Did Cloud Run deploy the new revision?
3. Is there a CDN or load balancer caching the HTML?

**Force New Deployment:**
```bash
# In Cloud Shell
cd ~/lifecycle-analysis

# Rebuild and redeploy
gcloud builds submit --config=cloudbuild.yaml

# Or force Cloud Run to update
gcloud run services update lifecycle-analysis \
  --region=us-central1 \
  --update-env-vars=FORCE_RELOAD=$(date +%s)
```

## Quick Fix: Direct File Access Test

Try accessing the NEW file directly in browser:

```
https://lifecycle-analysis-122356767765.us-central1.run.app/assets/index-uu6Fwxyn.js
```

Then search for: `use-cached-research-checkbox`

If found → File exists, HTML needs updating
If not found → Different issue, file name might be different

## Most Likely Cause

The HTML file (`index.html`) still references the old JavaScript file name. This happens when:
1. Build cache kept old HTML
2. HTML wasn't regenerated properly
3. Cloud Run is serving cached HTML

## Immediate Action

**Try this in browser:**
1. Open DevTools → Network tab
2. Check "Disable cache" checkbox
3. Navigate to: `https://lifecycle-analysis-122356767765.us-central1.run.app/`
4. Look at the Network tab → find `index.html`
5. Click it → Response tab
6. Search for: `index-` (to see which JS file is referenced)

If it shows `index-DJ6PX1-3.js` → HTML is outdated, rebuild needed
If it shows `index-uu6Fwxyn.js` → Browser cache issue, hard refresh will fix

