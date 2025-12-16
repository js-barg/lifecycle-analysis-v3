#!/bin/bash
# Check what HTML and JS files are actually deployed

echo "=== Checking Deployed Files ==="
echo ""

SERVICE_IMAGE=$(gcloud run services describe lifecycle-analysis --region=us-central1 --format="value(spec.template.spec.containers[0].image)" 2>/dev/null)

if [ -z "$SERVICE_IMAGE" ]; then
    echo "❌ Could not get service image"
    exit 1
fi

echo "Service Image: $SERVICE_IMAGE"
echo ""

docker run --rm $SERVICE_IMAGE sh -c "
    echo '=== Files in backend/public/assets ==='
    ls -lh /app/backend/public/assets/*.js 2>/dev/null | head -5
    echo ''
    
    echo '=== JavaScript files found ==='
    find /app/backend/public/assets -name 'index-*.js' | head -5
    echo ''
    
    echo '=== Which JS file is in HTML? ==='
    if [ -f /app/backend/public/index.html ]; then
        grep -o 'assets/index-[^\"\s]*\.js' /app/backend/public/index.html | head -3
    else
        echo 'index.html not found'
    fi
    echo ''
    
    echo '=== Checking for checkbox in HTML ==='
    if [ -f /app/backend/public/index.html ]; then
        grep -i 'use-cached-research-checkbox\|checkbox' /app/backend/public/index.html | head -3 || echo 'Not found in HTML'
    fi
    echo ''
    
    echo '=== Checking which JS file has checkbox ==='
    find /app/backend/public/assets -name '*.js' -exec grep -l 'use-cached-research-checkbox' {} \; 2>/dev/null | head -3 || echo 'Not found in any JS file'
"


