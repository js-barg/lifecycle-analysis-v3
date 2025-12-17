#!/bin/bash
# Verify what's actually in the JS files in the container

echo "=== Verifying JS File Contents ==="
echo ""

SERVICE_IMAGE=$(gcloud run services describe lifecycle-analysis --region=us-central1 --format="value(spec.template.spec.containers[0].image)")

docker run --rm $SERVICE_IMAGE sh -c "
    echo '=== Checking index-uu6Fwxyn.js ==='
    if [ -f /app/backend/public/assets/index-uu6Fwxyn.js ]; then
        echo 'File exists'
        echo 'File size:'
        ls -lh /app/backend/public/assets/index-uu6Fwxyn.js
        echo ''
        echo 'Checking for checkbox code:'
        if grep -q 'use-cached-research-checkbox' /app/backend/public/assets/index-uu6Fwxyn.js; then
            echo '✅ Checkbox code FOUND in index-uu6Fwxyn.js'
            echo ''
            echo 'Showing context (first match):'
            grep -B 2 -A 5 'use-cached-research-checkbox' /app/backend/public/assets/index-uu6Fwxyn.js | head -10
        else
            echo '❌ Checkbox code NOT in index-uu6Fwxyn.js'
            echo ''
            echo 'This file exists but does not contain checkbox code!'
            echo ''
            echo 'Checking what IS in the file (first 500 chars):'
            head -c 500 /app/backend/public/assets/index-uu6Fwxyn.js
        fi
    else
        echo '❌ File does not exist'
    fi
    
    echo ''
    echo '=== Checking index-C7KTtOl-.js (older file) ==='
    if [ -f /app/backend/public/assets/index-C7KTtOl-.js ]; then
        echo 'File exists'
        if grep -q 'use-cached-research-checkbox' /app/backend/public/assets/index-C7KTtOl-.js; then
            echo '✅ Checkbox code FOUND in index-C7KTtOl-.js (old file)'
        else
            echo '❌ Checkbox code NOT in index-C7KTtOl-.js'
        fi
    fi
    
    echo ''
    echo '=== Checking all JS files for checkbox ==='
    find /app/backend/public/assets -name '*.js' -exec grep -l 'use-cached-research-checkbox' {} \; 2>/dev/null || echo 'NOT FOUND in any JS file'
    
    echo ''
    echo '=== File timestamps ==='
    ls -lth /app/backend/public/assets/index-*.js | head -3
"



