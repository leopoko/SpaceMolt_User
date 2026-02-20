@echo off
cd /d "%~dp0"
title SpaceMolt - Character 1 (Port 5173)
echo ============================================
echo   SpaceMolt Client - Character 1
echo   http://localhost:5173
echo ============================================
set VITE_PORT=5173
call npm run dev -- --port 5173 --open
