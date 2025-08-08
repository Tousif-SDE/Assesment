@echo off
echo Starting Live Coding Classroom Application...

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Node.js is not installed. Please install Node.js and try again.
    pause
    exit /b
)

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo npm is not installed. Please install npm and try again.
    pause
    exit /b
)

REM Install concurrently if not already installed
if not exist node_modules\concurrently (
    echo Installing concurrently...
    npm install
)

REM Start the application
echo Starting server and client...
npm start

pause