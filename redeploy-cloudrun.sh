#!/bin/bash
# Quick redeploy script for Cloud Shell

echo "🔄 Redeploying Cloud Run service to pick up secret changes..."

gcloud run services update lifecycle-analysis \
  --region=us-central1 \
  --update-secrets=DATABASE_URL=database-url:latest \
  --project=lifecycle-analysis-477518

echo ""
echo "✅ Service updated. The new secret version will be used."
echo ""
echo "Check logs to verify database connection:"
echo "gcloud run services logs read lifecycle-analysis --limit 50 | grep -i database"

