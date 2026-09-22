@echo off
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3001 "') do (
    echo Killing Process: %%a
    taskkill /F /PID %%a
)
for /f "tokens=5" %%a in ('netstat -aon ^| find "0.0.0.0:3001"') do (
    echo Killing Process: %%a
    taskkill /F /PID %%a
)
for /f "tokens=5" %%a in ('netstat -aon ^| find "[::]:3001"') do (
    echo Killing Process: %%a
    taskkill /F /PID %%a
)
echo Done
