@echo off
setlocal
title SpaceMolt User Client
color 0A

echo.
echo  ============================================================
echo   SpaceMolt User Client
echo  ============================================================
echo.

:: ---- Check Node.js ----
node --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js not found.
    echo  Please run setup.bat first.
    echo.
    pause
    exit /b 1
)

:: ---- Auto-setup if node_modules is missing ----
if not exist "node_modules" (
    echo  [INFO] node_modules not found. Running setup first...
    echo.
    call setup.bat
    if errorlevel 1 (
        pause
        exit /b 1
    )
)

:: ---- Build themes if missing ----
if not exist "static\smui.css" (
    echo  [INFO] SMUI theme not compiled. Building now...
    call npm run prepare
    if errorlevel 1 (
        echo  [ERROR] Theme build failed. Run setup.bat to fix.
        pause
        exit /b 1
    )
    echo  [OK] Themes ready.
    echo.
)

:: ---- Open browser ----
echo  Starting SpaceMolt client...
echo.
echo  The game will open in your browser at:
echo    http://localhost:5173
echo.
echo  If it does not open automatically, navigate there manually.
echo.
echo  Press Ctrl+C to stop the server.
echo.

:: Open browser after a short delay (give Vite time to start)
start "" cmd /c "ping -n 3 127.0.0.1 >nul && start http://localhost:5173"

:: Start Vite dev server
call npm run dev

echo.
echo  Server stopped.
pause
