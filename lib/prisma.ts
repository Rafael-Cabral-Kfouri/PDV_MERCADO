import { PrismaClient } from "@prisma/client";

/**
 * Retorna (ou cria) uma instância singleton do PrismaClient.
 *
 * Em desenvolvimento o Next.js faz hot-reload e, sem este padrão,
 * várias conexões ao PostgreSQL seriam abertas a cada reload.
 *
 * @returns Instância compartilhada de PrismaClient para consultas ao banco.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
