#!/bin/bash
# Check logs for Phase 3 initialization errors

echo "Checking recent Cloud Run logs for Phase 3 errors..."
echo ""

gcloud run services logs read lifecycle-analysis \
  --region=us-central1 \
  --limit=100 | grep -i -E "(phase.*3|initialize|error|fail|database|phase2_jobs)" | tail -30

echo ""
echo "For full logs:"
echo "gcloud run services logs read lifecycle-analysis --region=us-central1 --limit=200"

