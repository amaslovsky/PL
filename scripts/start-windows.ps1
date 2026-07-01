$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
docker compose up -d --build
Write-Host "PL is starting at http://localhost:8000"
