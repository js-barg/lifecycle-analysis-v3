# Setup Gemini API Key in Google Secret Manager for Cloud Run
# PowerShell version for Windows

$PROJECT_ID = if ($env:PROJECT_ID) { $env:PROJECT_ID } else { "lifecycle-analysis-477518" }
$GEMINI_API_KEY = "AIzaSyBYrz6CYFVbqlwJs8gwMvxZIC8IX__2cXY"

Write-Host "🔧 Setting up Gemini API key secret for Cloud Run..." -ForegroundColor Cyan
Write-Host "Project ID: $PROJECT_ID" -ForegroundColor Gray

# Get project number
Write-Host "📊 Getting project number..." -ForegroundColor Yellow
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)" 2>$null

if (-not $PROJECT_NUMBER) {
    Write-Host "❌ Error: Could not get project number. Make sure you're authenticated:" -ForegroundColor Red
    Write-Host "   gcloud auth login" -ForegroundColor Yellow
    exit 1
}

Write-Host "Project Number: $PROJECT_NUMBER" -ForegroundColor Gray

# Create or update the secret
Write-Host "📝 Creating/updating gemini-api-key secret..." -ForegroundColor Yellow
$GEMINI_API_KEY | gcloud secrets create gemini-api-key --project=$PROJECT_ID --data-file=- 2>$null
if ($LASTEXITCODE -ne 0) {
    # Secret exists, add new version
    Write-Host "   Secret exists, adding new version..." -ForegroundColor Gray
    $GEMINI_API_KEY | gcloud secrets versions add gemini-api-key --project=$PROJECT_ID --data-file=-
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Secret created/updated" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to create/update secret" -ForegroundColor Red
    exit 1
}

# Grant Cloud Run service account access
Write-Host "🔐 Granting Cloud Run access to secret..." -ForegroundColor Yellow
$SERVICE_ACCOUNT = "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud secrets add-iam-policy-binding gemini-api-key `
    --project=$PROJECT_ID `
    --member="serviceAccount:$SERVICE_ACCOUNT" `
    --role="roles/secretmanager.secretAccessor" `
    --quiet

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Access granted" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to grant access" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 Setup complete! The secret is now configured for Cloud Run." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. The cloudbuild.yaml has been updated to include GEMINI_API_KEY" -ForegroundColor Gray
Write-Host "2. Deploy your application - the secret will be automatically injected" -ForegroundColor Gray
Write-Host "3. Verify in Cloud Run logs that the API key is being read correctly" -ForegroundColor Gray
Write-Host ""

