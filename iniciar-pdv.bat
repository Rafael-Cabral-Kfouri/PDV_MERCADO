@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================
echo  PDV Mercado - Iniciando...
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

if not exist ".next" (
  echo [AVISO] Build nao encontrado. Rodando npm run build...
  call npm run build
  if errorlevel 1 (
    echo [ERRO] Build falhou.
    pause
    exit /b 1
  )
)

echo Aguarde o servidor subir. O navegador abrira em alguns segundos.
echo Para encerrar o PDV, feche esta janela ^(Ctrl+C^).
echo.

REM Abre o navegador apos ~5s (servidor ainda iniciando)
start "" cmd /c "timeout /t 5 /nobreak >nul & start http://localhost:3000"

call npm run start
if errorlevel 1 (
  echo.
  echo [ERRO] Nao foi possivel iniciar. Verifique Node, .env e se a porta 3000 esta livre.
  pause
  exit /b 1
)

endlocal
