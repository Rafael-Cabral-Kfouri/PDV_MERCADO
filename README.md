# PDV Mercado

Aplicação web de Ponto de Venda para supermercado.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- PostgreSQL + Prisma
- Auth.js (NextAuth v5) com JWT

## Desenvolvimento (este PC, com Docker)

1. `docker compose up -d`
2. Copie `.env.example` → `.env` (valores Docker já batem com o compose)
3. `npm install`
4. `npx prisma migrate deploy`
5. `npm run db:seed`
6. `npm run dev`

## Instalação no PC do mercado (Postgres Windows, sem Docker)

### Pré-requisitos

1. **Node.js LTS** — https://nodejs.org  
2. **PostgreSQL** para Windows — serviço iniciando com o Windows  
3. Criar o banco `pdv_mercado` (pgAdmin ou `createdb`)

### Passos

1. Clone o repositório (ou copie a pasta do projeto)
2. Dê duplo clique em **`editar-env.bat`** e ajuste `DATABASE_URL` / `AUTH_SECRET`
3. No pgAdmin, crie o banco **`pdv_mercado`** (se ainda não existir)
4. Dê duplo clique em **`instalar-pdv.bat`** (só na primeira vez)
5. No dia a dia: duplo clique em **`iniciar-pdv.bat`**

Se o `instalar-pdv.bat` falhar no meio das migrations: no pgAdmin apague o banco `pdv_mercado`, crie de novo e rode `instalar-pdv.bat` outra vez.

O navegador abre em `http://localhost:3000`.

### Scripts Windows

| Arquivo | Quando usar |
|---------|-------------|
| `editar-env.bat` | Criar/editar o `.env` |
| `instalar-pdv.bat` | Primeira instalação (dependências, migrate, seed, build) |
| `iniciar-pdv.bat` | Ligar o PDV em produção |

Para subir junto com o Windows: Agendador de Tarefas → ao logon → executar `iniciar-pdv.bat`.

## Usuários iniciais (seed)

| E-mail | Senha | Destino |
|--------|--------|---------|
| `admin@pdv.local` | `admin123` | `/admin/dashboard` |
| `operador@pdv.local` | `operador123` | `/pdv` |

Altere essas senhas em produção.

## npm (desenvolvimento)

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm run start` | Produção |
| `npm run db:up` / `db:down` | PostgreSQL via Docker Compose |
| `npm run db:seed` | Usuários de teste |
| `npm run db:studio` | Prisma Studio |
