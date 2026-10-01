import { auth } from "@/auth";

/**
 * Garante que a requisição vem de um usuário autenticado com perfil ADMIN.
 *
 * @returns Sessão do admin autenticado.
 * @throws Error se não autenticado ou se a função não for ADMIN.
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.funcao !== "ADMIN") {
    throw new Error("Acesso não autorizado.");
  }
  return session;
}

/**
 * Garante que há um usuário autenticado (Admin ou Operador) para o PDV.
 *
 * @returns Sessão do usuário logado.
 * @throws Error se não houver sessão autenticada.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Acesso não autorizado.");
  }
  return session;
}
