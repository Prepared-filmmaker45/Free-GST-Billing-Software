@echo off
title FreeGSTBill
cd /d "%~dp0"

:: Check if node_modules exists
if not exist "node_modules" (
    echo.
    echo  FreeGSTBill is not installed yet.
    echo  Please run "Install FreeGSTBill.bat" first.
    echo.
    pause
    exit /b 1
)

:: Build if needed
if not exist "dist\index.html" (
    echo.
    echo  Building app for first time, please wait...
    echo.
    npm run build
)

:: Check if server is already running
set "PORT=3001"
if exist "data\port.txt" set /p PORT=<data\port.txt

curl -s http://localhost:%PORT%/api/meta/test >nul 2>nul
if %errorlevel% equ 0 (
    echo.
    echo  FreeGSTBill is already running!
    echo  Opening http://localhost:%PORT%
    echo.
    start http://localhost:%PORT%
    timeout /t 3 /nobreak >nul
    exit /b 0
)

:: Start server in background
echo.
echo  Starting FreeGSTBill server...
echo.
start "" /b cmd /c "node server.js"

:: Wait for server to be ready
set RETRIES=0
:waitloop
if %RETRIES% geq 20 goto timeout
timeout /t 1 /nobreak >nul
set /a RETRIES+=1

:: Re-read port
if exist "data\port.txt" set /p PORT=<data\port.txt

curl -s http://localhost:%PORT%/api/meta/test >nul 2>nul
if %errorlevel% neq 0 goto waitloop

:: Server is ready
echo.
echo  ========================================================
echo.
echo     FreeGSTBill is running at http://localhost:%PORT%
echo.
echo     DO NOT CLOSE THIS WINDOW (server runs here)
echo     To stop: just close this window
echo.
echo  ========================================================
echo.

start http://localhost:%PORT%
cmd /k echo   Server running. Close this window to stop.
exit /b 0

:timeout
echo.
echo  Server took too long to start. Try running again.
echo.
pause
