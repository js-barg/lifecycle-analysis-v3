#!/bin/bash
# Quick check script to run in Cloud Shell

echo "=== Quick Build Check ==="
echo ""

cd ~/lifecycle-analysis

# Check if checkbox exists locally
echo "1. Local file check:"
if grep -q "use-cached-research-checkbox" src/components/Phase3Results.jsx 2>/dev/null; then
    echo "✅ Checkbox found in local file"
    echo ""
    echo "Current commit: $(git log -1 --oneline)"
else
    echo "❌ Checkbox NOT in local file!"
    echo "Pulling latest code..."
    git pull origin main
    echo ""
    if grep -q "use-cached-research-checkbox" src/components/Phase3Results.jsx 2>/dev/null; then
        echo "✅ Checkbox found after pull"
    else
        echo "❌ Still not found after pull!"
    fi
fi

echo ""
echo "2. Build status:"
LATEST_BUILD=$(gcloud builds list --limit=1 --format="value(id)")
STATUS=$(gcloud builds describe $LATEST_BUILD --format="value(status)")
echo "Latest build: $LATEST_BUILD"
echo "Status: $STATUS"

echo ""
echo "3. Next steps:"
echo "If checkbox is in local file but missing in production:"
echo "  gcloud builds submit --config=cloudbuild.yaml"
echo ""
echo "Then wait 10-15 minutes and check production again"


