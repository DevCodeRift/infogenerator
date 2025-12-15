@echo off
title InfoGenerator - Student Session Monitor

cd /d "%~dp0"

if not exist "bin\infogenerator.exe" (
    echo Missing bin\infogenerator.exe
    pause
    exit /b 1
)

cls
echo InfoGenerator - Student Session Monitor
echo ========================================
echo.
echo Webapp: https://infogenerator.vercel.app
echo.
echo Starting in 3 seconds...
timeout /t 3 /nobreak >nul

echo.
echo Monitoring started! Screenshots are being captured...
echo Close this window to stop.
echo ========================================
echo.

bin\infogenerator.exe -stop 2>nul
bin\infogenerator.exe -start -interval 30

echo.
echo Session completed!
pause
