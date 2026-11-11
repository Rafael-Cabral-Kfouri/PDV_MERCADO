import { hash } from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

const SENHA_ADMIN_PADRAO = "admin123";
const SENHA_OPERADOR_PADRAO = "operador123";

/**
 * Popula usuários iniciais para desenvolvimento e testes de login/RBAC.
 * Senhas: `SEED_ADMIN_PASSWORD` / `SEED_OPERADOR_PASSWORD` ou padrões com aviso.
 * Admin → /admin/dashboard | Operador → /pdv
 */
async function main() {
  const senhaAdminPlain =
    process.env.SEED_ADMIN_PASSWORD?.trim() || SENHA_ADMIN_PADRAO;
  const senhaOperadorPlain =
    process.env.SEED_OPERADOR_PASSWORD?.trim() || SENHA_OPERADOR_PADRAO;

  if (!process.env.SEED_ADMIN_PASSWORD?.trim()) {
    console.warn(
      `[AVISO] SEED_ADMIN_PASSWORD nao definida; usando senha padrao "${SENHA_ADMIN_PADRAO}". Troque em producao.`,
    );
  }
  if (!process.env.SEED_OPERADOR_PASSWORD?.trim()) {
    console.warn(
      `[AVISO] SEED_OPERADOR_PASSWORD nao definida; usando senha padrao "${SENHA_OPERADOR_PADRAO}". Troque em producao.`,
    );
  }

  const senhaAdmin = await hash(senhaAdminPlain, 10);
  const senhaOperador = await hash(senhaOperadorPlain, 10);

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
  console.log(`  admin@pdv.local / ${senhaAdminPlain} (ADMIN)`);
  console.log(`  operador@pdv.local / ${senhaOperadorPlain} (CASHIER)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
