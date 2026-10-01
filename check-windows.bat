@echo off
REM Writes check-report.txt: everything needed to tell why the app will not
REM start on this machine, in one file that can be sent on.
REM
REM Nothing here changes anything. It is safe to run at any time, including
REM while the shop is billing.
setlocal
cd /d "%~dp0"

set OUT=check-report.txt
if "%PORT%"=="" set PORT=4100

echo Writing %OUT% ...
echo.

> "%OUT%" echo Order Bill Manager - check report
>> "%OUT%" echo Generated: %DATE% %TIME%
>> "%OUT%" echo.

call :section "Where this is installed"
>> "%OUT%" echo Folder: %CD%
REM A path under OneDrive is worth knowing about: it syncs node_modules while
REM npm is still writing into it, and the install fails halfway with EPERM.
echo %CD% | find /i "OneDrive" >nul && >> "%OUT%" echo NOTE: this folder is inside OneDrive.
echo %CD% | find /i "Program Files" >nul && >> "%OUT%" echo NOTE: this folder is inside Program Files.
>> "%OUT%" echo.

call :section "Windows"
ver >> "%OUT%" 2>&1
>> "%OUT%" echo.

call :section "Node and npm"
where node >> "%OUT%" 2>&1
node -v >> "%OUT%" 2>&1
where npm >> "%OUT%" 2>&1
call npm -v >> "%OUT%" 2>&1
>> "%OUT%" echo.

call :section "Files that must be present"
call :exists "backend\server.js"
call :exists "backend\db.js"
call :exists "backend\package.json"
call :exists "backend\package-lock.json"
call :exists "frontend\package.json"
call :exists "frontend\package-lock.json"
call :exists "frontend\index.html"
call :exists "frontend\src\main.jsx"
call :exists "backend\node_modules"
call :exists "frontend\node_modules"
call :exists "frontend\dist\index.html"
call :exists "backend\orders.db"
>> "%OUT%" echo.

call :section "Can Node actually load the database library?"
REM This is the one that decides it. If better-sqlite3 did not install a binary
REM for this Node version, everything else can look perfect and the server will
REM still stop the moment it starts.
node -e "const D=require('better-sqlite3'); const d=new D(':memory:'); d.prepare('select 1 as ok').get(); console.log('OK - better-sqlite3 loads and runs');" >> "%OUT%" 2>&1
if errorlevel 1 >> "%OUT%" echo FAILED - see the error above. This is why the server will not start.
>> "%OUT%" echo.

call :section "Is anything already on port %PORT%?"
netstat -ano | findstr ":%PORT%" >> "%OUT%" 2>&1
if errorlevel 1 >> "%OUT%" echo Nothing is listening on %PORT%.
>> "%OUT%" echo.

call :section "Does the server answer?"
curl.exe -s -m 3 -o nul -w "HTTP %%{http_code} from http://localhost:%PORT%/api/settings" "http://localhost:%PORT%/api/settings" >> "%OUT%" 2>&1
if errorlevel 1 >> "%OUT%" echo No answer - the server is not running right now.
>> "%OUT%" echo.

call :section "Backend dependency tree"
pushd backend
call npm ls --depth=0 >> "..\%OUT%" 2>&1
popd
>> "%OUT%" echo.

echo Done.
echo.
echo   %CD%\%OUT%
echo.
echo Send that file on. It contains no PINs, no customer data and no prices -
echo only version numbers and which files exist.
echo.
pause
exit /b 0


:section
>> "%OUT%" echo ----------------------------------------------------------------
>> "%OUT%" echo %~1
>> "%OUT%" echo ----------------------------------------------------------------
exit /b 0

:exists
if exist "%~1" (
  >> "%OUT%" echo   yes  %~1
) else (
  >> "%OUT%" echo   NO   %~1
)
exit /b 0
