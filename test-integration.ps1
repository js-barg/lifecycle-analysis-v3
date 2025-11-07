# PowerShell script to test Phase 1 integration
# Run this from C:\development\lifecycle-analysis\

Write-Host "=== Lifecycle Analysis Phase 1 Integration Test ===" -ForegroundColor Cyan

# Test 1: Check if backend is running
Write-Host "`nTest 1: Checking backend health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method Get
    Write-Host "✓ Backend is healthy: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "✗ Backend is not responding. Start it with: cd backend && node src/server.js" -ForegroundColor Red
    exit 1
}

# Test 2: Check if frontend proxy works
Write-Host "`nTest 2: Testing frontend proxy..." -ForegroundColor Yellow
try {
    $proxyHealth = Invoke-RestMethod -Uri "http://localhost:5173/api/health" -Method Get
    Write-Host "✓ Frontend proxy is working" -ForegroundColor Green
} catch {
    Write-Host "✗ Frontend proxy not working. Check vite.config.js" -ForegroundColor Red
}

# Test 3: Test file upload with curl (if available)
Write-Host "`nTest 3: Testing file upload endpoint..." -ForegroundColor Yellow
$testFile = "test.csv"
if (Test-Path $testFile) {
    Write-Host "Found test.csv, attempting upload..." -ForegroundColor Gray
    
    # Create form data
    $boundary = [System.Guid]::NewGuid().ToString()
    $filePath = Get-Item $testFile
    $fileBytes = [System.IO.File]::ReadAllBytes($filePath.FullName)
    
    $bodyLines = @(
        "--$boundary",
        "Content-Disposition: form-data; name=`"file`"; filename=`"$($filePath.Name)`"",
        "Content-Type: text/csv",
        "",
        [System.Text.Encoding]::UTF8.GetString($fileBytes),
        "--$boundary",
        "Content-Disposition: form-data; name=`"customerName`"",
        "",
        "Test Company",
        "--$boundary--"
    )
    
    $body = $bodyLines -join "`r`n"
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/api/phase1/upload" `
            -Method POST `
            -ContentType "multipart/form-data; boundary=$boundary" `
            -Body $body
        
        $result = $response.Content | ConvertFrom-Json
        Write-Host "✓ Upload successful! Job ID: $($result.job_id)" -ForegroundColor Green
        
        # Test status check
        Start-Sleep -Seconds 2
        Write-Host "`nChecking job status..." -ForegroundColor Gray
        $status = Invoke-RestMethod -Uri "http://localhost:3001/api/phase1/status/$($result.job_id)" -Method Get
        Write-Host "Job Status: $($status.status)" -ForegroundColor Cyan
        
    } catch {
        Write-Host "✗ Upload failed: $_" -ForegroundColor Red
    }
} else {
    Write-Host "test.csv not found. Create one to test upload." -ForegroundColor Yellow
}

# Test 4: Check PostgreSQL connection
Write-Host "`nTest 4: Checking database connection..." -ForegroundColor Yellow
$pgService = Get-Service -Name "postgresql-x64-16" -ErrorAction SilentlyContinue
if ($pgService) {
    if ($pgService.Status -eq "Running") {
        Write-Host "✓ PostgreSQL is running" -ForegroundColor Green
    } else {
        Write-Host "✗ PostgreSQL is not running. Start with: Start-Service -Name 'postgresql-x64-16'" -ForegroundColor Red
    }
} else {
    Write-Host "? PostgreSQL service not found. Check installation." -ForegroundColor Yellow
}

# Summary
Write-Host "`n=== Integration Test Summary ===" -ForegroundColor Cyan
Write-Host "Backend URL: http://localhost:3001" -ForegroundColor Gray
Write-Host "Frontend URL: http://localhost:5173" -ForegroundColor Gray
Write-Host "API Endpoint: http://localhost:3001/api/phase1/upload" -ForegroundColor Gray

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Make sure PostgreSQL is running" -ForegroundColor Gray
Write-Host "2. Start backend: cd backend && npm start" -ForegroundColor Gray
Write-Host "3. Start frontend: npm run dev" -ForegroundColor Gray
Write-Host "4. Upload a CSV file through the UI" -ForegroundColor Gray
Write-Host "5. Click 'Phase 1: Basic Analysis' button" -ForegroundColor Gray