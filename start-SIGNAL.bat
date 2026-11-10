@echo off
rem Double-click launcher -> scripts\start-dev.ps1 (docker -> postgres -> backend -> frontend, idempotent)
cd /d "%~dp0"
where pwsh >nul 2>nul
if %errorlevel%==0 (
    pwsh -NoProfile -ExecutionPolicy Bypass -File "scripts\start-dev.ps1" %*
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\start-dev.ps1" %*
)
echo.
echo Close the servers: double-click "stop-SIGNAL.bat" - or just leave them running and close nothing.
pause
