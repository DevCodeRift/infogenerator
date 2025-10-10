@echo off
REM Stop any existing session and start fresh

title InfoGenerator - Clean Start

cd /d "%~dp0"

echo 🔄 Stopping any existing sessions...
infogenerator.exe -stop

echo 🚀 Starting fresh session...
start-monitoring.bat