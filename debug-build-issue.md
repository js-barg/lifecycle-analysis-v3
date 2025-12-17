# Debug Build Failure

## Check Latest Build

**In Cloud Shell, run:**
```bash
# Check if new build ran
gcloud builds list --limit=3 --format="table(id,status,createTime,source.repoSource.branchName)"

# Check latest logs
gcloud run services logs read lifecycle-analysis \
  --region=us-central1 \
  --limit=50 | tail -30
```

## Possible Issues

1. **Build is using cached Docker layers** - The new code might not be in the image
2. **Same revision being reused** - Cloud Run might be trying to update the broken revision
3. **Different error** - The new code might have a different issue

## Solution: Force New Revision

If Cloud Build keeps trying to update the broken revision, we can:

1. **Delete the broken revision** (optional):
```bash
gcloud run revisions delete lifecycle-analysis-00008-849 \
  --region=us-central1 \
  --quiet
```

2. **Or just wait for a new build** - The next successful build will create a new revision

## Check What's Actually Deployed

Check if the new code is in the image:
```bash
# Get the latest build details
gcloud builds list --limit=1 --format="yaml" | grep -A 5 "source"
```

## Alternative: Check Logs via Console

Go directly to the logs URL from the error:
https://console.cloud.google.com/logs/viewer?project=lifecycle-analysis-477518&resource=cloud_run_revision/service_name/lifecycle-analysis/revision_name/lifecycle-analysis-00008-849

This will show the exact error happening in that revision.

