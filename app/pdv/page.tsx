import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PdvScreen } from "@/components/pdv/pdv-screen";
import { obterConfigLoja } from "@/lib/actions/settings";
import { prisma } from "@/lib/prisma";

/**
 * Página da frente de caixa operacional (/pdv).
 * Revalida o usuário no banco: excluído → `/login`.
 * Renderiza a tela otimizada para teclado e leitor de código de barras.
 */
export default async function PdvPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { nome: true, funcao: true },
  });

  if (!user) {
    redirect("/login");
  }

  const loja = await obterConfigLoja();

  return (
    <PdvScreen
      operadorNome={user.nome}
      isAdmin={user.funcao === "ADMIN"}
      loja={loja}
    />
  );
}
