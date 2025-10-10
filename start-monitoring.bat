@echo off
REM InfoGenerator - Auto Start Script (Windows)
REM Double-click this file to start monitoring

title InfoGenerator - Student Session Monitor

REM Change to script directory
cd /d "%~dp0"

REM Check if binary exists
if not exist "infogenerator.exe" (
    echo ❌ Missing infogenerator.exe
    echo Please ensure infogenerator.exe is in the same folder as this script.
    pause
    exit /b 1
)

cls
echo 🚀 InfoGenerator - Student Session Monitor
echo ==========================================
echo.
echo ✅ Webapp URL: https://webapp-nfaei5ho8-codedevrifts-projects.vercel.app
echo.
echo 📝 Instructions:
echo    1. This will start capturing screenshots automatically
echo    2. Open the webapp URL above in your browser
echo    3. Watch sessions appear in real-time
echo    4. Add student names when convenient
echo    5. Close this window to stop monitoring
echo.
echo 🎯 Starting session in 3 seconds...
timeout /t 1 /nobreak >nul
echo 🎯 Starting session in 2 seconds...
timeout /t 1 /nobreak >nul
echo 🎯 Starting session in 1 second...
timeout /t 1 /nobreak >nul
echo.
echo 📸 Monitoring started! Screenshots are being captured...
echo 🌐 View live progress at: https://webapp-nfaei5ho8-codedevrifts-projects.vercel.app
echo.
echo 💡 Tip: Leave this window open. Close it when you want to stop.
echo ==================================================================================
echo.

REM Start the monitoring with default settings
infogenerator.exe -start -interval 30

echo.
echo ✅ Session completed!
echo 🌐 Check your webapp for the summary: https://webapp-nfaei5ho8-codedevrifts-projects.vercel.app
echo.
pause