#!/bin/bash
# Check logs for the failed revision

echo "Checking logs for revision lifecycle-analysis-00008-849..."
echo ""

gcloud run services logs read lifecycle-analysis \
  --region=us-central1 \
  --revision=lifecycle-analysis-00008-849 \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)"

