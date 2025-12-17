#!/bin/bash
# Check the latest error in Cloud Run logs

echo "Checking latest Cloud Run logs for errors..."
echo ""

gcloud run services logs read lifecycle-analysis \
  --region=us-central1 \
  --limit=50 | grep -i -E "(error|fail|exception|url|database|invalid|typeerror|crash)" | tail -20

echo ""
echo "For full logs, check:"
echo "https://console.cloud.google.com/logs/query?project=lifecycle-analysis-477518"

