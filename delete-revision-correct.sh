#!/bin/bash
# Correct command to delete a Cloud Run revision

echo "Deleting broken revision lifecycle-analysis-00008-849..."

gcloud run revisions delete lifecycle-analysis-00008-849 \
  --region=us-central1 \
  --quiet

echo ""
echo "✅ Revision deleted. Next deployment will create a new revision."

