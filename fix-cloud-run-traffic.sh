#!/bin/bash
# Fix Cloud Run to serve the latest revision

echo "=== Checking Cloud Run Traffic Configuration ==="
echo ""

SERVICE_NAME="lifecycle-analysis"
REGION="us-central1"

echo "Current traffic configuration:"
gcloud run services describe $SERVICE_NAME --region=$REGION --format="yaml" | grep -A 20 "traffic:"

echo ""
echo "Latest ready revision:"
LATEST_REV=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.latestReadyRevisionName)")
echo "Latest: $LATEST_REV"

echo ""
echo "All revisions:"
gcloud run revisions list --service=$SERVICE_NAME --region=$REGION --format="table(metadata.name,status.conditions[0].status,metadata.creationTimestamp)"

echo ""
echo "=== Fixing Traffic ==="
echo "Forcing all traffic to latest revision..."
gcloud run services update-traffic $SERVICE_NAME \
  --to-latest \
  --region=$REGION

echo ""
echo "✅ Traffic updated to latest revision"
echo ""
echo "Wait 30 seconds, then refresh browser and check again"


