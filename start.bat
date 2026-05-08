@echo off
title ERP System
color 0A
echo.
echo ============================================
echo  نظام إدارة المطبعة والوكالة الإعلانية
echo  ERP System - Print Press ^& Advertising
echo ============================================
echo.

:: المسار المباشر لـ Node.js
set "NODE_CMD=C:\nodejs\node-v20.18.0-win-x64\node.exe"

:: تحقق من وجود Node.js
if not exist "%NODE_CMD%" (
  where node >nul 2>nul
  if errorlevel 1 (
    echo [خطأ] Node.js غير موجود!
    echo الرجاء تثبيت Node.js من: https://nodejs.org
    echo.
    pause
    exit /b
  )
  set "NODE_CMD=node"
)

echo [1/3] تجهيز قواعد البيانات...
cd /d D:\printerapp\server
if exist "init-dbs.js" (
  "%NODE_CMD%" init-dbs.js >nul 2>nul
)
echo       تم التجهيز.

echo [2/3] بدء تشغيل الخادم...
echo.
echo      ╔══════════════════════════════════╗
echo      ║  انتظر حتى يظهر ⬇                ║
echo      ║  "ERP System is running!"        ║
echo      ╚══════════════════════════════════╝
echo.

:: فتح المتصفح بعد 3 ثواني
start /b "" cmd /c timeout /t 3 /nobreak ^>nul ^& start http://localhost:5000

:: تشغيل السيرفر
"%NODE_CMD%" index.js

pause
