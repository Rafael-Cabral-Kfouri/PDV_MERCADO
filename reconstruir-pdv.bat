@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================
echo  PDV Mercado - Reconstruir build
echo  Use se o iniciar-pdv.bat falhar com
echo  erro do Prisma / @prisma/client-...
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado.
  pause
  exit /b 1
)

if not exist ".env" (
  echo [ERRO] Arquivo .env nao encontrado. Execute instalar-pdv.bat primeiro.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [ERRO] Dependencias nao instaladas. Execute instalar-pdv.bat primeiro.
  pause
  exit /b 1
)

echo [1/3] Removendo build antigo...
if exist ".next" (
  rmdir /s /q ".next"
)

echo [2/3] Gerando Prisma Client...
call npx prisma generate
if errorlevel 1 (
  echo [ERRO] prisma generate falhou.
  pause
  exit /b 1
)

echo.
echo [3/3] Gerando build de producao ^(webpack^)...
call npm run build
if errorlevel 1 (
  echo [ERRO] Build falhou.
  pause
  exit /b 1
)

echo.
echo ========================================
echo  Build pronto!
echo  Agora use: iniciar-pdv.bat
echo ========================================
pause
endlocal
