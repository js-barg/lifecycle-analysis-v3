Write-Host "=== Restarting Lifecycle Analysis System ===" -ForegroundColor Cyan

# Ensure PostgreSQL is running
Write-Host "1. Starting PostgreSQL..." -ForegroundColor Yellow
try {
    Start-Service -Name "postgresql-x64-16" -ErrorAction SilentlyContinue
    Write-Host "   PostgreSQL is running" -ForegroundColor Green
} catch {
    Write-Host "   PostgreSQL may already be running" -ForegroundColor Yellow
}

# Start Backend
Write-Host "2. Starting Backend Server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\development\lifecycle-analysis\backend; Write-Host 'Starting Backend on port 3001...' -ForegroundColor Cyan; npm start"

# Wait for backend to initialize
Start-Sleep -Seconds 3

# Test backend
Write-Host "3. Testing Backend..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3001/health" -ErrorAction Stop
    Write-Host "   Backend is healthy" -ForegroundColor Green
} catch {
    Write-Host "   Backend not responding yet, may still be starting..." -ForegroundColor Yellow
}

# Start Frontend
Write-Host "4. Starting Frontend Server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\development\lifecycle-analysis; Write-Host 'Starting Frontend on port 5173...' -ForegroundColor Cyan; npm run dev"

# Wait for frontend to initialize
Start-Sleep -Seconds 3

# Open browser
Write-Host "5. Opening Application..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
Start-Process "http://localhost:5173"

Write-Host "=== System Started Successfully ===" -ForegroundColor Green
Write-Host "Backend:  http://localhost:3001" -ForegroundColor Gray
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Gray
Write-Host "Press Ctrl+C in each window to stop servers" -ForegroundColor Yellow
