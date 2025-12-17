#!/bin/bash
# Check revision status and force a new deployment

echo "Checking current revisions..."
gcloud run revisions list --service=lifecycle-analysis --region=us-central1

echo ""
echo "Checking service status..."
gcloud run services describe lifecycle-analysis \
  --region=us-central1 \
  --format="value(status.latestReadyRevisionName,status.latestCreatedRevisionName)"

echo ""
echo "If revision 00008-849 still exists, we may need to force a new deployment with a different image tag."


