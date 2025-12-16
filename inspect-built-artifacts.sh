#!/bin/bash
# Script to inspect what was actually built and deployed

echo "=== Inspecting Built Artifacts ==="
echo ""

# Step 1: Check latest build
echo "Step 1: Checking Latest Build..."
LATEST_BUILD=$(gcloud builds list --limit=1 --format="value(id)")
echo "Build ID: $LATEST_BUILD"
echo ""

# Get build details
echo "Step 2: Build Details..."
gcloud builds describe $LATEST_BUILD --format="yaml" | grep -E "createTime|status|source|images" | head -20
echo ""

# Step 3: Check Cloud Run image
echo "Step 3: Checking Cloud Run Image..."
SERVICE_IMAGE=$(gcloud run services describe lifecycle-analysis --region=us-central1 --format="value(spec.template.spec.containers[0].image)" 2>/dev/null)
echo "Service Image: $SERVICE_IMAGE"
echo ""

# Step 4: Try to inspect the container image
echo "Step 4: Inspecting Container Contents..."
echo "Attempting to extract and check built files..."
echo ""

# Create temp directory
TEMP_DIR=$(mktemp -d)
echo "Using temp directory: $TEMP_DIR"
echo ""

# Try to extract files from the container image
if [ ! -z "$SERVICE_IMAGE" ]; then
    echo "Checking if we can access the image..."
    
    # Method 1: Use gcloud to download and inspect
    echo ""
    echo "=== Method 1: Check what's in the build ==="
    
    # Get build logs
    echo "Checking build logs for file paths..."
    gcloud builds log $LATEST_BUILD | grep -E "Phase3Results|checkbox|COPY|ADD" | tail -20
    echo ""
    
    # Method 2: Inspect Cloud Storage source
    echo "=== Method 2: Check source that was built ==="
    SOURCE_BUCKET=$(gcloud builds describe $LATEST_BUILD --format="value(source.storageSource.bucket)" 2>/dev/null)
    SOURCE_GEN=$(gcloud builds describe $LATEST_BUILD --format="value(source.storageSource.generation)" 2>/dev/null)
    
    if [ ! -z "$SOURCE_BUCKET" ]; then
        echo "Source bucket: $SOURCE_BUCKET"
        echo "Generation: $SOURCE_GEN"
        echo ""
        echo "Checking if source archive is accessible..."
        gsutil ls gs://$SOURCE_BUCKET/source/*.tgz | tail -3
    fi
fi

# Step 5: Check local source that should have been built
echo ""
echo "=== Step 5: Verify Local Source Code ==="
echo "Checking what code exists locally in Cloud Shell..."

if [ -d "~/lifecycle-analysis" ]; then
    cd ~/lifecycle-analysis
    echo "Current directory: $(pwd)"
    echo "Current commit: $(git log -1 --oneline)"
    echo ""
    
    if [ -f "src/components/Phase3Results.jsx" ]; then
        echo "Checking for checkbox code in local file..."
        if grep -q "use-cached-research-checkbox" src/components/Phase3Results.jsx; then
            echo "✅ Checkbox code found in local file"
            echo ""
            echo "Showing checkbox section:"
            grep -n "use-cached-research-checkbox" src/components/Phase3Results.jsx | head -5
            echo ""
            echo "Full checkbox element (lines around it):"
            grep -B 5 -A 15 "use-cached-research-checkbox" src/components/Phase3Results.jsx | head -25
        else
            echo "❌ Checkbox code NOT found in local file!"
            echo ""
            echo "Current file content around where checkbox should be (line 1300-1350):"
            sed -n '1300,1350p' src/components/Phase3Results.jsx 2>/dev/null || echo "Could not read file"
        fi
    else
        echo "❌ Phase3Results.jsx not found in expected location"
    fi
else
    echo "⚠️ lifecycle-analysis directory not found in home"
fi

echo ""
echo "=== Recommendations ==="
echo "1. Verify the build actually used the code from this directory"
echo "2. Check if Dockerfile is correctly copying the source files"
echo "3. Verify the frontend build step is including the checkbox code"
echo "4. Check if there's a build cache issue"


