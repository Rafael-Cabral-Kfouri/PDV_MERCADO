import { SettingsForm } from "@/components/admin/settings-form";
import { obterConfigLoja } from "@/lib/actions/settings";

/**
 * Página admin de configurações do estabelecimento e impressão de recibo.
 */
export default async function AdminConfiguracoesPage() {
  const config = await obterConfigLoja();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold text-zinc-900">Configurações</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Dados do recibo não fiscal e opção de impressão automática.
        </p>
      </div>
      <SettingsForm initial={config} />
    </div>
  );
}
