# Setup Google Cloud Build Trigger for GitHub

## Method 1: Google Cloud Console (Recommended - Visual Interface)

### Step 1: Navigate to Cloud Build Triggers
1. Go to: https://console.cloud.google.com/cloud-build/triggers?project=lifecycle-analysis-477518
2. Or search for "Cloud Build Triggers" in the Google Cloud Console

### Step 2: Create New Trigger
1. Click **"CREATE TRIGGER"** button (top of the page)

### Step 3: Configure Trigger Settings

**Basic Information:**
- **Name**: `github-main-auto-build`
- **Description**: `Automatically build and deploy on push to main branch` (optional)
- **Tags**: (leave empty or add tags if desired)

**Event Configuration:**
- **Event**: Select **"Push to a branch"**
- **Source**: 
  - If you haven't connected GitHub, click **"Connect Repository"**
  - Select **"GitHub (Cloud Build GitHub App)"**
  - Authenticate and select: `js-barg/lifecycle-analysis`
- **Branch**: `^main$` (regex pattern - matches "main" branch exactly)

**Configuration:**
- **Type**: Select **"Cloud Build configuration file (yaml or json)"**
- **Location**: `cloudbuild.yaml` (should auto-detect)
- **Cloud Build configuration file location**: `cloudbuild.yaml`

**Advanced (Optional):**
- **Substitution variables**: Leave default
- **Service account**: Leave default (Cloud Build default service account)

### Step 4: Create Trigger
1. Click **"CREATE"** button
2. Wait for confirmation

### Step 5: Test the Trigger
1. Make a small change and push to main branch
2. Go back to Cloud Build Triggers page
3. You should see a new build automatically started

---

## Method 2: gcloud CLI (Command Line)

Run this in Cloud Shell:

```bash
# Set your project
gcloud config set project lifecycle-analysis-477518

# Create the trigger
gcloud builds triggers create github \
  --repo-name=lifecycle-analysis \
  --repo-owner=js-barg \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml \
  --name="github-main-auto-build" \
  --description="Automatically build and deploy on push to main branch"
```

### Verify Trigger Created
```bash
# List all triggers
gcloud builds triggers list

# Get details of specific trigger
gcloud builds triggers describe github-main-auto-build
```

---

## After Setup

Once the trigger is configured:
- ✅ Every push to `main` branch will automatically trigger a build
- ✅ Build will use `cloudbuild.yaml` configuration
- ✅ Will automatically deploy to Cloud Run after successful build
- ✅ You can see build status in: https://console.cloud.google.com/cloud-build/builds

## Test the Trigger

To test, make a small commit and push:
```bash
# Make a small change
echo "# Test trigger" >> README.md
git add README.md
git commit -m "Test: Trigger Cloud Build"
git push origin main
```

Then check Cloud Build console - you should see a new build automatically started!

---

## Troubleshooting

### If trigger doesn't fire:
1. Check trigger is enabled (should be by default)
2. Verify branch pattern matches (`^main$`)
3. Check GitHub connection is active
4. Verify `cloudbuild.yaml` exists in root of repo
5. Check Cloud Build service account has necessary permissions

### Check trigger logs:
```bash
gcloud builds triggers describe github-main-auto-build
```

### Manual trigger (if needed):
```bash
gcloud builds triggers run github-main-auto-build --branch=main
```



