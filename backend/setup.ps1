# PowerShell commands to set up Phase 2 data persistence
# Run these commands from your project root directory

Write-Host "Setting up Phase 2 data persistence directories..." -ForegroundColor Green

# Create data directory if it doesn't exist
New-Item -Path "backend\data" -ItemType Directory -Force

# Create empty filters.json file if it doesn't exist
$filtersPath = "backend\data\filters.json"
if (-not (Test-Path $filtersPath)) {
    "{}" | Out-File -FilePath $filtersPath -Encoding UTF8
    Write-Host "Created filters.json file" -ForegroundColor Yellow
}

# Add data directory to .gitignore if not already there
$gitignorePath = "backend\.gitignore"
if (Test-Path $gitignorePath) {
    $gitignoreContent = Get-Content $gitignorePath
    if ($gitignoreContent -notcontains "data/") {
        Add-Content -Path $gitignorePath -Value "data/"
        Write-Host "Added data/ to .gitignore" -ForegroundColor Yellow
    }
} else {
    "data/" | Out-File -FilePath $gitignorePath -Encoding UTF8
    Write-Host "Created .gitignore with data/ entry" -ForegroundColor Yellow
}

Write-Host "Setup complete! Data directory structure created." -ForegroundColor Green
Write-Host "Location: backend\data\" -ForegroundColor Cyan
Write-Host "Filters will be persisted in: backend\data\filters.json" -ForegroundColor Cyan