#!/bin/bash
# Script to update the DATABASE_URL secret for Cloud Run with Cloud SQL Unix socket connection

# Set your project details
PROJECT_ID="lifecycle-analysis-477518"
REGION="us-central1"
INSTANCE_NAME="lifecycle-db"
DB_NAME="lifecycle_db"
DB_USER="postgres"
DB_PASSWORD="labyrinth"

# Construct the Cloud SQL Unix socket connection string
# Format: postgresql://user:password@/database?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME&sslmode=disable
CONNECTION_STRING="postgresql://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${PROJECT_ID}:${REGION}:${INSTANCE_NAME}&sslmode=disable"

echo "Updating DATABASE_URL secret with Cloud SQL Unix socket connection..."
echo "Connection string format: postgresql://user:password@/database?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME&sslmode=disable"
echo ""

# Update the secret
echo "$CONNECTION_STRING" | gcloud secrets versions add database-url --data-file=-

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully updated DATABASE_URL secret!"
    echo ""
    echo "The secret now uses the Cloud SQL Unix socket connection format."
    echo "You may need to redeploy your Cloud Run service for the changes to take effect."
    echo ""
    echo "To redeploy, run:"
    echo "  gcloud builds submit --config=cloudbuild.yaml"
else
    echo ""
    echo "❌ Failed to update secret. Please check:"
    echo "   1. You have permission to update secrets"
    echo "   2. The secret 'database-url' exists"
    echo "   3. You're authenticated with gcloud"
fi
