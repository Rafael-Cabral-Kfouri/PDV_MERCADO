# PDV Mercado

Aplicação web de Ponto de Venda para supermercado.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- PostgreSQL + Prisma
- Auth.js (NextAuth v5) com JWT

## Setup

1. Instale dependências: `npm install`
2. Suba o banco: `npm run db:up` (requer Docker)
3. Aplique migrations: `npx prisma migrate dev`
4. Popule usuários de teste: `npm run db:seed`
5. Rode a app: `npm run dev`

Variáveis de ambiente: copie `.env.example` para `.env`.

## Usuários de teste (seed)

| E-mail | Senha | Destino |
|--------|--------|---------|
| `admin@pdv.local` | `admin123` | `/admin/dashboard` |
| `operador@pdv.local` | `operador123` | `/pdv` |

## Scripts úteis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run db:up` | Sobe PostgreSQL (Docker Compose) |
| `npm run db:down` | Para o PostgreSQL |
| `npm run db:migrate` | Cria/aplica migrations |
| `npm run db:seed` | Cria admin e operador de teste |
| `npm run db:studio` | Abre Prisma Studio |
