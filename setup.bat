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

:: ---- Check npm ----
npm --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] npm is not available. Please reinstall Node.js.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('npm --version') do set NPM_VER=%%v
echo  [OK] npm %NPM_VER% found.
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
