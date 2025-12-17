#!/bin/bash
# Complete rebuild with all caches cleared

echo "=== Complete Rebuild with Cache Clear ==="
echo ""

cd ~/lifecycle-analysis

# Step 1: Verify source has checkbox
echo "Step 1: Verifying source code..."
if ! grep -q "use-cached-research-checkbox" src/components/Phase3Results.jsx; then
    echo "❌ Checkbox not in source! Pulling latest..."
    git pull origin main
fi

if grep -q "use-cached-research-checkbox" src/components/Phase3Results.jsx; then
    echo "✅ Checkbox code confirmed in source"
    echo "Current commit: $(git log -1 --oneline)"
else
    echo "❌ Checkbox still not found after pull!"
    exit 1
fi

# Step 2: Clear ALL build artifacts
echo ""
echo "Step 2: Clearing build artifacts..."
rm -rf dist
rm -rf node_modules/.vite
rm -rf backend/public/assets
rm -rf backend/public/*.js
rm -rf backend/public/*.css
rm -rf backend/public/*.html
echo "✅ Build artifacts cleared"

# Step 3: Verify Dockerfile will build correctly
echo ""
echo "Step 3: Checking Dockerfile..."
if [ -f Dockerfile ]; then
    echo "✅ Dockerfile exists"
    echo "Build process:"
    grep -E "COPY|RUN.*vite|RUN.*build" Dockerfile
else
    echo "❌ Dockerfile not found!"
    exit 1
fi

# Step 4: Submit build
echo ""
echo "Step 4: Submitting fresh build..."
echo "This will take 10-15 minutes..."
echo ""

gcloud builds submit --config=cloudbuild.yaml

echo ""
echo "=== Build Submitted ==="
echo "After build completes:"
echo "1. Wait for deployment (2-5 minutes after build)"
echo "2. Force traffic to latest: gcloud run services update-traffic lifecycle-analysis --to-latest --region=us-central1"
echo "3. Hard refresh browser (Ctrl+Shift+R)"
echo "4. Verify checkbox appears"



