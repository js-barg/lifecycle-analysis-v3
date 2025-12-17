#!/bin/bash
# Verify DATABASE_URL secret is set on Cloud Run service

echo "Checking if DATABASE_URL secret is configured on Cloud Run service..."
echo ""

# Check service configuration
gcloud run services describe lifecycle-analysis \
  --region=us-central1 \
  --format="yaml" | grep -A 10 -i "secret\|env"

echo ""
echo "If DATABASE_URL is not listed, the secret is not being injected!"
echo ""
echo "To fix, update the service to include the secret:"
echo "gcloud run services update lifecycle-analysis --region=us-central1 --update-secrets=DATABASE_URL=database-url:latest"

