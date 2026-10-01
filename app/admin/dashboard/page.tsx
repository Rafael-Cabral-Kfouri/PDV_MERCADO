import Link from "next/link";

/**
 * Dashboard administrativo com atalhos para as telas do admin.
 */
export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-zinc-900">Painel de Controle</h2>
        <p className="mt-1 text-zinc-600">
          Gerencie produtos, funcionários e recibo do mercado.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/produtos"
          className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-emerald-300"
        >
          <h3 className="text-lg font-semibold text-zinc-900">Produtos</h3>
          <p className="mt-2 text-sm text-zinc-600">
            Cadastro com código de barras, preço, estoque e listagem com busca.
          </p>
        </Link>
        <Link
          href="/admin/funcionarios"
          className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-emerald-300"
        >
          <h3 className="text-lg font-semibold text-zinc-900">Funcionários</h3>
          <p className="mt-2 text-sm text-zinc-600">
            Cadastro com perfil Gerente ou Caixa e documentos (CPF, RG, endereço).
          </p>
        </Link>
        <Link
          href="/admin/configuracoes"
          className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-emerald-300"
        >
          <h3 className="text-lg font-semibold text-zinc-900">Configurações</h3>
          <p className="mt-2 text-sm text-zinc-600">
            Dados do estabelecimento e impressão automática do recibo 80mm.
          </p>
        </Link>
      </div>
    </div>
  );
}
