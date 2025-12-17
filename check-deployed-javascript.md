# How to Check What Was Actually Built and Deployed

## Method 1: Inspect the Container Image Directly

In Cloud Shell, try to inspect what's in the deployed container:

```bash
# Get the image URL
SERVICE_IMAGE=$(gcloud run services describe lifecycle-analysis --region=us-central1 --format="value(spec.template.spec.containers[0].image)")

echo "Image: $SERVICE_IMAGE"

# If you have docker access, pull and inspect:
docker pull $SERVICE_IMAGE

# Check what files are in the container
docker run --rm $SERVICE_IMAGE find /app -name "*.js" -type f | head -20

# Check the built frontend files location
docker run --rm $SERVICE_IMAGE ls -la /app/backend/public/

# Try to grep for checkbox in built files
docker run --rm $SERVICE_IMAGE grep -r "use-cached-research-checkbox" /app/backend/public/ 2>/dev/null || echo "Not found in public files"

# Check the actual JS bundles
docker run --rm $SERVICE_IMAGE sh -c "find /app/backend/public/assets -name '*.js' -exec grep -l 'use-cached-research-checkbox' {} \; 2>/dev/null || echo 'Checkbox not found in JS files'"
```

## Method 2: Check Build Logs for File Contents

```bash
# Get latest build ID
LATEST_BUILD=$(gcloud builds list --limit=1 --format="value(id)")

# Check build logs for what files were processed
gcloud builds log $LATEST_BUILD | grep -E "Phase3Results|checkbox|vite build|Building"

# Check for any errors during build
gcloud builds log $LATEST_BUILD | grep -i "error\|fail\|warning" | tail -30

# Check what the Docker build saw
gcloud builds log $LATEST_BUILD | grep -A 10 "COPY\|ADD\|RUN.*vite" | tail -50
```

## Method 3: Check Source Archive That Was Built

```bash
# Get source details
LATEST_BUILD=$(gcloud builds list --limit=1 --format="value(id)")
BUILD_INFO=$(gcloud builds describe $LATEST_BUILD --format="yaml")

# Extract source bucket and generation
SOURCE_BUCKET=$(echo "$BUILD_INFO" | grep -A 5 "storageSource:" | grep "bucket:" | awk '{print $2}')
SOURCE_GEN=$(echo "$BUILD_INFO" | grep -A 5 "storageSource:" | grep "generation:" | awk '{print $2}')

echo "Source Bucket: $SOURCE_BUCKET"
echo "Source Generation: $SOURCE_GEN"

# Download and extract the source archive
TEMP_DIR=$(mktemp -d)
cd $TEMP_DIR

# Download the source
gsutil cp gs://$SOURCE_BUCKET/source/*.tgz source.tgz 2>/dev/null || echo "Could not download source"

if [ -f source.tgz ]; then
    tar -xzf source.tgz
    echo ""
    echo "Checking source archive for checkbox code..."
    
    if find . -name "Phase3Results.jsx" -exec grep -l "use-cached-research-checkbox" {} \; 2>/dev/null; then
        echo "✅ Checkbox code found in source archive!"
        find . -name "Phase3Results.jsx" -exec grep -n "use-cached-research-checkbox" {} \;
    else
        echo "❌ Checkbox code NOT in source archive!"
        echo "This means the build used old code"
    fi
    
    cd -
    rm -rf $TEMP_DIR
fi
```

## Method 4: Check Dockerfile Build Process

Verify the Dockerfile is correctly building the frontend:

```bash
# Check the Dockerfile
cat Dockerfile

# Look for:
# 1. Frontend build step (vite build)
# 2. Copy of source files before build
# 3. Copy of dist to backend/public

# Verify the build process in logs
LATEST_BUILD=$(gcloud builds list --limit=1 --format="value(id)")
gcloud builds log $LATEST_BUILD | grep -A 20 "RUN.*vite build"
```

## Method 5: Download and Check Built JavaScript from Production

In browser DevTools:

1. Open Network tab
2. Reload page (hard refresh: Ctrl+Shift+R)
3. Find the main JavaScript bundle (usually `index-*.js` in assets folder)
4. Right-click → "Copy" → "Copy as cURL" or "Copy Response"
5. Search the response for:
   - `use-cached-research-checkbox`
   - `Use Cached Research`
   - `checked={useCacheEnabled}`

If not found, the code wasn't included in the bundle.

## Method 6: Check Local Source Before Build

In Cloud Shell, verify the source that will be built:

```bash
cd ~/lifecycle-analysis

# Verify commit
git log -1 --oneline
# Should be: 072ff30 Fix: Move cache research checkbox...

# Verify file exists and has checkbox
if [ -f "src/components/Phase3Results.jsx" ]; then
    echo "File exists"
    
    # Count lines (to ensure it's complete)
    wc -l src/components/Phase3Results.jsx
    
    # Check for checkbox
    if grep -q "use-cached-research-checkbox" src/components/Phase3Results.jsx; then
        echo "✅ Checkbox code found"
        echo ""
        echo "Showing checkbox code (lines 1306-1340):"
        sed -n '1306,1340p' src/components/Phase3Results.jsx
    else
        echo "❌ Checkbox code NOT found!"
        echo ""
        echo "File content around line 1304:"
        sed -n '1300,1350p' src/components/Phase3Results.jsx
    fi
else
    echo "❌ File not found!"
fi
```

## Quick Diagnostic Script

Run this all-in-one check:

```bash
#!/bin/bash
echo "=== Complete Build Inspection ==="

# 1. Check local source
echo "1. Checking local source..."
cd ~/lifecycle-analysis
git log -1 --oneline
LOCAL_HAS_CHECKBOX=$(grep -c "use-cached-research-checkbox" src/components/Phase3Results.jsx 2>/dev/null || echo "0")
echo "Checkbox references in local file: $LOCAL_HAS_CHECKBOX"

# 2. Check latest build
echo ""
echo "2. Checking latest build..."
LATEST_BUILD=$(gcloud builds list --limit=1 --format="value(id)")
BUILD_TIME=$(gcloud builds describe $LATEST_BUILD --format="value(createTime)")
echo "Build ID: $LATEST_BUILD"
echo "Build Time: $BUILD_TIME"
BUILD_STATUS=$(gcloud builds describe $LATEST_BUILD --format="value(status)")
echo "Build Status: $BUILD_STATUS"

# 3. Check if source archive has checkbox
echo ""
echo "3. Checking source archive..."
# (Use Method 3 above)

# 4. Check deployed service
echo ""
echo "4. Checking deployed service..."
SERVICE_IMAGE=$(gcloud run services describe lifecycle-analysis --region=us-central1 --format="value(spec.template.spec.containers[0].image)" 2>/dev/null)
echo "Deployed Image: $SERVICE_IMAGE"

echo ""
echo "=== Summary ==="
if [ "$LOCAL_HAS_CHECKBOX" -gt "0" ]; then
    echo "✅ Local source has checkbox code"
else
    echo "❌ Local source missing checkbox code"
fi

if [ "$BUILD_STATUS" == "SUCCESS" ]; then
    echo "✅ Build succeeded"
else
    echo "❌ Build failed: $BUILD_STATUS"
fi
```



