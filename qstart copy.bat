@echo off
setlocal enabledelayedexpansion

echo.
echo ====================================
echo TOGEMUSIC - Local Development Launcher
echo ====================================
echo.

REM 检查当前目录
echo Current directory: %cd%

REM 检查frontend和backend目录
if not exist frontend (
    echo Error: frontend directory not found.
    pause
    exit /b 1
)

if not exist backend (
    echo Error: backend directory not found.
    pause
    exit /b 1
)

REM 检查Node.js是否安装
echo Checking Node.js installation...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH.
    echo Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo Found Node.js: %%i

REM 检查conda是否安装
echo Checking Conda installation...
where conda >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Conda is not installed or not in PATH.
    echo Please install Anaconda or Miniconda from: https://www.anaconda.com/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('conda --version') do echo Found Conda: %%i

REM 激活conda虚拟环境
echo.
echo ====================================
echo Activating Conda environment 'datamining'...
echo ====================================
call conda activate datamining
if %errorlevel% neq 0 (
    echo Error: Failed to activate conda environment 'datamining'.
    echo Please ensure the environment exists.
    echo To create it, run: conda create -n datamining python=3.9
    pause
    exit /b 1
)
echo Conda environment 'datamining' activated successfully.

echo.
echo ====================================
echo Starting services in new windows...
echo ====================================
echo.

REM 启动前端服务器（Vite开发服务器）
echo Starting frontend development server (Vite)...
start "TOGEMUSIC Frontend" cmd /k "cd frontend && npm run dev"
if %errorlevel% neq 0 (
    echo Error: Failed to start frontend.
    pause
    exit /b 1
)
echo Frontend window opened. Waiting for startup...
timeout /t 5 /nobreak

REM 启动Python后端
echo Starting Python backend...
start "TOGEMUSIC Backend" cmd /k "cd backend && python -m server.app"
if %errorlevel% neq 0 (
    echo Error: Failed to start backend.
    pause
    exit /b 1
)
echo Backend window opened. Waiting for startup...
timeout /t 3 /nobreak

echo.
echo ====================================
echo Services started successfully!
echo ====================================
echo.
echo Frontend: http://localhost:11451
echo Backend API: http://localhost:8034
echo WebSocket: ws://localhost:8034/socket.io
echo.
echo Frontend and Backend are running in separate windows.
echo To stop, close those windows or press Ctrl+C in each.
echo.
echo Press any key to close this launcher window...
pause >nul

exit /b 0
