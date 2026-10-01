"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  salvarConfigLojaAction,
  type StoreSettingsDTO,
} from "@/lib/actions/settings";
import { useToast } from "@/components/ui/toast";

/**
 * Formulário de configurações do estabelecimento (recibo e impressão).
 *
 * @param initial - Valores atuais salvos no banco.
 */
export function SettingsForm({ initial }: { initial: StoreSettingsDTO }) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(initial);

  /**
   * Envia o formulário e atualiza as configs da loja.
   *
   * @param e - Evento de submit.
   */
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await salvarConfigLojaAction(null, formData);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-xl space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="nomeEstabelecimento"
          className="text-sm font-medium text-zinc-700"
        >
          Nome do estabelecimento
        </label>
        <input
          id="nomeEstabelecimento"
          name="nomeEstabelecimento"
          required
          value={form.nomeEstabelecimento}
          onChange={(e) =>
            setForm((p) => ({ ...p, nomeEstabelecimento: e.target.value }))
          }
          className="rounded-lg border border-zinc-300 px-3 py-2 outline-none ring-emerald-600 focus:ring-2"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="cnpj" className="text-sm font-medium text-zinc-700">
          CNPJ
        </label>
        <input
          id="cnpj"
          name="cnpj"
          value={form.cnpj}
          onChange={(e) => setForm((p) => ({ ...p, cnpj: e.target.value }))}
          placeholder="00.000.000/0001-00"
          className="rounded-lg border border-zinc-300 px-3 py-2 outline-none ring-emerald-600 focus:ring-2"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="endereco" className="text-sm font-medium text-zinc-700">
          Endereço
        </label>
        <input
          id="endereco"
          name="endereco"
          value={form.endereco}
          onChange={(e) => setForm((p) => ({ ...p, endereco: e.target.value }))}
          className="rounded-lg border border-zinc-300 px-3 py-2 outline-none ring-emerald-600 focus:ring-2"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="mensagemRodape"
          className="text-sm font-medium text-zinc-700"
        >
          Mensagem do rodapé do recibo
        </label>
        <input
          id="mensagemRodape"
          name="mensagemRodape"
          value={form.mensagemRodape}
          onChange={(e) =>
            setForm((p) => ({ ...p, mensagemRodape: e.target.value }))
          }
          className="rounded-lg border border-zinc-300 px-3 py-2 outline-none ring-emerald-600 focus:ring-2"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          name="imprimirAutomatico"
          checked={form.imprimirAutomatico}
          onChange={(e) =>
            setForm((p) => ({ ...p, imprimirAutomatico: e.target.checked }))
          }
          className="size-4 accent-emerald-700"
        />
        Imprimir recibo automaticamente ao finalizar a venda
      </label>
      <p className="text-xs text-zinc-500">
        A impressora é escolhida no diálogo do navegador/Windows (não pelo app
        web). Largura do layout: bobina 80mm.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {pending ? "Salvando…" : "Salvar configurações"}
      </button>
    </form>
  );
}
