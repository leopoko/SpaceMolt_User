@echo off
cd /d "%~dp0"
setlocal enabledelayedexpansion
title SpaceMolt User Client - Setup
color 0B

echo.
echo  ============================================================
echo   SpaceMolt User Client  ^|  Initial Setup
echo  ============================================================
echo.

:: ---- Check Node.js ----
node --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js is not installed.
    echo.
    echo  Please install Node.js v20 or newer from:
    echo    https://nodejs.org/
    echo.
    echo  After installing, run this setup script again.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo  [OK] Node.js %NODE_VER% found.

:: ---- Resolve npm base dir from npm.cmd (avoid executing npm.cmd) ----
set "NPM_CMD="
for /f "delims=" %%f in ('where npm.cmd 2^>nul') do (
  if not defined NPM_CMD set "NPM_CMD=%%f"
)

if not defined NPM_CMD (
  echo  [ERROR] npm.cmd not found in PATH.
  pause
  exit /b 1
)

set "NPM_DIR=%~dp0"
for %%d in ("%NPM_CMD%") do set "NPM_DIR=%%~dpd"

set "NODE_EXE=%NPM_DIR%node.exe"
if not exist "%NODE_EXE%" (
  :: fallback to whatever 'node' is, but normally node.exe sits next to npm.cmd
  for /f "delims=" %%p in ('node -p "process.execPath" 2^>nul') do set "NODE_EXE=%%p"
)

set "NPM_CLI=%NPM_DIR%node_modules\npm\bin\npm-cli.js"
if not exist "%NPM_CLI%" (
  echo  [ERROR] npm-cli.js not found relative to npm.cmd:
  echo    npm.cmd: %NPM_CMD%
  echo    expected: %NPM_CLI%
  pause
  exit /b 1
)

echo  [OK] Using node: %NODE_EXE%
echo  [OK] Using npm-cli: %NPM_CLI%
echo.

:: ---- Install dependencies ----
echo  Installing dependencies (this may take a few minutes)...
echo.
call npm install
if errorlevel 1 (
    echo.
    echo  [ERROR] npm install failed.
    echo  Check your internet connection and try again.
    echo.
    pause
    exit /b 1
)
echo.
echo  [OK] Dependencies installed.
echo.

:: ---- Build SMUI themes ----
echo  Building SMUI theme stylesheets...
call npm run prepare
if errorlevel 1 (
    echo.
    echo  [ERROR] Theme build failed.
    echo  This may happen if sass or smui-theme is missing.
    echo  Try: npm install sass smui-theme
    echo.
    pause
    exit /b 1
)
echo.
echo  [OK] Themes compiled.
echo.

echo  ============================================================
echo   Setup complete!
echo.
echo   Run  start.bat  to launch the SpaceMolt client.
echo  ============================================================
echo.
pause
