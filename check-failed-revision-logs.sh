#!/bin/bash
# Check logs for the failed revision to see the actual error

echo "Checking logs for failed revision lifecycle-analysis-00008-849..."
echo ""

gcloud run services logs read lifecycle-analysis \
  --region=us-central1 \
  --revision=lifecycle-analysis-00008-849 \
  --limit=100 \
  --format="table(timestamp,severity,textPayload)" | grep -i -E "(error|fail|exception|url|database|invalid|typeerror)" | head -30

echo ""
echo "For full logs, run:"
echo "gcloud run services logs read lifecycle-analysis --region=us-central1 --revision=lifecycle-analysis-00008-849 --limit=100"

