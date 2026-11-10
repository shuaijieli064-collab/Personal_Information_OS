@echo off
rem Double-click launcher -> scripts\stop-dev.ps1 (stops frontend/backend processes + postgres container)
cd /d "%~dp0"
where pwsh >nul 2>nul
if %errorlevel%==0 (
    pwsh -NoProfile -ExecutionPolicy Bypass -File "scripts\stop-dev.ps1" %*
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\stop-dev.ps1" %*
)
echo.
pause
