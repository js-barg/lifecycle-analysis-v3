#!/bin/bash
# Check if DATABASE_URL secret is configured on the service

echo "Checking service configuration for DATABASE_URL secret..."
echo ""

# Check the full service spec
gcloud run services describe lifecycle-analysis \
  --region=us-central1 \
  --format="yaml" | grep -B 5 -A 30 "containers:" | head -50

echo ""
echo "If DATABASE_URL is not in the env or secrets section, it's not being injected!"

