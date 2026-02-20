@echo off
cd /d "%~dp0"
title SpaceMolt - Character 2 (Port 5174)
echo ============================================
echo   SpaceMolt Client - Character 2
echo   http://localhost:5174
echo ============================================
set VITE_PORT=5174
call npm run dev -- --port 5174 --open
