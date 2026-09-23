param(
  [switch]$SkipFrontend,
  [switch]$SkipBackend
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "==> CodeGuard AI setup" -ForegroundColor Cyan

if (-not $SkipBackend) {
  Write-Host "`n==> Backend deps" -ForegroundColor Cyan
  Push-Location backend
  if (-not (Test-Path ".venv")) {
    python -m venv .venv
  }
  $py = Join-Path (Get-Location) ".venv\Scripts\python.exe"
  & $py -m pip install --upgrade pip
  & $py -m pip install -r requirements.txt
  if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created backend/.env from .env.example — edit DATABASE_URL if needed" -ForegroundColor Yellow
  }
  Pop-Location
}

if (-not $SkipFrontend) {
  Write-Host "`n==> Frontend deps" -ForegroundColor Cyan
  Push-Location frontend
  if (Test-Path "package-lock.json") {
    npm.cmd ci
  } else {
    npm.cmd install
  }
  Pop-Location
}

Write-Host "`nSetup complete." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  .\scripts\dev.ps1          # start backend + frontend"
Write-Host "  .\scripts\test.ps1         # fast tests + frontend build"
Write-Host "  docker compose up --build  # full stack with local Postgres"
