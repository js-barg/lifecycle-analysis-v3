# PowerShell script to update the DATABASE_URL secret for Cloud Run with Cloud SQL Unix socket connection

# Set your project details
$PROJECT_ID = "lifecycle-analysis-477518"
$REGION = "us-central1"
$INSTANCE_NAME = "lifecycle-db"
$DB_NAME = "lifecycle_db"
$DB_USER = "postgres"
$DB_PASSWORD = "labyrinth"

# Construct the Cloud SQL Unix socket connection string
# Format: postgresql://user:password@/database?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME&sslmode=disable
$CONNECTION_STRING = "postgresql://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${PROJECT_ID}:${REGION}:${INSTANCE_NAME}&sslmode=disable"

Write-Host "Updating DATABASE_URL secret with Cloud SQL Unix socket connection..." -ForegroundColor Cyan
Write-Host "Connection string format: postgresql://user:password@/database?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME&sslmode=disable"
Write-Host ""

# Update the secret
$CONNECTION_STRING | gcloud secrets versions add database-url --data-file=-

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Successfully updated DATABASE_URL secret!" -ForegroundColor Green
    Write-Host ""
    Write-Host "The secret now uses the Cloud SQL Unix socket connection format."
    Write-Host "You may need to redeploy your Cloud Run service for the changes to take effect."
    Write-Host ""
    Write-Host "To redeploy, run:" -ForegroundColor Yellow
    Write-Host "  gcloud builds submit --config=cloudbuild.yaml"
} else {
    Write-Host ""
    Write-Host "❌ Failed to update secret. Please check:" -ForegroundColor Red
    Write-Host "   1. You have permission to update secrets"
    Write-Host "   2. The secret 'database-url' exists"
    Write-Host "   3. You're authenticated with gcloud"
}
