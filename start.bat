@echo off
cd /d "%~dp0"
title Kabaniy Ugolok
echo.
echo  ================================
echo   KABANIY UGOLOK
echo  ================================
echo.
echo  Folder: %cd%
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] Node.js is not installed.
  echo.
  echo  1. Go to https://nodejs.org
  echo  2. Download the green LTS button
  echo  3. Install it
  echo  4. Restart computer
  echo  5. Run this file again
  echo.
  pause
  exit /b 1
)

echo  Node.js found:
node -v
echo.

echo  [1/3] Installing dependencies...
echo  (this can take 1-3 minutes, please wait)
echo.
call npm.cmd install --no-fund --no-audit
echo.

echo  [2/3] Building the app...
call npm.cmd run build
if errorlevel 1 (
  echo.
  echo  [ERROR] Build failed.
  echo  Copy the text above and send it.
  echo.
  pause
  exit /b 1
)

echo.
echo  [3/3] Starting server...
echo.
echo  ========================================
echo   Ready!
echo.
echo   Open in browser:
echo   http://localhost:3000
echo.
echo   Do not close this window.
echo  ========================================
echo.

start "" "http://localhost:3000"

call npm.cmd start

echo.
echo  Server stopped.
pause
