@echo off
setlocal

cd /d "%~dp0"
set PORT=8000

echo.
echo ==========================================
echo   Investment Dashboard Local Server
echo ==========================================
echo.
echo Folder : %CD%
echo URL    : http://localhost:%PORT%/
echo.
echo Close this window to stop the server.
echo.

where python >nul 2>nul
if %errorlevel%==0 (
    start "" "http://localhost:%PORT%/"
    python -m http.server %PORT%
    goto :eof
)

where py >nul 2>nul
if %errorlevel%==0 (
    start "" "http://localhost:%PORT%/"
    py -m http.server %PORT%
    goto :eof
)

echo.
echo [ERROR] Python was not found.
echo Install Python, then run this file again.
echo.
pause
