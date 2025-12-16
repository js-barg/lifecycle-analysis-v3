# Force Browser to Load Fresh Files

## If Hard Refresh Didn't Work

The browser is still requesting the old file even after cache clear. Try these:

## Step 1: Check for Service Worker

In browser console (F12 → Console):

```javascript
// Check if service worker exists
navigator.serviceWorker.getRegistrations().then(registrations => {
    console.log('Service Workers:', registrations.length);
    if (registrations.length > 0) {
        console.log('⚠️ Service Worker found! Unregistering...');
        registrations.forEach(reg => reg.unregister());
        console.log('✅ Service Workers unregistered. Reload page.');
    } else {
        console.log('✅ No service workers');
    }
});

// Also check localStorage
localStorage.clear();
sessionStorage.clear();
console.log('✅ Cleared localStorage and sessionStorage');
```

## Step 2: Check What the Browser Actually Loaded

In browser console, after page loads:

```javascript
// Check what JS file is actually loaded
Array.from(document.querySelectorAll('script[src*="index-"]')).forEach(script => {
    console.log('Loaded script:', script.src);
    console.log('Full URL:', new URL(script.src, window.location.href).href);
});
```

This will show if it's loading the OLD or NEW file.

## Step 3: Force Cloud Run to Serve Fresh HTML

Cloud Run might have edge caching. Check the HTML response headers:

In DevTools → Network → find `index.html` → Headers tab:
- Look for: `Cache-Control` header
- If it says `max-age=3600` or similar, Cloud Run is caching

**Fix:** Add cache-busting to the request:

Try accessing with a query parameter:
```
https://lifecycle-analysis-122356767765.us-central1.run.app/?t=12345
```

## Step 4: Direct File Access Test

Try accessing the NEW JS file directly:
```
https://lifecycle-analysis-122356767765.us-central1.run.app/assets/index-uu6Fwxyn.js
```

Then search for: `use-cached-research-checkbox`

If you can access it directly and find the checkbox → File exists, issue is browser caching HTML
If you can't access it → Different problem

## Step 5: Check Response Headers

In DevTools → Network → `index.html`:
- Status: Should be `200 OK` (not `304 Not Modified`)
- Response Headers: Check `Cache-Control`, `ETag`, `Last-Modified`

If it's still `304 Not Modified`, the cache headers are too aggressive.

## Step 6: Nuclear Option - Clear Everything

1. **Chrome Settings:**
   - Go to: `chrome://settings/clearBrowserData`
   - Time range: "All time"
   - Check ALL boxes
   - Click "Clear data"

2. **Close browser completely** (all windows)

3. **Reopen browser**

4. **Navigate to site in new tab**

## Step 7: Check if Cloud Run Has Multiple Revisions

Multiple Cloud Run revisions might be serving different files:

```bash
# In Cloud Shell
gcloud run revisions list --service=lifecycle-analysis --region=us-central1

# Check which revision is receiving traffic
gcloud run services describe lifecycle-analysis --region=us-central1 --format="value(status.latestReadyRevisionName)"
```

## Step 8: Verify the NEW HTML is Being Served

In browser, run this after page loads:

```javascript
// Check the actual HTML content
fetch('/index.html?t=' + Date.now(), {cache: 'no-store'})
  .then(r => r.text())
  .then(html => {
    const match = html.match(/assets\/index-[^"]*\.js/);
    console.log('HTML references:', match ? match[0] : 'NOT FOUND');
    
    // Check if checkbox is in HTML (it shouldn't be, but check)
    if (html.includes('use-cached-research-checkbox')) {
        console.log('✅ Checkbox found in HTML');
    } else {
        console.log('ℹ️ Checkbox not in HTML (expected, it should be in JS)');
    }
  });
```

This will show what HTML the server is actually sending.


