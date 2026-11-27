@echo off
rem Runs this project's dev stack on the Docker Engine inside WSL2 from cmd / PowerShell,
rem without Docker Desktop. Everything after the command name goes to docker compose.
rem   docker-dev up -d                 start Postgres / Redis / MinIO (API and web run on Windows)
rem   docker-dev --profile app up -d   also the API and web in Docker (builds the images the first time)
rem   docker-dev ps / stop / start / down / logs -f postgres
rem   docker-dev db-init               prisma db push + seed on the LOCAL dev database
rem Plain docker commands go through wsl too, e.g.:  wsl docker ps
rem
rem WSL shuts a distro down shortly after its last wsl.exe session ends, which would stop
rem the containers. While any container of this project runs, a hidden
rem "wsl.exe -d <distro> --exec sleep infinity" keeps the distro up; it is ended again
rem once nothing runs (after stop / down) so WSL can release its memory.
setlocal
set "DISTRO=Ubuntu"
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "COMPOSE=docker compose -f docker-compose.dev.yml"
set "RUN=wsl -d %DISTRO% --cd "%ROOT%" --"
set "KEEPALIVE=--exec sleep infinity"

if "%~1"=="" goto :usage
if /i "%~1"=="help" goto :usage

rem Docker Desktop runs its engine in the same WSL VM: same host ports, shared RAM
tasklist /fi "imagename eq com.docker.backend.exe" 2>nul | find /i "com.docker.backend.exe" >nul
if not errorlevel 1 (
  echo [docker-dev] Docker Desktop is running and competes for the same ports and RAM.
  echo [docker-dev] Stop its stack first:  docker compose -f docker-compose.dev.yml --profile app stop  then  docker desktop stop
)

%RUN% docker info >nul 2>&1
if errorlevel 1 (
  echo [docker-dev] Docker Engine in WSL distro "%DISTRO%" is not reachable.
  echo [docker-dev] Check it with:  wsl -d %DISTRO% -- systemctl status docker
  exit /b 1
)

if /i "%~1"=="db-init" goto :dbinit

%RUN% %COMPOSE% %*
set "RC=%errorlevel%"
call :keepalive
exit /b %RC%

:dbinit
rem Local dev DB only. Runs in a one-off container of the api image (built if missing; Postgres,
rem MinIO and Redis are started if needed), so it works whether the API runs in Docker or on
rem Windows. db push also drops cap_notification / push_vapid / push_subscription (created by the
rem API at startup, not in schema.prisma), so the API has to restart afterwards to recreate them.
set "ONEOFF=%COMPOSE% --profile app run --rm -w /app api"
echo [docker-dev] prisma db push ...
%RUN% %ONEOFF% npx prisma db push --schema packages/database/prisma/schema.prisma --accept-data-loss --skip-generate || exit /b 1
echo [docker-dev] seed ...
%RUN% %ONEOFF% npm run db:seed --workspace=packages/database || exit /b 1
set "API_UP="
for /f %%i in ('%RUN% %COMPOSE% --profile app ps -q --status running api 2^>nul') do set "API_UP=1"
if defined API_UP (
  echo [docker-dev] restarting api ...
  %RUN% %COMPOSE% --profile app restart api
) else (
  echo [docker-dev] Now restart the API on Windows ^(npm start in apps\api^) so it recreates its tables
)
set "RC=%errorlevel%"
call :keepalive
exit /b %RC%

:keepalive
set "RUNNING="
for /f %%i in ('%RUN% %COMPOSE% --profile app ps -q --status running 2^>nul') do set "RUNNING=1"
if defined RUNNING (
  powershell -NoProfile -Command "if (-not (Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'wsl.exe' -and $_.CommandLine -like '*%KEEPALIVE%*' })) { Start-Process wsl.exe -ArgumentList '-d %DISTRO% %KEEPALIVE%' -WindowStyle Hidden; Write-Output '[docker-dev] WSL keepalive started (containers keep running after this window closes)' }"
) else (
  rem The WindowsApps wsl.exe alias starts the real wsl.exe as a child, so there can be two
  powershell -NoProfile -Command "$p = @(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'wsl.exe' -and $_.CommandLine -like '*%KEEPALIVE%*' }); if ($p.Count) { $p | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Write-Output '[docker-dev] WSL keepalive stopped (no containers running)' }"
)
exit /b 0

:usage
echo Usage: docker-dev ^<docker compose command^> [args]   (runs on Docker Engine in WSL "%DISTRO%")
echo   docker-dev up -d              start Postgres, Redis, MinIO (API and web run on Windows)
echo   docker-dev ps                 container status
echo   docker-dev logs -f postgres   follow the logs of a service
echo   docker-dev stop               stop, keep containers and data
echo   docker-dev db-init            prisma db push + seed (local dev DB only)
echo API and web in Docker as well (compose profile "app"):
echo   docker-dev --profile app up -d              start everything
echo   docker-dev --profile app up -d --build -V   rebuild after dependency / Dockerfile changes
echo   docker-dev --profile app stop               stop everything
echo Plain docker:  wsl docker ps
exit /b 0
