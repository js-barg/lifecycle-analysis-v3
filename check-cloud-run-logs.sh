#!/bin/bash
# Script to check Cloud Run logs for Phase 3 initialization errors

echo "Checking Cloud Run logs for Phase 3 initialization..."
echo ""

# Get recent logs
gcloud run services logs read lifecycle-analysis \
  --limit 100 \
  --format="table(timestamp,severity,textPayload)" \
  | grep -i -E "(phase|error|fail|phase2_jobs|initialize)" \
  | head -50

echo ""
echo "For more detailed logs, run:"
echo "gcloud run services logs read lifecycle-analysis --limit 200"

