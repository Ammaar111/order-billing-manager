@echo off
REM The Windows twin of start.sh: install anything missing, build the interface
REM if it has not been built, start the one server, open the browser at it.
REM
REM Four things here are Windows-specific and were each found the hard way:
REM   * the browser is opened by a helper that waits for the server to answer,
REM     not fired off a line before it starts;
REM   * pushd is used instead of "npm --prefix", which mangles a project path
REM     containing spaces - and this folder is called ORDER BILL MANAGER;
REM   * the build is judged by dist\index.html, not by the dist folder, because
REM     an interrupted build leaves the folder there and nothing in it;
REM   * every step runs as a subroutine. Inside a parenthesised if-block cmd
REM     expands %ERRORLEVEL% once, when it parses the block, so a failed npm
REM     reads as success and the script sails past it.
setlocal
cd /d "%~dp0"

if "%PORT%"=="" set PORT=4100
set URL=http://localhost:%PORT%

REM Re-entry point: this script starts a second minimised copy of itself whose
REM only job is to wait for the port and then open the browser.
if /i "%~1"=="--open-when-ready" goto openwhenready

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed, or this window was opened before it was.
  echo Close this window, open a new one, and try again.
  echo If it still says this, see Installation-on-windows.md step 1.
  echo.
  pause
  exit /b 1
)

if not exist "backend\server.js" (
  echo.
  echo This does not look like the project folder - backend\server.js is missing.
  echo Copy the whole folder across, not just some of the files, and run this
  echo script from inside it.
  echo.
  pause
  exit /b 1
)

REM Already running? Point the browser at it instead of taking the port twice.
REM A second server on 4100 would die with EADDRINUSE and look like a crash.
curl.exe -s -f -m 2 "%URL%/api/settings" >nul 2>nul
if not errorlevel 1 (
  echo Order Bill Manager is already running - %URL%
  start "" "%URL%"
  timeout /t 3 >nul
  exit /b 0
)

call :checknode

call :install backend
if errorlevel 1 goto failed

call :install frontend
if errorlevel 1 goto failed

call :build
if errorlevel 1 goto failed

if not exist "frontend\dist\index.html" (
  echo.
  echo The build finished but frontend\dist\index.html is still not there.
  echo Run check-windows.bat and send the file it writes.
  echo.
  pause
  exit /b 1
)

echo.
echo Order Bill Manager - %URL%
echo Leave this window open while the shop is billing.
echo.

REM The browser is opened by the helper below once the port actually answers.
REM Opening it here, one line before node starts, is a race the browser wins:
REM it lands on "This site can't be reached" while the server is still booting.
start "Opening Order Bill Manager" /min "%~f0" --open-when-ready

node backend\server.js
set RC=%ERRORLEVEL%
if not "%RC%"=="0" (
  echo.
  echo The server stopped with an error. The message above says why.
  echo Run check-windows.bat and send the file it writes.
  echo.
  pause
)
exit /b %RC%


REM ------------------------------------------------------------------ helpers

:checknode
REM better-sqlite3 11.10.0 ships ready-built Windows binaries for Node 18, 20,
REM 22 and 23. On anything else npm has to compile it and stops on a wall of red
REM about Visual Studio, so say so here rather than let that be the first clue.
REM Keep this list in step with whatever backend\package.json pins: the 9.6.0
REM that came before stopped at Node 21, and a guide telling people to install
REM 22 walked them straight into the compile it was written to avoid.
if exist "backend\node_modules" exit /b 0
for /f "tokens=1 delims=." %%v in ('node -v') do set NODEMAJOR=%%v
set NODEMAJOR=%NODEMAJOR:v=%
if "%NODEMAJOR%"=="18" exit /b 0
if "%NODEMAJOR%"=="20" exit /b 0
if "%NODEMAJOR%"=="22" exit /b 0
if "%NODEMAJOR%"=="23" exit /b 0
echo.
echo   ------------------------------------------------------------------
echo    This is Node
call node -v
echo    The database library has ready-made Windows files for Node 18, 20,
echo    22 and 23. On this version npm has to compile it, which needs
echo    Visual Studio and usually fails.
echo.
echo    Install Node 22 instead - Installation-on-windows.md step 1.
echo   ------------------------------------------------------------------
echo.
echo   Press any key to try anyway, or close this window.
pause >nul
exit /b 0

:install
if exist "%~1\node_modules" exit /b 0
echo Installing the %~1, this takes a few minutes the first time...
pushd "%~1"
call npm install --no-audit --no-fund
set RC=%ERRORLEVEL%
popd
exit /b %RC%

:build
if exist "frontend\dist\index.html" exit /b 0
echo Building the front end...
pushd frontend
call npm run build
set RC=%ERRORLEVEL%
popd
exit /b %RC%

:openwhenready
REM Windows 10 builds before 1803 have no curl.exe. Without it the port cannot be
REM polled, so fall back to a plain wait rather than never opening the browser.
where curl.exe >nul 2>nul
if errorlevel 1 (
  ping -n 9 127.0.0.1 >nul 2>nul
  start "" "%URL%"
  exit /b 0
)
REM Up to 90 seconds; a cold first run on a slow laptop is not instant.
for /l %%i in (1,1,90) do (
  curl.exe -s -f -m 1 "%URL%/api/settings" >nul 2>nul
  if not errorlevel 1 (
    start "" "%URL%"
    exit /b 0
  )
  ping -n 2 127.0.0.1 >nul 2>nul
)
exit /b 0

:failed
echo.
echo Something went wrong during installation. The message above says what.
echo.
echo For the whole story in a file you can send on, run:
echo     check-windows.bat
echo.
echo Installation-on-windows.md has a list of the usual causes at the end.
echo.
pause
exit /b 1
