#!/bin/bash
# Trigger a new build to deploy latest code with secrets

echo "Triggering new build to deploy latest code..."
echo "This will build and deploy with DATABASE_URL secret configured."
echo ""

# Trigger build from cloudbuild.yaml
gcloud builds submit --config=cloudbuild.yaml

echo ""
echo "Build triggered. Check the build logs above for any errors."
echo ""
echo "After build completes, check logs:"
echo "gcloud run services logs read lifecycle-analysis --region=us-central1 --limit=100 | grep -i -E '(DATABASE_URL|🔍|📊|❌)' | head -20"

