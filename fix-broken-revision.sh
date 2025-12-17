#!/bin/bash
# Delete the broken revision so Cloud Run creates a new one

echo "Deleting broken revision lifecycle-analysis-00008-849..."
gcloud run revisions delete lifecycle-analysis-00008-849 \
  --service=lifecycle-analysis \
  --region=us-central1 \
  --quiet

echo ""
echo "✅ Broken revision deleted. Next deployment will create a new revision."
echo ""
echo "Now trigger a new build or wait for the next automatic build."

