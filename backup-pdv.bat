@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo ========================================
echo  PDV Mercado - Backup do banco e fotos
echo ========================================
echo.

if not exist ".env" (
  echo [ERRO] Arquivo .env nao encontrado.
  pause
  exit /b 1
)

REM --- Ler DATABASE_URL do .env ---
set "DATABASE_URL="
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
  set "chave=%%A"
  set "valor=%%B"
  if /i "!chave!"=="DATABASE_URL" set "DATABASE_URL=!valor!"
)

if not defined DATABASE_URL (
  echo [ERRO] DATABASE_URL nao encontrada no .env
  pause
  exit /b 1
)

REM Remove aspas eventualmente presentes
set "DATABASE_URL=!DATABASE_URL:"=!"

REM Extração postgresql://user:pass@host:port/db
set "DB_USER="
set "DB_PASS="
set "DB_HOST="
set "DB_PORT="
set "DB_NAME="

for /f "tokens=1,* delims=@" %%A in ("!DATABASE_URL!") do (
  set "antes=%%A"
  set "depois=%%B"
)

REM antes = postgresql://user:pass
for /f "tokens=2 delims=/" %%A in ("!antes!") do set "userpass=%%A"
for /f "tokens=1,2 delims=:" %%A in ("!userpass!") do (
  set "DB_USER=%%A"
  set "DB_PASS=%%B"
)

REM depois = host:port/db?schema=...
for /f "tokens=1,2 delims=/" %%A in ("!depois!") do (
  set "hostport=%%A"
  set "DB_NAME=%%B"
)
for /f "tokens=1 delims=?" %%A in ("!DB_NAME!") do set "DB_NAME=%%A"
for /f "tokens=1,2 delims=:" %%A in ("!hostport!") do (
  set "DB_HOST=%%A"
  set "DB_PORT=%%B"
)

if not defined DB_PORT set "DB_PORT=5432"
if not defined DB_HOST set "DB_HOST=localhost"

if not defined DB_USER (
  echo [ERRO] Nao foi possivel extrair usuario/senha do DATABASE_URL.
  pause
  exit /b 1
)

echo Banco: !DB_NAME! @ !DB_HOST!:!DB_PORT! ^(usuario !DB_USER!^)
echo.

if not exist "backups" mkdir "backups"

REM Timestamp AAAA-MM-DD_HH-MM
for /f "tokens=1-3 delims=/ " %%A in ("%date%") do (
  set "d1=%%A"
  set "d2=%%B"
  set "d3=%%C"
)
REM date no Windows pode ser dd/mm/yyyy ou mm/dd/yyyy — usa PowerShell para ISO
for /f "usebackq delims=" %%T in (`powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd_HH-mm'"`) do set "STAMP=%%T"

set "DUMP_FILE=backups\pdv_!STAMP!.dump"
set "ZIP_FILE=backups\pdv_!STAMP!.zip"
set "PGDUMP="

where pg_dump >nul 2>&1
if not errorlevel 1 (
  for /f "delims=" %%P in ('where pg_dump') do (
    set "PGDUMP=%%P"
    goto :found_pgdump
  )
)

REM Procura na pasta mais recente de PostgreSQL em Program Files
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "Get-ChildItem 'C:\Program Files\PostgreSQL' -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | ForEach-Object { $b = Join-Path $_.FullName 'bin\pg_dump.exe'; if (Test-Path $b) { $b; break } }"`) do (
  set "PGDUMP=%%P"
)

:found_pgdump
set "USE_DOCKER=0"
if not defined PGDUMP (
  docker ps --format "{{.Names}}" 2>nul | findstr /i /x "pdv_mercado_db" >nul 2>&1
  if not errorlevel 1 (
    set "USE_DOCKER=1"
    echo [AVISO] pg_dump local nao encontrado; usando docker exec pdv_mercado_db
  ) else (
    echo [ERRO] pg_dump nao encontrado no PATH nem em C:\Program Files\PostgreSQL
    echo        e o container pdv_mercado_db nao esta em execucao.
    pause
    exit /b 1
  )
)

set "PGPASSWORD=!DB_PASS!"

echo [1/3] Gerando dump do banco...
if "!USE_DOCKER!"=="1" (
  docker exec -e PGPASSWORD=!DB_PASS! pdv_mercado_db pg_dump -U !DB_USER! -d !DB_NAME! -Fc -f /tmp/pdv_backup.dump
  if errorlevel 1 (
    echo [ERRO] docker exec pg_dump falhou.
    pause
    exit /b 1
  )
  docker cp pdv_mercado_db:/tmp/pdv_backup.dump "!DUMP_FILE!"
  if errorlevel 1 (
    echo [ERRO] docker cp do dump falhou.
    pause
    exit /b 1
  )
) else (
  "!PGDUMP!" -h !DB_HOST! -p !DB_PORT! -U !DB_USER! -d !DB_NAME! -Fc -f "!DUMP_FILE!"
  if errorlevel 1 (
    echo [ERRO] pg_dump falhou. Confira DATABASE_URL e se o Postgres esta no ar.
    pause
    exit /b 1
  )
)

echo [2/3] Compactando dump + fotos de produtos...
set "UPLOADS=public\uploads\produtos"
if not exist "!UPLOADS!" (
  echo [AVISO] Pasta !UPLOADS! nao existe; zip so com o dump.
  powershell -NoProfile -Command "Compress-Archive -Path '!DUMP_FILE!' -DestinationPath '!ZIP_FILE!' -Force"
) else (
  powershell -NoProfile -Command "Compress-Archive -Path '!DUMP_FILE!','!UPLOADS!' -DestinationPath '!ZIP_FILE!' -Force"
)
if errorlevel 1 (
  echo [ERRO] Compress-Archive falhou.
  pause
  exit /b 1
)

del /f /q "!DUMP_FILE!" >nul 2>&1

echo [3/3] Mantendo apenas os 30 backups mais recentes...
powershell -NoProfile -Command "$files = Get-ChildItem 'backups\pdv_*.zip' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending; if ($files.Count -gt 30) { $files | Select-Object -Skip 30 | Remove-Item -Force }"

echo.
echo ========================================
echo  Backup concluido:
echo  !ZIP_FILE!
echo ========================================
pause
endlocal
