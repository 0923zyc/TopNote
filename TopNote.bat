@echo off
title TopNote Launcher
set "PATH=C:\Users\10405\nodejs-portable\node-v22.23.4-win-x64;%PATH%"
cd /d "%~dp0"

rem ==================================================
rem  TopNote local launcher:
rem  double-click = start backend + open app window
rem  (standalone Edge app window, no address bar)
rem ==================================================

rem 1. If backend is already running, skip; else start it minimized
curl -s -o nul --max-time 2 http://127.0.0.1:3001/api/health
if errorlevel 1 (
  start "TopNote Service" /min cmd /c "node src\index.js"
)

rem 2. Wait until backend is ready (max ~25s)
set /a tries=0
:wait_ready
ping -n 2 127.0.0.1 >nul
curl -s -o nul --max-time 2 http://127.0.0.1:3001/api/health
if errorlevel 1 (
  set /a tries+=1
  if %tries% lss 25 goto wait_ready
  echo [ERROR] Backend not ready in 25s. Check Node environment.
  pause
  exit /b 1
)

rem 3. Read actual port (auto-probed 3001-3010) and open the app window
set /p PORT=<server\.port
start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://127.0.0.1:%PORT%

exit /b 0
