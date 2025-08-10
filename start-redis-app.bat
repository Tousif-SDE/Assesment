@echo off
echo Starting Live Coding Classroom Application with Redis check...

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

REM Check if Redis is installed and running
echo Checking Redis status...
redis-cli ping >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Redis is not running. Starting Redis...
    
    REM Try to start Redis if it's installed
    start /b redis-server >nul 2>nul
    
    if %ERRORLEVEL% neq 0 (
        echo WARNING: Redis could not be started. The application may have limited functionality.
        echo Please install Redis and ensure it's running for full functionality.
        echo The application will continue without Redis.
        timeout /t 5
    ) else (
        echo Redis started successfully.
    )
) else (
    echo Redis is already running.
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