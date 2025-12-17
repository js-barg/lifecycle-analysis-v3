#!/bin/bash
# Script to trigger Cloud Build from Cloud Shell

echo "=== Triggering Cloud Build with Latest Code ==="

# Clone or update the repository
if [ -d "lifecycle-analysis" ]; then
    echo "Repository exists, pulling latest changes..."
    cd lifecycle-analysis
    git pull origin main
else
    echo "Cloning repository..."
    git clone https://github.com/js-barg/lifecycle-analysis.git
    cd lifecycle-analysis
fi

# Verify we have the latest commit
echo ""
echo "=== Current Commit ==="
git log -1 --oneline
CURRENT_COMMIT=$(git rev-parse HEAD)
echo "Commit SHA: $CURRENT_COMMIT"

# Verify checkbox code exists
echo ""
echo "=== Verifying Checkbox Code ==="
if grep -q "use-cached-research-checkbox" src/components/Phase3Results.jsx; then
    echo "✅ Checkbox code found in file"
else
    echo "❌ Checkbox code NOT found!"
    exit 1
fi

# Submit the build
echo ""
echo "=== Submitting Cloud Build ==="
gcloud builds submit --config=cloudbuild.yaml

echo ""
echo "=== Build Submitted! ==="
echo "Check build status at:"
echo "https://console.cloud.google.com/cloud-build/builds?project=lifecycle-analysis-477518"



