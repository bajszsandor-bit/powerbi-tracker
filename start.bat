@echo off
echo Szerverek indítása...
start "Backend" cmd /k "cd /d %~dp0backend && npm run dev"
start "Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
echo Kész! Backend: localhost:3001 / Frontend: localhost:3000
