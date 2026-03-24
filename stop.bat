@echo off
echo Szerverek leállítása...

:: Port 3001 (backend) leállítása
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Port 3000 (frontend) leállítása
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo Kész! Mindkét szerver leállítva.
timeout /t 2 >nul
