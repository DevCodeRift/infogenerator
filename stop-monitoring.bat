@echo off
REM Stop InfoGenerator silently

cd /d "%~dp0"

REM Stop any running sessions
infogenerator.exe -stop >nul 2>&1

REM Kill any background processes
taskkill /f /im infogenerator.exe >nul 2>&1

REM Exit silently
exit