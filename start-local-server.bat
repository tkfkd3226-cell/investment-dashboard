@echo off
setlocal EnableExtensions

cd /d "%~dp0"
set "DASHBOARD_DIR=%CD%"
set "DASHBOARD_PORT=8000"
set "MARKET_AI_PORT=8001"
set "MARKET_AI_DIR="
set "PYTHON_EXE="

rem Optional override: set MARKET_AI_HOME=C:\path\to\market-ai
if defined MARKET_AI_HOME if exist "%MARKET_AI_HOME%\app.py" set "MARKET_AI_DIR=%MARKET_AI_HOME%"

rem Default layout: investment-dashboard-main and market-ai are sibling folders.
if not defined MARKET_AI_DIR if exist "%DASHBOARD_DIR%\..\market-ai\app.py" (
    for %%I in ("%DASHBOARD_DIR%\..\market-ai") do set "MARKET_AI_DIR=%%~fI"
)

rem Also allow market-ai to be placed inside the dashboard folder.
if not defined MARKET_AI_DIR if exist "%DASHBOARD_DIR%\market-ai\app.py" set "MARKET_AI_DIR=%DASHBOARD_DIR%\market-ai"

for /f "delims=" %%I in ('where python 2^>nul') do if not defined PYTHON_EXE set "PYTHON_EXE=%%I"
if not defined PYTHON_EXE for /f "delims=" %%I in ('where py 2^>nul') do if not defined PYTHON_EXE set "PYTHON_EXE=%%I"

cls
echo.
echo ==========================================================
echo   Investment Dashboard + Market AI Local Suite
echo ==========================================================
echo.
echo Dashboard : http://localhost:%DASHBOARD_PORT%/
echo Market AI : http://127.0.0.1:%MARKET_AI_PORT%/
echo API Docs  : http://127.0.0.1:%MARKET_AI_PORT%/docs
echo.

if not defined PYTHON_EXE goto :python_missing

if not defined MARKET_AI_DIR (
    echo [WARN] market-ai folder was not found.
    echo        Expected sibling folder: %DASHBOARD_DIR%\..\market-ai
    echo        Or set MARKET_AI_HOME to the market-ai folder.
    echo        Dashboard server will start without Market AI.
    echo.
    goto :start_dashboard
)

echo Market AI : %MARKET_AI_DIR%
echo.

rem Check Market AI Python dependencies before starting the API.
pushd "%MARKET_AI_DIR%"
"%PYTHON_EXE%" -c "import fastapi, uvicorn, sqlalchemy, dotenv, yfinance, pandas, httpx, openai, pydantic, exchange_calendars, korean_lunar_calendar" >nul 2>nul
if errorlevel 1 (
    popd
    echo [WARN] Market AI Python packages are missing or outdated.
    echo        Run: "%PYTHON_EXE%" -m pip install -r "%MARKET_AI_DIR%\requirements.txt"
    echo        Dashboard server will still start.
    echo.
    goto :start_dashboard
)
popd

rem Start Market AI API in this same console without opening another CMD window.
call :url_ready "http://127.0.0.1:%MARKET_AI_PORT%/api/health"
if errorlevel 1 (
    echo [START] Market AI API :8001
    start "" /b /d "%MARKET_AI_DIR%" "%PYTHON_EXE%" -m uvicorn app:app --host 127.0.0.1 --port %MARKET_AI_PORT%
    call :wait_url "http://127.0.0.1:%MARKET_AI_PORT%/api/health" 15
) else (
    echo [OK]    Market AI API is already running.
)

rem Build/deploy the latest KIS Bridge to market-ai root when needed.
if exist "%MARKET_AI_DIR%\build-kis-bridge-release.bat" (
    call "%MARKET_AI_DIR%\build-kis-bridge-release.bat" --ensure
    if errorlevel 1 (
        echo [WARN] KIS Bridge build/deploy failed. KOSPI200 futures will not update.
    )
)

rem Start KIS Bridge GUI only once. It does not open another CMD window.
if exist "%MARKET_AI_DIR%\KisKospi200Bridge.exe" (
    tasklist /fi "imagename eq KisKospi200Bridge.exe" 2>nul | find /i "KisKospi200Bridge.exe" >nul
    if errorlevel 1 (
        echo [START] KIS KOSPI200 Bridge
        start "KIS KOSPI200 Bridge" /d "%MARKET_AI_DIR%" "%MARKET_AI_DIR%\KisKospi200Bridge.exe"
    ) else (
        echo [OK]    KIS KOSPI200 Bridge is already running.
    )
) else (
    echo [WARN] %MARKET_AI_DIR%\KisKospi200Bridge.exe was not found.
    echo        Install Visual Studio 2022 Desktop development for .NET,
    echo        then run market-ai\build-kis-bridge-release.bat once.
)

echo.

:start_dashboard
start "" "http://localhost:%DASHBOARD_PORT%/"
echo [START] Investment Dashboard :%DASHBOARD_PORT%
echo.
echo Close this CMD window to stop the local web servers.
echo The KIS Bridge is a Windows GUI process and can be closed from its own window.
echo.
"%PYTHON_EXE%" -m http.server %DASHBOARD_PORT% --bind 127.0.0.1
goto :eof

:python_missing
echo [ERROR] Python was not found.
echo Install Python, then run this file again.
echo.
pause
goto :eof

:url_ready
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri '%~1' -TimeoutSec 1; if($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){exit 0} } catch {}; exit 1" >nul 2>nul
exit /b %errorlevel%

:wait_url
set "WAIT_URL=%~1"
set "WAIT_SECONDS=%~2"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='%WAIT_URL%'; $n=%WAIT_SECONDS%; for($i=0;$i -lt $n;$i++){ try { $r=Invoke-WebRequest -UseBasicParsing -Uri $u -TimeoutSec 1; if($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){exit 0} } catch {}; Start-Sleep -Seconds 1 }; exit 1" >nul 2>nul
if errorlevel 1 (
    echo [WARN] Market AI API did not become ready within %WAIT_SECONDS% seconds.
) else (
    echo [OK]    Market AI API ready.
)
exit /b 0
