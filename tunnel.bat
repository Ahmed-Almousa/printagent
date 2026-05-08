@echo off
title ERP System - Remote
cd /d "%~dp0"

:: البحث عن Node.js
set "NODE_CMD=C:\nodejs\node-v20.18.0-win-x64\node.exe"
if not exist "%NODE_CMD%" (
  where node >nul 2>nul
  if errorlevel 1 (
    echo [خطأ] Node.js غير موجود!
    pause
    exit /b
  )
  set "NODE_CMD=node"
)

echo ═══════════════════════════════════════
echo    ERP System - Remote Access
echo    Press Ctrl+C to stop
echo ═══════════════════════════════════════

:: Kill old
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: Start server
start /B "" "%NODE_CMD%" server/index.js
timeout /t 4 /nobreak >nul

:: Tunnel
echo.
"%NODE_CMD%" node_modules\localtunnel\bin\lt.js --port 5000

pause
