import { hash } from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Popula usuários iniciais para desenvolvimento e testes de login/RBAC.
 * Admin → /admin/dashboard | Operador → /pdv
 */
async function main() {
  const senhaAdmin = await hash("admin123", 10);
  const senhaOperador = await hash("operador123", 10);

  await prisma.user.upsert({
    where: { email: "admin@pdv.local" },
    update: {
      nome: "Administrador",
      senhaHash: senhaAdmin,
      funcao: Role.ADMIN,
    },
    create: {
      nome: "Administrador",
      email: "admin@pdv.local",
      senhaHash: senhaAdmin,
      funcao: Role.ADMIN,
      cpf: "00000000000",
    },
  });

  await prisma.user.upsert({
    where: { email: "operador@pdv.local" },
    update: {
      nome: "Operador de Caixa",
      senhaHash: senhaOperador,
      funcao: Role.CASHIER,
    },
    create: {
      nome: "Operador de Caixa",
      email: "operador@pdv.local",
      senhaHash: senhaOperador,
      funcao: Role.CASHIER,
      cpf: "11111111111",
    },
  });

  console.log("Seed OK:");
  console.log("  admin@pdv.local / admin123 (ADMIN)");
  console.log("  operador@pdv.local / operador123 (CASHIER)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
