@echo off
REM InfoGenerator - Silent Background Mode
REM Runs completely hidden, no terminal windows

cd /d "%~dp0"

REM Check if binary exists
if not exist "infogenerator.exe" (
    exit /b 1
)

REM Stop any existing sessions silently
infogenerator.exe -stop >nul 2>&1

REM Start in background mode - completely silent
start /min "" infogenerator.exe -start -interval 30

REM Exit immediately
exit