#!/bin/bash
# Force cache invalidation for Cloud Run

echo "=== Forcing Cache Invalidation ==="
echo ""

# Option 1: Update service with new environment variable to force reload
echo "Method 1: Adding cache-busting environment variable..."
gcloud run services update lifecycle-analysis \
  --region=us-central1 \
  --update-env-vars=CACHE_BUST=$(date +%s),BUILD_TIME=$(date +%s)

echo ""
echo "✅ Service updated with cache-busting vars"
echo "This forces a new revision"

# Option 2: Check current cache headers
echo ""
echo "=== Checking Cache Headers ==="
SERVICE_URL=$(gcloud run services describe lifecycle-analysis --region=us-central1 --format="value(status.url)")
echo "Service URL: $SERVICE_URL"

echo ""
echo "To verify cache headers, run in browser console:"
echo "fetch('$SERVICE_URL/assets/index-uu6Fwxyn.js', {cache: 'reload'})"
echo "  .then(r => console.log('Headers:', r.headers))"

echo ""
echo "=== Next Steps ==="
echo "1. Wait 30-60 seconds for new revision to be ready"
echo "2. Force traffic to latest:"
echo "   gcloud run services update-traffic lifecycle-analysis --to-latest --region=us-central1"
echo "3. In browser: Clear cache completely or use incognito"
echo "4. Hard refresh with DevTools Network tab open and 'Disable cache' checked"

