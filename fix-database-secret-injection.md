# Fix DATABASE_URL Secret Injection

## Problem
The `DATABASE_URL` secret is not being injected into Cloud Run, causing connections to fail with `ECONNREFUSED 127.0.0.1:5432`.

## Solution

### Step 1: Verify Secret is Set on Service

**In Cloud Shell:**
```bash
gcloud run services describe lifecycle-analysis \
  --region=us-central1 \
  --format="yaml" | grep -A 20 "env:\|secrets:"
```

### Step 2: Manually Set the Secret (if missing)

If `DATABASE_URL` is not in the output, set it:

```bash
gcloud run services update lifecycle-analysis \
  --region=us-central1 \
  --update-secrets=DATABASE_URL=database-url:latest
```

### Step 3: Verify It's Set

```bash
gcloud run services describe lifecycle-analysis \
  --region=us-central1 \
  --format="value(spec.template.spec.containers[0].env)"
```

You should see `DATABASE_URL` listed.

### Step 4: Check Logs After Fix

After setting the secret, check logs to see if DATABASE_URL is now being read:

```bash
gcloud run services logs read lifecycle-analysis \
  --region=us-central1 \
  --limit=50 | grep -i "DATABASE_URL"
```

You should see the debug logs showing DATABASE_URL is set.

