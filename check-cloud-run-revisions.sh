#!/bin/bash
# Check Cloud Run revisions to see if there are multiple versions serving different files

echo "=== Checking Cloud Run Revisions ==="
echo ""

echo "All revisions:"
gcloud run revisions list --service=lifecycle-analysis --region=us-central1 --format="table(metadata.name,status.conditions[0].status,metadata.creationTimestamp)" | head -10

echo ""
echo "Active/Latest revision:"
LATEST_REV=$(gcloud run services describe lifecycle-analysis --region=us-central1 --format="value(status.latestReadyRevisionName)")
echo "Latest: $LATEST_REV"

echo ""
echo "Checking revision details:"
gcloud run revisions describe $LATEST_REV --region=us-central1 --format="yaml" | grep -E "name:|image:|creationTimestamp" | head -10

echo ""
echo "=== If Multiple Revisions ==="
echo "You might need to ensure traffic goes to the latest revision:"
echo "gcloud run services update-traffic lifecycle-analysis --to-latest --region=us-central1"

