#!/bin/bash
# Rebuild with cache clearing to ensure fresh build

echo "=== Rebuilding with Cache Clear ==="
echo ""

cd ~/lifecycle-analysis

# Verify we have the checkbox
if ! grep -q "use-cached-research-checkbox" src/components/Phase3Results.jsx; then
    echo "❌ Checkbox not found! Pulling latest..."
    git pull origin main
fi

echo "✅ Checkbox code verified in source"
echo "Current commit: $(git log -1 --oneline)"
echo ""

# Check if dist folder exists (might cause issues)
if [ -d "dist" ]; then
    echo "⚠️  Found existing dist folder (will be removed for fresh build)"
    echo "Removing dist folder..."
    rm -rf dist
fi

if [ -d "backend/public" ]; then
    echo "⚠️  Found existing backend/public folder"
    echo "Clearing old built files..."
    rm -rf backend/public/assets
    rm -rf backend/public/*.js
    rm -rf backend/public/*.css
fi

echo ""
echo "=== Submitting Fresh Build ==="
echo "This build will:"
echo "1. Use latest source code (with checkbox)"
echo "2. Clear any cached build artifacts"
echo "3. Rebuild frontend with vite"
echo "4. Deploy to Cloud Run"
echo ""

# Submit build
gcloud builds submit --config=cloudbuild.yaml

echo ""
echo "=== Build Submitted ==="
echo "Wait 10-15 minutes for completion"
echo "Then check production and verify checkbox appears"



