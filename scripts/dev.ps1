param(
  [int]$BackendPort = 8001,
  [int]$FrontendPort = 5173
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$venvPython = Join-Path $backendDir ".venv\Scripts\python.exe"
$python = if (Test-Path $venvPython) { $venvPython } else { "python" }

if (-not (Test-Path (Join-Path $backendDir ".env"))) {
  Copy-Item (Join-Path $backendDir ".env.example") (Join-Path $backendDir ".env")
  Write-Host "Created backend/.env from example" -ForegroundColor Yellow
}

Write-Host "==> Starting backend :$BackendPort" -ForegroundColor Cyan
$backend = Start-Process -FilePath $python -ArgumentList @(
  "-m", "uvicorn", "app.main:app",
  "--host", "127.0.0.1",
  "--port", "$BackendPort",
  "--reload"
) -WorkingDirectory $backendDir -PassThru -WindowStyle Minimized

Write-Host "==> Starting frontend :$FrontendPort" -ForegroundColor Cyan
$frontend = Start-Process -FilePath "npm.cmd" -ArgumentList @(
  "run", "dev", "--", "--port", "$FrontendPort"
) -WorkingDirectory $frontendDir -PassThru -WindowStyle Minimized

Write-Host ""
Write-Host "Backend:  http://127.0.0.1:$BackendPort/api/health" -ForegroundColor Green
Write-Host "Swagger:  http://127.0.0.1:$BackendPort/docs" -ForegroundColor Green
Write-Host "Frontend: http://127.0.0.1:$FrontendPort" -ForegroundColor Green
Write-Host ""
Write-Host "PIDs backend=$($backend.Id) frontend=$($frontend.Id)"
Write-Host "Stop with: .\scripts\stop.ps1"

$backend.Id | Set-Content (Join-Path $root ".backend.pid")
$frontend.Id | Set-Content (Join-Path $root ".frontend.pid")
