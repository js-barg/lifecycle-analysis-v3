#!/bin/bash
# Check if checkbox is in the built JavaScript bundle

echo "=== Checking Built JavaScript Files ==="
echo ""

LATEST_BUILD=$(gcloud builds list --limit=1 --format="value(id)")
SERVICE_IMAGE=$(gcloud run services describe lifecycle-analysis --region=us-central1 --format="value(spec.template.spec.containers[0].image)" 2>/dev/null)

echo "Build ID: $LATEST_BUILD"
echo "Service Image: $SERVICE_IMAGE"
echo ""

# Check if we can access the container
if command -v docker &> /dev/null; then
    echo "Checking container contents..."
    echo ""
    
    # Pull the image
    docker pull $SERVICE_IMAGE 2>&1 | tail -3
    
    echo ""
    echo "=== Searching Built JavaScript Files ==="
    
    # Check built JS files
    docker run --rm $SERVICE_IMAGE sh -c "
        echo '1. Listing JavaScript files in built assets:'
        find /app/backend/public/assets -name '*.js' 2>/dev/null | head -5
        echo ''
        
        echo '2. Checking for checkbox in all JS files:'
        find /app/backend/public/assets -name '*.js' -exec grep -l 'use-cached-research-checkbox' {} \; 2>/dev/null | head -3
        if [ \$? -eq 0 ]; then
            echo '✅ Checkbox found in built JS!'
        else
            echo '❌ Checkbox NOT found in built JS files'
        fi
        echo ''
        
        echo '3. Checking for checkbox text:'
        find /app/backend/public/assets -name '*.js' -exec grep -l 'Use Cached Research' {} \; 2>/dev/null | head -3
        if [ \$? -eq 0 ]; then
            echo '✅ Checkbox text found!'
        else
            echo '❌ Checkbox text NOT found'
        fi
        echo ''
        
        echo '4. Checking what WAS in the files (searching for related terms):'
        find /app/backend/public/assets -name '*.js' -exec grep -l 'useCacheEnabled\|researchStatus' {} \; 2>/dev/null | head -3
        echo ''
        
        echo '5. Sample of one JS file (first 500 chars):'
        find /app/backend/public/assets -name '*.js' | head -1 | xargs head -c 500 2>/dev/null || echo 'Could not read file'
    "
else
    echo "Docker not available. Checking build logs instead..."
    echo ""
    
    echo "Checking vite build output in logs:"
    gcloud builds log $LATEST_BUILD | grep -A 5 -B 5 "vite\|dist\|build" | tail -30
fi

echo ""
echo "=== If Checkbox Not Found in Built Files ==="
echo "This means the build process didn't include it."
echo "Possible causes:"
echo "1. Build cache issue - old dist folder used"
echo "2. Vite build configuration issue"
echo "3. File wasn't copied before build"

