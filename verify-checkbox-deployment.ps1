# Verify Checkbox Code in GitHub and Cloud Build
# This script checks if the checkbox code exists in GitHub and what Cloud Build is using

Write-Host "=== Verification Script ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify code is in GitHub
Write-Host "Step 1: Checking GitHub commit..." -ForegroundColor Yellow
$latestCommit = git log -1 --format="%H %s"
Write-Host "Latest commit: $latestCommit" -ForegroundColor Green

# Check if checkbox code exists in the committed file
Write-Host "`nStep 2: Verifying checkbox code in GitHub..." -ForegroundColor Yellow
$checkboxInGit = git show HEAD:src/components/Phase3Results.jsx | Select-String -Pattern "use-cached-research-checkbox" -Quiet

if ($checkboxInGit) {
    Write-Host "✅ Checkbox code found in GitHub commit!" -ForegroundColor Green
    git show HEAD:src/components/Phase3Results.jsx | Select-String -Pattern "Cache Toggle - Always Visible" -Context 2 | Select-Object -First 5
} else {
    Write-Host "❌ Checkbox code NOT found in GitHub commit!" -ForegroundColor Red
    exit 1
}

# Step 3: Check Cloud Build status (if gcloud is available)
Write-Host "`nStep 3: Checking Cloud Build status..." -ForegroundColor Yellow
$gcloudAvailable = Get-Command gcloud -ErrorAction SilentlyContinue

if ($gcloudAvailable) {
    Write-Host "gcloud CLI found. Checking latest builds..." -ForegroundColor Green
    
    # Get latest build
    $latestBuild = gcloud builds list --limit=1 --format="json" 2>$null | ConvertFrom-Json
    
    if ($latestBuild) {
        Write-Host "Latest Cloud Build:" -ForegroundColor Cyan
        Write-Host "  Build ID: $($latestBuild[0].id)" -ForegroundColor White
        Write-Host "  Status: $($latestBuild[0].status)" -ForegroundColor White
        Write-Host "  Create Time: $($latestBuild[0].createTime)" -ForegroundColor White
        Write-Host "  Source: $($latestBuild[0].source.repoSource.branchName)" -ForegroundColor White
        
        # Try to get commit SHA from substitutions
        $substitutions = $latestBuild[0].substitutions
        if ($substitutions) {
            $commitSha = $substitutions.'COMMIT_SHA'
            if ($commitSha) {
                Write-Host "  Commit SHA: $commitSha" -ForegroundColor White
                
                # Compare with our latest commit
                $currentSha = git rev-parse HEAD
                if ($commitSha -eq $currentSha) {
                    Write-Host "  ✅ Cloud Build is using the latest commit!" -ForegroundColor Green
                } else {
                    Write-Host "  ⚠️ Cloud Build is using an older commit" -ForegroundColor Yellow
                    Write-Host "     Expected: $currentSha" -ForegroundColor Yellow
                    Write-Host "     Actual:   $commitSha" -ForegroundColor Yellow
                }
            }
        }
        
        # Get detailed build info to find commit
        Write-Host "`nChecking build details for commit SHA..." -ForegroundColor Yellow
        $buildDetails = gcloud builds describe $latestBuild[0].id --format="json" 2>$null | ConvertFrom-Json
        $source = $buildDetails.source
        if ($source.repoSource.commitSha) {
            $buildCommitSha = $source.repoSource.commitSha
            Write-Host "Build Commit SHA: $buildCommitSha" -ForegroundColor Cyan
            $currentSha = git rev-parse HEAD
            if ($buildCommitSha -eq $currentSha) {
                Write-Host "✅ Cloud Build used the correct commit!" -ForegroundColor Green
            } else {
                Write-Host "⚠️ Cloud Build used a different commit" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "No builds found or gcloud not authenticated" -ForegroundColor Yellow
    }
} else {
    Write-Host "gcloud CLI not found. Skipping Cloud Build check." -ForegroundColor Yellow
    Write-Host "To check Cloud Build manually:" -ForegroundColor Yellow
    Write-Host "  1. Go to: https://console.cloud.google.com/cloud-build/builds?project=lifecycle-analysis-477518" -ForegroundColor White
    Write-Host "  2. Check the latest build's commit SHA" -ForegroundColor White
    Write-Host "  3. Compare with: git rev-parse HEAD" -ForegroundColor White
}

Write-Host "`n=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Verify Cloud Build trigger fired after your push" -ForegroundColor White
Write-Host "2. Check if latest build used commit: $(git rev-parse HEAD)" -ForegroundColor White
Write-Host "3. After deployment, verify checkbox appears in production" -ForegroundColor White
Write-Host "4. In browser console, search for: 'use-cached-research-checkbox'" -ForegroundColor White



