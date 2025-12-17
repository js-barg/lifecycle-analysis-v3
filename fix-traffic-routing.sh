#!/bin/bash
# Route traffic away from broken revision, then delete it

echo "Checking current traffic allocation..."
gcloud run services describe lifecycle-analysis \
  --region=us-central1 \
  --format="value(status.traffic)"

echo ""
echo "Routing 100% traffic to the working revision (lifecycle-analysis-00007-977)..."
gcloud run services update-traffic lifecycle-analysis \
  --region=us-central1 \
  --to-revisions=lifecycle-analysis-00007-977=100

echo ""
echo "Waiting 5 seconds..."
sleep 5

echo ""
echo "Now deleting the broken revision..."
gcloud run revisions delete lifecycle-analysis-00008-849 \
  --region=us-central1 \
  --quiet

echo ""
echo "✅ Done! Broken revision deleted. Next deployment will create a new revision."


