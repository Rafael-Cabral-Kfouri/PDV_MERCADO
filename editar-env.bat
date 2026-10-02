@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Cria/abre o arquivo .env para configurar o banco.
echo.

if not exist ".env.example" (
  echo [ERRO] .env.example nao encontrado.
  pause
  exit /b 1
)

if not exist ".env" (
  copy /Y ".env.example" ".env" >nul
  echo .env criado a partir de .env.example
) else (
  echo .env ja existe — abrindo para edicao.
)

echo.
echo Ajuste DATABASE_URL com usuario/senha do PostgreSQL do Windows.
echo Gere AUTH_SECRET com:
echo   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
echo.
notepad ".env"
pause
