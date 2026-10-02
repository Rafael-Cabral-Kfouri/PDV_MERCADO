@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================
echo  PDV Mercado - Instalacao (1a vez)
echo  Requer: Node.js LTS + PostgreSQL
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado. Instale o LTS em https://nodejs.org
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERRO] npm nao encontrado. Reinstale o Node.js.
  pause
  exit /b 1
)

echo Node: 
node -v
echo.

if not exist ".env" (
  if exist ".env.example" (
    copy /Y ".env.example" ".env" >nul
    echo [AVISO] Arquivo .env criado a partir de .env.example
    echo          Edite o .env com a senha do PostgreSQL e AUTH_SECRET
    echo          Exemplo DATABASE_URL:
    echo          postgresql://postgres:SUA_SENHA@localhost:5432/pdv_mercado?schema=public
    echo.
    notepad ".env"
    echo.
    echo Depois de salvar o .env, pressione qualquer tecla para continuar...
    pause >nul
  ) else (
    echo [ERRO] .env.example nao encontrado.
    pause
    exit /b 1
  )
)

echo [1/4] Instalando dependencias (npm install)...
call npm install
if errorlevel 1 (
  echo [ERRO] npm install falhou.
  pause
  exit /b 1
)

echo.
echo [2/4] Aplicando migrations no banco...
echo        (PostgreSQL deve estar rodando e o banco pdv_mercado criado)
call npx prisma migrate deploy
if errorlevel 1 (
  echo [ERRO] migrate deploy falhou. Confira DATABASE_URL no .env e se o Postgres esta no ar.
  pause
  exit /b 1
)

echo.
echo [3/4] Criando usuarios iniciais (seed)...
call npm run db:seed
if errorlevel 1 (
  echo [AVISO] Seed falhou ^(talvez usuarios ja existam^). Continuando...
)

echo.
echo [4/4] Gerando build de producao...
call npm run build
if errorlevel 1 (
  echo [ERRO] Build falhou.
  pause
  exit /b 1
)

echo.
echo ========================================
echo  Instalacao concluida!
echo  Use: iniciar-pdv.bat
echo.
echo  Login padrao:
echo    admin@pdv.local / admin123
echo    operador@pdv.local / operador123
echo ========================================
pause
endlocal
