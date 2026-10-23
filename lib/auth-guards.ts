import { auth } from "@/auth";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

/**
 * Garante que há um usuário autenticado e que ele ainda existe no banco.
 * A função (`ADMIN`/`CASHIER`) considerada é a do BANCO, não a do JWT.
 *
 * @returns Sessão com `user.funcao` e `user.nome` atualizados a partir do banco.
 * @throws AppError se não houver sessão ou se o usuário tiver sido excluído.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AppError("Acesso não autorizado.");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, nome: true, funcao: true },
  });

  if (!user) {
    throw new AppError("Acesso não autorizado.");
  }

  session.user.funcao = user.funcao;
  session.user.nome = user.nome;
  return session;
}

/**
 * Garante que a requisição vem de um ADMIN ainda existente no banco.
 * A função considerada é a do BANCO (usuário rebaixado deixa de passar).
 *
 * @returns Sessão do admin autenticado.
 * @throws AppError se não autenticado ou se a função no banco não for ADMIN.
 */
export async function requireAdmin() {
  const session = await requireAuth();
  if (session.user.funcao !== "ADMIN") {
    throw new AppError("Acesso não autorizado.");
  }
  return session;
}
