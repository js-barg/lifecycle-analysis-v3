#!/bin/bash
# Verify DATABASE_URL secret is now set

echo "Checking if DATABASE_URL secret is configured..."
echo ""

# Check service configuration for secrets
gcloud run services describe lifecycle-analysis \
  --region=us-central1 \
  --format="yaml" | grep -B 5 -A 15 "secrets:"

echo ""
echo "Checking startup logs (should show DATABASE_URL debug info)..."
gcloud run services logs read lifecycle-analysis \
  --region=us-central1 \
  --limit=100 | grep -i -E "(DATABASE_URL|Database connection|📊|❌)" | head -20

