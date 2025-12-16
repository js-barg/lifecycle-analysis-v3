#!/bin/bash
# Setup Gemini API Key in Google Secret Manager for Cloud Run

set -e

PROJECT_ID=${PROJECT_ID:-"lifecycle-analysis-477518"}
GEMINI_API_KEY="AIzaSyBYrz6CYFVbqlwJs8gwMvxZIC8IX__2cXY"

echo "🔧 Setting up Gemini API key secret for Cloud Run..."
echo "Project ID: $PROJECT_ID"

# Get project number
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)" 2>/dev/null)
if [ -z "$PROJECT_NUMBER" ]; then
    echo "❌ Error: Could not get project number. Make sure you're authenticated:"
    echo "   gcloud auth login"
    exit 1
fi

echo "Project Number: $PROJECT_NUMBER"

# Create or update the secret
echo "📝 Creating/updating gemini-api-key secret..."
echo -n "$GEMINI_API_KEY" | \
  gcloud secrets create gemini-api-key \
    --project=$PROJECT_ID \
    --data-file=- 2>/dev/null || \
  echo -n "$GEMINI_API_KEY" | \
    gcloud secrets versions add gemini-api-key \
      --project=$PROJECT_ID \
      --data-file=-

echo "✅ Secret created/updated"

# Grant Cloud Run service account access
echo "🔐 Granting Cloud Run access to secret..."
gcloud secrets add-iam-policy-binding gemini-api-key \
  --project=$PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet

echo "✅ Access granted"

echo ""
echo "🎉 Setup complete! The secret is now configured for Cloud Run."
echo ""
echo "Next steps:"
echo "1. The cloudbuild.yaml has been updated to include GEMINI_API_KEY"
echo "2. Deploy your application - the secret will be automatically injected"
echo "3. Verify in Cloud Run logs that the API key is being read correctly"
echo ""

