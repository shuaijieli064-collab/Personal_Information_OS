# SIGNAL dev stack teardown: stop frontend/backend (by listening port, so no node/java
# orphans are left behind), then the postgres container. Leaves Docker Desktop running.
# Usage: pwsh -File scripts/stop-dev.ps1
#Requires -Version 5.1
$ErrorActionPreference = "SilentlyContinue"

foreach ($port in 3000, 8080) {
    $pids = Get-NetTCPConnection -LocalPort $port -State Listen | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
        $name = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName
        if ($name -in "node", "next", "npm", "cmd", "pwsh", "powershell", "java") {
            Stop-Process -Id $procId -Force
            Write-Host "stopped $name (PID $procId, port $port)"
        } elseif ($name) {
            Write-Warning "port $port held by '$name' (PID $procId) - not a dev-stack process, left untouched"
        }
    }
}

docker stop signal-postgres | Out-Null
Write-Host "signal-postgres stopped (Docker Desktop left running)"

Remove-Item (Join-Path $PSScriptRoot "dev-pids.json") -ErrorAction SilentlyContinue
