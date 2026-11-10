# SIGNAL dev stack: docker -> postgres -> backend jar -> frontend, in order, idempotent.
# Everything already up is skipped, so re-running is safe. Pair with stop-dev.ps1.
# Usage: pwsh -File scripts/start-dev.ps1 [-Browser]
#Requires -Version 5.1
param([switch]$Browser)
$ErrorActionPreference = "Stop"

$Root = Split-Path $PSScriptRoot -Parent
$Logs = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Force -Path $Logs | Out-Null
$pidsFile = Join-Path $PSScriptRoot "dev-pids.json"

function Test-HttpUp([string]$Url) {
    try { $r = Invoke-WebRequest $Url -TimeoutSec 3 -UseBasicParsing; return $r.StatusCode -lt 500 }
    catch { return $false }
}

function Wait-Up([string]$Name, [scriptblock]$Probe, [int]$Seconds) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        try { if (& $Probe) { return $true } } catch {}
        Start-Sleep -Seconds 3
    }
    return $false
}

function Test-PortUp([int]$Port) {
    return ($null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue))
}

Write-Host "== 1/4 Docker daemon =="
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    $dd = "C:\Users\lsj\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe"
    if (-not (Test-Path $dd)) { $dd = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe" }
    if (Test-Path $dd) {
        Write-Host "  Docker Desktop not running - starting it (first launch can take a minute)"
        Start-Process $dd | Out-Null
        $ok = Wait-Up "docker daemon" { docker info *> $null; $LASTEXITCODE -eq 0 } 180
        if (-not $ok) { Write-Warning "Docker daemon did not come up in 3 min - start Docker Desktop manually and re-run."; exit 1 }
    } else {
        Write-Warning "Docker Desktop not found - install it or start it manually."; exit 1
    }
}
Write-Host "  daemon UP"

Write-Host "== 2/4 PostgreSQL =="
$postgresUp = $false
docker inspect signal-postgres *> $null
if ($LASTEXITCODE -eq 0) {
    docker start signal-postgres *> $null
} else {
    Write-Host "  container missing - creating from docker-compose.yml"
    docker compose -f (Join-Path $Root "docker-compose.yml") up -d *> $null
}
if (Wait-Up "postgres healthy" { (docker inspect --format "{{.State.Health.Status}}" signal-postgres 2>$null) -eq "healthy" } 120) {
    $postgresUp = $true; Write-Host "  signal-postgres healthy"
} else {
    Write-Warning "postgres not healthy after 2 min - check: docker logs signal-postgres"; exit 1
}

Write-Host "== 3/4 Backend (:8080) =="
$backendLog = Join-Path $Logs "backend.log"
if (Test-PortUp 8080) {
    Write-Host "  already running (port 8080 busy) - skipping"
} else {
    $jar = Join-Path $Root "backend\target\signal-0.0.1-SNAPSHOT.jar"
    if (-not (Test-Path $jar)) {
        Write-Host "  jar missing - packaging (skipTests, takes a while)..."
        Push-Location (Join-Path $Root "backend")
        ./mvnw -q package -DskipTests
        if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Warning "backend packaging failed"; exit 1 }
        Pop-Location
    }
    $proc = Start-Process -FilePath "java" -ArgumentList "-jar", "`"$jar`"" `
        -WorkingDirectory (Join-Path $Root "backend") -WindowStyle Hidden `
        -RedirectStandardOutput $backendLog -RedirectStandardError (Join-Path $Logs "backend.err.log") -PassThru
    Write-Host "  PID $($proc.Id) started, log: $backendLog"
}
if (-not (Wait-Up "backend health" { (Test-HttpUp "http://localhost:8080/actuator/health") } 120)) {
    Write-Warning "backend did not become UP - last log lines:"; Get-Content $backendLog -Tail 15 -ErrorAction SilentlyContinue; exit 1
}
Write-Host ("  health: " + (Invoke-RestMethod "http://localhost:8080/actuator/health" -TimeoutSec 3).status)

Write-Host "== 4/4 Frontend (:3000) =="
$frontendLog = Join-Path $Logs "frontend.log"
if (Test-PortUp 3000) {
    Write-Host "  already running (port 3000 busy) - skipping (restart it manually if you rebuilt .next)"
} else {
    if (-not (Test-Path (Join-Path $Root "frontend\.next\BUILD_ID"))) {
        Write-Host "  .next missing - building (takes a while)..."
        Push-Location (Join-Path $Root "frontend")
        npm run build
        if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Warning "frontend build failed"; exit 1 }
        Pop-Location
    }
    $proc = Start-Process -FilePath "npm.cmd" -ArgumentList "start" `
        -WorkingDirectory (Join-Path $Root "frontend") -WindowStyle Hidden `
        -RedirectStandardOutput $frontendLog -RedirectStandardError (Join-Path $Logs "frontend.err.log") -PassThru
    Write-Host "  PID $($proc.Id) started, log: $frontendLog"
    if (-not (Wait-Up "frontend" { Test-HttpUp "http://localhost:3000" } 90)) {
        Write-Warning "frontend not reachable - last log lines:"; Get-Content $frontendLog -Tail 15 -ErrorAction SilentlyContinue; exit 1
    }
}
Write-Host "  UP"

@{ startedAt = (Get-Date).ToString("o"); postgres = $postgresUp } |
    ConvertTo-Json | Set-Content $pidsFile -Encoding utf8

Write-Host ""
Write-Host "  SIGNAL dev stack is up."
Write-Host "    Frontend     http://localhost:3000  (one-click login: /login-now.html)"
Write-Host "    Backend      http://localhost:8080/api"
Write-Host "    Seeded acct  backend\target\.learn.json (dev-learn-...@example.com)"
Write-Host "    Stop         pwsh -File scripts/stop-dev.ps1"
if ($Browser) { Start-Process "http://localhost:3000/login-now.html" }
