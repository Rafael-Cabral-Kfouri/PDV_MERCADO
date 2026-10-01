import { auth } from "@/auth";
import { PdvScreen } from "@/components/pdv/pdv-screen";
import { obterConfigLoja } from "@/lib/actions/settings";

/**
 * Página da frente de caixa operacional (/pdv).
 * Renderiza a tela otimizada para teclado e leitor de código de barras.
 */
export default async function PdvPage() {
  const session = await auth();
  const loja = await obterConfigLoja();

  return (
    <PdvScreen
      operadorNome={session?.user?.nome ?? "Operador"}
      isAdmin={session?.user?.funcao === "ADMIN"}
      loja={loja}
    />
  );
}
