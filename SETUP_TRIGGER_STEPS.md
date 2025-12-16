# Step-by-Step: Setup Cloud Build Trigger

## Current Issue
The GitHub repository needs to be connected to Cloud Build before creating a trigger.

## Solution: Use Google Cloud Console

Since the CLI approach requires the repository to be connected first, use the Console which will guide you through the connection.

### Step-by-Step Instructions:

1. **Open Cloud Build Triggers Console:**
   - Direct link: https://console.cloud.google.com/cloud-build/triggers?project=lifecycle-analysis-477518
   - Or navigate: Cloud Build → Triggers

2. **Click "CREATE TRIGGER"** (top of page)

3. **Repository Connection:**
   - In the "Source" section, you'll see options to connect a repository
   - If you see "Connect Repository" or "Select Repository", click it
   - Choose **"GitHub (Cloud Build GitHub App)"**
   - If prompted, click **"Install Google Cloud Build"** or **"Authorize"**
   - Grant permissions to access your GitHub repositories
   - Select: `js-barg/lifecycle-analysis`
   - Click **"Connect"** or **"Select"**

4. **Configure Trigger:**
   - **Name**: `github-main-auto-build`
   - **Description**: `Auto-build on push to main` (optional)
   - **Event**: Select **"Push to a branch"**
   - **Branch**: Enter `^main$` (regex pattern)
   - **Configuration**: Select **"Cloud Build configuration file (yaml or json)"**
   - **Location**: `cloudbuild.yaml` (should auto-detect)

5. **Advanced (Optional):**
   - Leave substitution variables as default
   - Service account: Use default

6. **Create:**
   - Click **"CREATE"** button
   - Wait for confirmation

### Verify Trigger Created:

After creation, you should see:
- Trigger listed on the Triggers page
- Status: Enabled (green)

### Test the Trigger:

Make a small test commit:
```bash
echo "# Test trigger" >> README.md
git add README.md
git commit -m "Test: Auto-trigger Cloud Build"
git push origin main
```

Then check: https://console.cloud.google.com/cloud-build/builds
- You should see a new build automatically started within seconds!

---

## Alternative: Manual Trigger (If Connection Fails)

If you can't connect GitHub, you can manually trigger builds:

```bash
# In Cloud Shell
cd ~/lifecycle-analysis
git pull origin main
gcloud builds submit --config=cloudbuild.yaml
```

This works but requires manual triggering after each push.

