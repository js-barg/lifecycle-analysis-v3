#!/bin/bash
# Fix the database-url secret by removing trailing newline

echo "🔧 Fixing database-url secret (removing trailing newline)..."

# Use printf instead of echo to avoid adding newline
printf "postgresql://postgres:labyrinth@/lifecycle_db?host=/cloudsql/lifecycle-analysis-477518:us-central1:lifecycle-db&sslmode=disable" | \
  gcloud secrets versions add database-url --data-file=-

echo ""
echo "✅ Secret updated without trailing newline"
echo ""
echo "Now redeploy the service:"
echo "gcloud run services update lifecycle-analysis --region=us-central1 --update-secrets=DATABASE_URL=database-url:latest"

