@echo off
if /i "%~1"=="--inner" goto :main

set "LOCAL_SUITE_LOG=%~dp0start-local-server.log"
set "LOCAL_SUITE_BAT=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$cmd=[char]34 + $env:LOCAL_SUITE_BAT + [char]34 + ' --inner'; & cmd.exe /d /s /c $cmd 2>&1 | Tee-Object -FilePath $env:LOCAL_SUITE_LOG; exit $LASTEXITCODE"
exit /b %errorlevel%

:main
@echo off
chcp 65001 >nul
setlocal EnableExtensions

cd /d "%~dp0"
set "DASHBOARD_DIR=%CD%"
set "DASHBOARD_PORT=8000"
set "MARKET_AI_PORT=8001"
set "MARKET_AI_DIR="
set "PYTHON_EXE="
set "MARKET_AI_READY=0"

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
echo Started   : %date% %time%
echo Log file  : %DASHBOARD_DIR%\start-local-server.log
echo.
echo Dashboard : http://localhost:%DASHBOARD_PORT%/
echo Market AI : http://127.0.0.1:%MARKET_AI_PORT%/
echo API Docs  : http://127.0.0.1:%MARKET_AI_PORT%/docs
echo.

if not defined PYTHON_EXE goto :python_missing

echo Python    : %PYTHON_EXE%

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

rem Build/deploy the latest KIS Bridge first. This must not depend on Python packages.
if exist "%MARKET_AI_DIR%\build-kis-bridge-release.bat" (
    call "%MARKET_AI_DIR%\build-kis-bridge-release.bat" --ensure
    if errorlevel 1 (
        echo [WARN] KIS Bridge build/deploy failed.
        echo        Market AI can still start, but KOSPI200 futures will not update.
        echo        See start-local-server.log for the complete build diagnostics.
        echo.
    )
) else (
    echo [WARN] build-kis-bridge-release.bat was not found.
    echo.
)

rem Market AI core dependencies. OpenAI is intentionally NOT required.
call :check_market_ai_deps
if errorlevel 1 (
    echo [SETUP] Market AI core Python packages are missing or outdated.
    echo         Installing requirements.txt now...
    echo.
    pushd "%MARKET_AI_DIR%"
    "%PYTHON_EXE%" -m pip install -r requirements.txt
    if errorlevel 1 (
        popd
        echo.
        echo [WARN] Market AI package installation failed.
        echo        Dashboard server will still start.
        echo        Retry manually with:
        echo        "%PYTHON_EXE%" -m pip install -r "%MARKET_AI_DIR%\requirements.txt"
        echo.
        goto :start_dashboard
    )
    popd
    call :check_market_ai_deps
    if errorlevel 1 (
        echo [WARN] Market AI dependencies are still unavailable after installation.
        echo        Dashboard server will still start.
        echo.
        goto :start_dashboard
    )
    echo.
    echo [OK]    Market AI core Python packages ready.
    echo.
)

rem Start Market AI API in this same console without opening another CMD window.
call :url_ready "http://127.0.0.1:%MARKET_AI_PORT%/api/health"
if errorlevel 1 (
    echo [START] Market AI API :%MARKET_AI_PORT%
    start "" /b /d "%MARKET_AI_DIR%" "%PYTHON_EXE%" -m uvicorn app:app --host 127.0.0.1 --port %MARKET_AI_PORT%
    call :wait_url "http://127.0.0.1:%MARKET_AI_PORT%/api/health" 20
    if errorlevel 1 (
        echo [WARN] Market AI API did not become ready.
        echo        KIS Bridge will not start until the API is available.
        echo.
    ) else (
        set "MARKET_AI_READY=1"
    )
) else (
    echo [OK]    Market AI API is already running.
    set "MARKET_AI_READY=1"
)

rem Start KIS Bridge GUI only when Market AI API is ready.
if "%MARKET_AI_READY%"=="1" (
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
        echo        Bridge build/deploy did not complete. Attach start-local-server.log.
    )
)

echo.

:start_dashboard
start "" "http://localhost:%DASHBOARD_PORT%/"
echo [START] Investment Dashboard :%DASHBOARD_PORT%
echo.
echo Close this CMD window to stop the local web servers.
echo The KIS Bridge is a Windows GUI process and can be closed from its own window.
echo If startup fails, attach: %DASHBOARD_DIR%\start-local-server.log
echo.
"%PYTHON_EXE%" -m http.server %DASHBOARD_PORT% --bind 127.0.0.1
goto :eof

:python_missing
echo [ERROR] Python was not found.
echo Install Python, then run this file again.
echo.
pause
goto :eof

:check_market_ai_deps
pushd "%MARKET_AI_DIR%"
"%PYTHON_EXE%" -c "import fastapi, uvicorn, sqlalchemy, dotenv, yfinance, pandas, httpx, pydantic, exchange_calendars, korean_lunar_calendar" >nul 2>nul
set "DEP_RESULT=%ERRORLEVEL%"
popd
exit /b %DEP_RESULT%

:url_ready
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri '%~1' -TimeoutSec 1; if($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){exit 0} } catch {}; exit 1" >nul 2>nul
exit /b %errorlevel%

:wait_url
set "WAIT_URL=%~1"
set "WAIT_SECONDS=%~2"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='%WAIT_URL%'; $n=%WAIT_SECONDS%; for($i=0;$i -lt $n;$i++){ try { $r=Invoke-WebRequest -UseBasicParsing -Uri $u -TimeoutSec 1; if($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){exit 0} } catch {}; Start-Sleep -Seconds 1 }; exit 1" >nul 2>nul
if errorlevel 1 exit /b 1
echo [OK]    Market AI API ready.
exit /b 0
