@echo off
echo Forcing complete rebuild...

echo Killing all node and electron processes...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM electron.exe 2>nul

echo Clearing Vite cache...
if exist "node_modules\.vite" rmdir /s /q "node_modules\.vite"

echo Clearing dist...
if exist "dist" rmdir /s /q "dist"

echo Clearing electron dist...
if exist "dist-electron" rmdir /s /q "dist-electron"

echo.
echo ========================================
echo Cache cleared! Now run: npm run desktop
echo ========================================
echo.
pause
