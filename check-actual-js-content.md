# Check What JS File Browser Actually Gets

Since the file has the code but browser doesn't see it, verify what the browser is actually receiving:

## Method 1: Direct File Access with Cache Bypass

In browser, try accessing the JS file directly with cache-busting:

```
https://lifecycle-analysis-122356767765.us-central1.run.app/assets/index-uu6Fwxyn.js?t=1234567890
```

Then search for: `use-cached-research-checkbox`

- **If found:** File is correct, it's a browser cache issue
- **If not found:** File being served is different from what's in container

## Method 2: Check Response Headers

In browser console:

```javascript
fetch('/assets/index-uu6Fwxyn.js?t=' + Date.now(), {
    cache: 'no-store',
    headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    }
})
.then(r => {
    console.log('Status:', r.status);
    console.log('Headers:');
    r.headers.forEach((v, k) => console.log(k + ':', v));
    return r.text();
})
.then(js => {
    const hasCheckbox = js.includes('use-cached-research-checkbox');
    console.log('Checkbox in response:', hasCheckbox);
    if (hasCheckbox) {
        console.log('✅ File is correct! Browser caching issue');
    } else {
        console.log('❌ File served is different from container');
        console.log('First 500 chars:', js.substring(0, 500));
    }
});
```

## Method 3: Compare File Sizes

In browser console:

```javascript
fetch('/assets/index-uu6Fwxyn.js?t=' + Date.now(), {cache: 'no-store'})
    .then(r => r.blob())
    .then(blob => {
        console.log('File size (browser):', blob.size, 'bytes');
        console.log('Expected: ~347KB (from container check)');
    });
```

If sizes don't match, different file is being served.

## Method 4: Check for Multiple JS Files

```javascript
// Check what JS files are actually available
fetch('/assets/index.html', {cache: 'no-store'})
    .then(r => r.text())
    .then(html => {
        const matches = html.matchAll(/assets\/index-[^"]*\.js/g);
        const files = Array.from(matches).map(m => m[0]);
        console.log('JS files referenced:', files);
    });
```

## Most Likely: HTTP Caching Headers

Cloud Run might be sending aggressive cache headers. Check:

1. **Response Headers** (from Method 2 above)
   - Look for `Cache-Control: max-age=...`
   - Look for `ETag` or `Last-Modified`
   - If `max-age` is large, Cloud Run is caching aggressively

2. **If caching is too aggressive**, we might need to:
   - Update Cloud Run configuration
   - Add cache-busting to HTML
   - Or ensure files have versioned names (which Vite already does)

## Solution: Force New Revision

Update the service to create a new revision (which should bypass some caches):

```bash
# This creates a new revision
gcloud run services update lifecycle-analysis \
  --region=us-central1 \
  --update-env-vars=REVISION=$(date +%s)

# Then route traffic to it
gcloud run services update-traffic lifecycle-analysis \
  --to-latest \
  --region=us-central1
```

