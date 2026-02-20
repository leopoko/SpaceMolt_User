@echo off
cd /d "%~dp0"
title SpaceMolt - Character 3 (Port 5175)
echo ============================================
echo   SpaceMolt Client - Character 3
echo   http://localhost:5175
echo ============================================
set VITE_PORT=5175
call npm run dev -- --port 5175 --open
