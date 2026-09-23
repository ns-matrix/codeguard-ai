param(
  [switch]$SkipBackend,
  [switch]$SkipFrontend
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

foreach ($name in @(".backend.pid", ".frontend.pid")) {
  $path = Join-Path $root $name
  if (Test-Path $path) {
    $id = (Get-Content $path | Select-Object -First 1).Trim()
    if ($id -match '^\d+$') {
      $p = Get-Process -Id $id -ErrorAction SilentlyContinue
      if ($p) {
        Write-Host "Stopping $name PID $id ($($p.ProcessName))"
        Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
      }
    }
    Remove-Item $path -Force -ErrorAction SilentlyContinue
  }
}

if (-not $SkipBackend) {
  Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -match 'uvicorn.*app\.main:app'
  } | ForEach-Object {
    Write-Host "Stopping uvicorn PID $($_.ProcessId)"
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

if (-not $SkipFrontend) {
  Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -match 'vite|npm.*run dev'
  } | ForEach-Object {
    Write-Host "Stopping frontend PID $($_.ProcessId)"
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "Stopped." -ForegroundColor Green
