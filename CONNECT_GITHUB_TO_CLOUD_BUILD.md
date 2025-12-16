# Connect GitHub Repository to Cloud Build

## The Issue

The error "INVALID_ARGUMENT: Request contains an invalid argument" usually means your GitHub repository isn't connected to Google Cloud Build yet.

## Solution: Connect GitHub Repository First

### Method 1: Via Google Cloud Console (Easiest)

1. **Go to Cloud Build Triggers:**
   - https://console.cloud.google.com/cloud-build/triggers?project=lifecycle-analysis-477518

2. **Click "CREATE TRIGGER"**

3. **When prompted for Source:**
   - If you see "Connect Repository" or "Connect new repository", click it
   - Select **"GitHub (Cloud Build GitHub App)"**
   - Click **"Install Google Cloud Build"** if prompted
   - Authorize access to your GitHub account
   - Select your repository: `js-barg/lifecycle-analysis`
   - Click **"Connect"**

4. **Then continue with trigger setup:**
   - Name: `github-main-auto-build`
   - Event: Push to a branch
   - Branch: `^main$`
   - Configuration: Cloud Build configuration file
   - Location: `cloudbuild.yaml`
   - Click **"CREATE"**

### Method 2: Check Existing Connections

First, check if any repositories are already connected:

```bash
# List connected repositories (if command exists)
gcloud source repos list

# Or check via console
# Go to: https://console.cloud.google.com/cloud-build/triggers
```

### Method 3: Manual Repository Connection

If the console method doesn't work, you may need to use the Cloud Build GitHub App:

1. Go to: https://github.com/apps/google-cloud-build
2. Click **"Configure"** or **"Install"**
3. Select your repository: `js-barg/lifecycle-analysis`
4. Grant necessary permissions
5. Then retry the trigger creation

## After Connecting Repository

Once the repository is connected, you can create the trigger using either:

**Option A: Console (Recommended)**
- Use the visual interface as described above

**Option B: gcloud CLI**
```bash
gcloud builds triggers create github \
  --repo-name=lifecycle-analysis \
  --repo-owner=js-barg \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml \
  --name="github-main-auto-build"
```

## Alternative: Use Manual Trigger (No Connection Needed)

If you prefer to keep manual control, you can skip the automatic trigger and manually trigger builds:

```bash
# In Cloud Shell, after pulling latest code
cd ~/lifecycle-analysis
git pull origin main
gcloud builds submit --config=cloudbuild.yaml
```

This doesn't require GitHub connection but requires manual triggering.

