#!/bin/bash
# Comprehensive diagnostic script to check what was built

echo "=== BUILD DIAGNOSTIC TOOL ==="
echo ""

# Step 1: Check local source
echo "STEP 1: Checking Local Source in Cloud Shell"
echo "--------------------------------------------"
cd ~/lifecycle-analysis

if [ -d "src/components" ]; then
    echo "✅ Source directory exists"
    
    if [ -f "src/components/Phase3Results.jsx" ]; then
        echo "✅ Phase3Results.jsx exists"
        
        FILE_LINES=$(wc -l < src/components/Phase3Results.jsx)
        echo "File size: $FILE_LINES lines"
        
        # Check for checkbox
        CHECKBOX_COUNT=$(grep -c "use-cached-research-checkbox" src/components/Phase3Results.jsx 2>/dev/null || echo "0")
        if [ "$CHECKBOX_COUNT" -gt "0" ]; then
            echo "✅ Checkbox code found ($CHECKBOX_COUNT references)"
            echo ""
            echo "Checkbox code snippet:"
            grep -B 2 -A 8 "use-cached-research-checkbox" src/components/Phase3Results.jsx | head -15
        else
            echo "❌ Checkbox code NOT found!"
            echo ""
            echo "Checking what's around line 1304 (where checkbox should be):"
            sed -n '1300,1320p' src/components/Phase3Results.jsx
        fi
        
        # Check current commit
        echo ""
        echo "Current commit:"
        git log -1 --oneline
    else
        echo "❌ Phase3Results.jsx not found!"
    fi
else
    echo "❌ src/components directory not found!"
fi

echo ""
echo "STEP 2: Checking Latest Build"
echo "--------------------------------------------"
LATEST_BUILD=$(gcloud builds list --limit=1 --format="value(id)")
echo "Build ID: $LATEST_BUILD"

BUILD_STATUS=$(gcloud builds describe $LATEST_BUILD --format="value(status)")
BUILD_TIME=$(gcloud builds describe $LATEST_BUILD --format="value(createTime)")
echo "Status: $BUILD_STATUS"
echo "Time: $BUILD_TIME"

# Check build logs for vite build output
echo ""
echo "Checking build logs for frontend build..."
gcloud builds log $LATEST_BUILD | grep -E "vite|Building|Phase3Results|dist" | tail -20

echo ""
echo "STEP 3: Checking Deployed Service"
echo "--------------------------------------------"
SERVICE_IMAGE=$(gcloud run services describe lifecycle-analysis --region=us-central1 --format="value(spec.template.spec.containers[0].image)" 2>/dev/null)
echo "Deployed Image: $SERVICE_IMAGE"

# Try to check container contents if docker is available
if command -v docker &> /dev/null; then
    echo ""
    echo "STEP 4: Inspecting Container Image"
    echo "--------------------------------------------"
    echo "Pulling image..."
    docker pull $SERVICE_IMAGE 2>&1 | tail -3
    
    echo ""
    echo "Checking if checkbox exists in built files..."
    docker run --rm $SERVICE_IMAGE sh -c "
        echo 'Checking backend/public/assets for checkbox...'
        find /app/backend/public/assets -name '*.js' -exec grep -l 'use-cached-research-checkbox' {} \; 2>/dev/null | head -5
        if [ \$? -ne 0 ]; then
            echo '❌ Checkbox not found in built JS files'
            echo ''
            echo 'Listing JS files:'
            find /app/backend/public/assets -name '*.js' | head -5
            echo ''
            echo 'Checking source file in container:'
            if [ -f /app/src/components/Phase3Results.jsx ]; then
                grep -c 'use-cached-research-checkbox' /app/src/components/Phase3Results.jsx || echo 'Not found in source'
            else
                echo 'Source file not in container (expected if using multi-stage build)'
            fi
        fi
    "
else
    echo "Docker not available for container inspection"
fi

echo ""
echo "STEP 5: Recommendations"
echo "--------------------------------------------"
if [ "$CHECKBOX_COUNT" -eq "0" ]; then
    echo "❌ ISSUE FOUND: Checkbox code missing from source!"
    echo "   Solution: git pull origin main to get latest code"
elif [ "$BUILD_STATUS" != "SUCCESS" ]; then
    echo "❌ ISSUE FOUND: Build did not succeed!"
    echo "   Check logs: gcloud builds log $LATEST_BUILD"
else
    echo "✅ Source has checkbox code"
    echo "✅ Build succeeded"
    echo ""
    echo "If checkbox still missing in production:"
    echo "1. Hard refresh browser (Ctrl+Shift+R)"
    echo "2. Clear browser cache"
    echo "3. Check browser console for JavaScript errors"
    echo "4. Verify the deployed JS bundle contains checkbox (Network tab)"
fi

echo ""
echo "=== Diagnostic Complete ==="



