@echo off
echo Starting Gemini IDE Desktop Application...
echo.

REM Kill any existing processes
echo Cleaning up existing processes...
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM electron.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul

REM Check if package.json exists
if not exist "package.json" (
    echo Error: package.json not found. Make sure you're in the correct directory.
    pause
    exit /b 1
)

echo Starting Vite development server...
start "Vite Dev Server" cmd /k "npm run dev"

echo Waiting for Vite server to initialize...
:wait_for_vite
timeout /t 3 /nobreak >nul
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:5174' -TimeoutSec 2 -UseBasicParsing; if ($response.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo Vite server not ready yet, waiting...
    goto wait_for_vite
)

echo Vite server is ready!
echo Starting Electron application...
timeout /t 2 /nobreak >nul
start "Gemini IDE" cmd /k "npx electron ."

echo.
echo Gemini IDE started successfully!
echo - Vite Dev Server: http://localhost:5174
echo - Electron Desktop App should open automatically
echo.
echo If the desktop app doesn't open, check the Electron window for errors.
echo Press any key to exit this launcher...
pause >nul
