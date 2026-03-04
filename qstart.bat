@echo off
setlocal enabledelayedexpansion

REM 进入项目上级目录
echo Current directory: %cd%

REM 检查conda是否安装
where conda >nul 2>nul
if %errorlevel% neq 0 (
    echo Conda is not installed or not in PATH.
    pause
    exit /b 1
)

REM 激活conda环境
echo Activating conda environment 'datamining'...
call conda activate datamining
if %errorlevel% neq 0 (
    echo Failed to activate conda environment 'datamining'.
    echo Creating new environment...
    call conda create -n datamining python=3.9 -y
    call conda activate datamining
)

REM 安装Python依赖
if exist requirements.txt (
    echo Installing Python dependencies from requirements.txt...
    
    REM 升级pip
    python -m pip install --upgrade pip
    
    REM 直接使用requirements.txt安装所有依赖
    pip install -r requirements.txt
    
    
    
    echo ✓ All dependencies installed successfully!
) else (
    echo ✗ requirements.txt not found!
    pause
    exit /b 1
)

REM 启动前端服务器（使用wmic获取PID）
echo Starting frontend development server...
start "Frontend" cmd /c "npm run dev"
for /f "tokens=2" %%i in ('wmic process where "name='node.exe' and commandline like '%%npm run dev%%'" get processid /value ^| find "="') do set frontend_pid=%%i

REM 等待前端启动
timeout /t 3 /nobreak >nul

REM 启动Python后端
echo Starting Python backend...
if exist server\app.py (
    start "Backend" cmd /k "python -m server.app"
    REM 获取Python进程PID
    timeout /t 2 /nobreak >nul
    for /f "tokens=2" %%i in ('wmic process where "name='python.exe' and commandline like '%%server\\app.py%%'" get processid /value ^| find "="') do set backend_pid=%%i
) else (
    echo server\app.py not found.
    pause
    exit /b 1
)

echo.
echo ====================================
echo Frontend and Backend started successfully!
echo Frontend: http://localhost:11451 (or check npm output)
echo Backend: http://localhost:19198 (or check Python output)
echo ====================================
echo.
echo Press any key to terminate both services...
pause >nul

REM 清理进程
echo Terminating services...
if defined frontend_pid (
    taskkill /PID %frontend_pid% /F >nul 2>nul
    echo Frontend terminated.
)
if defined backend_pid (
    taskkill /PID %backend_pid% /F >nul 2>nul
    echo Backend terminated.
)

REM 强制清理可能残留的进程
taskkill /F /IM node.exe /FI "WINDOWTITLE eq Frontend*" >nul 2>nul
taskkill /F /IM python.exe /FI "WINDOWTITLE eq Backend*" >nul 2>nul

call conda deactivate
echo Environment deactivated.
pause
