param(
  [switch]$SkipBackend,
  [switch]$SkipFrontend,
  [switch]$SkipLint
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$failed = $false

if (-not $SkipBackend) {
  Write-Host "==> Backend fast tests" -ForegroundColor Cyan
  Push-Location (Join-Path $root "backend")
  $venvPython = Join-Path (Get-Location) ".venv\Scripts\python.exe"
  $python = if (Test-Path $venvPython) { $venvPython } else { "python" }
  if (-not $env:TEST_DB_PASSWORD) {
    # Local Postgres password (override with TEST_DB_PASSWORD env var)
    $env:TEST_DB_PASSWORD = "KingMaker"
  }
  & $python -m pytest -q -m "not llm and not integration"
  if ($LASTEXITCODE -ne 0) { $failed = $true }
  Pop-Location
}

if (-not $SkipFrontend) {
  Write-Host "`n==> Frontend typecheck + build" -ForegroundColor Cyan
  Push-Location (Join-Path $root "frontend")
  npm.cmd run build
  if ($LASTEXITCODE -ne 0) { $failed = $true }
  Pop-Location
}

if ($failed) {
  Write-Host "`nTESTS FAILED" -ForegroundColor Red
  exit 1
}

Write-Host "`nAll checks passed." -ForegroundColor Green
