#!/bin/bash
# Correct way to check Cloud Run logs

echo "Checking recent Cloud Run logs for errors..."
echo ""

# Check recent logs and filter for errors
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=lifecycle-analysis AND resource.labels.revision_name=lifecycle-analysis-00008-849" \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)" \
  --project=lifecycle-analysis-477518

echo ""
echo "Or check all recent logs:"
echo "gcloud run services logs read lifecycle-analysis --region=us-central1 --limit=100"

