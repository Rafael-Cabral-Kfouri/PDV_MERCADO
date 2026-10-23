"use client";

import { formatCurrencyBRL } from "@/lib/format";

type PdvSidebarProps = {
  totalGeral: number;
  qtdItens: number;
  caixaOcupado: boolean;
  pending: boolean;
  onFinalizar: () => void;
  onCancelar: () => void;
};

/**
 * Lateral do PDV com total da venda, ações F4/F8 e lista de atalhos.
 *
 * @param props.totalGeral - Soma dos itens do carrinho.
 * @param props.qtdItens - Quantidade de linhas no carrinho.
 * @param props.caixaOcupado - Se há venda em andamento.
 * @param props.pending - Se a finalização está em transition.
 * @param props.onFinalizar - Abre o modal de pagamento (F4).
 * @param props.onCancelar - Cancela a venda (F8).
 */
export function PdvSidebar({
  totalGeral,
  qtdItens,
  caixaOcupado,
  pending,
  onFinalizar,
  onCancelar,
}: PdvSidebarProps) {
  return (
    <aside className="flex shrink-0 flex-col gap-4 border-t border-zinc-700 bg-zinc-950 p-4 lg:border-t-0 lg:border-l">
      <div className="rounded-2xl bg-emerald-600 p-6 text-white shadow-lg">
        <p className="text-sm font-medium text-emerald-100">
          Valor total da venda
        </p>
        <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums">
          {formatCurrencyBRL(totalGeral)}
        </p>
        <p className="mt-3 text-sm text-emerald-100">{qtdItens} item(ns)</p>
      </div>

      <button
        type="button"
        onClick={onFinalizar}
        disabled={!caixaOcupado || qtdItens === 0 || pending}
        className="rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Finalizar venda (F4)
      </button>
      <button
        type="button"
        onClick={onCancelar}
        disabled={!caixaOcupado || pending}
        className="rounded-xl border border-red-500/50 py-3 text-sm font-semibold text-red-300 hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Cancelar venda (F8)
      </button>

      <div className="rounded-xl border border-zinc-700 p-4 text-xs text-zinc-400">
        <p className="font-medium text-zinc-300">Atalhos</p>
        <ul className="mt-2 space-y-1">
          <li>
            <kbd className="text-zinc-200">F2</kbd> — Nova venda
          </li>
          <li>
            <kbd className="text-zinc-200">F4</kbd> — Finalizar
          </li>
          <li>
            <kbd className="text-zinc-200">F8</kbd> — Cancelar venda
          </li>
          <li>
            <kbd className="text-zinc-200">Enter</kbd> — Confirmar código
          </li>
          <li>
            <kbd className="text-zinc-200">3*codigo</kbd> — Qtd × produto
          </li>
          <li>Produtos por kg pedem o peso ao bipar</li>
          <li>
            <kbd className="text-zinc-200">Esc</kbd> — Limpar busca
          </li>
        </ul>
      </div>
    </aside>
  );
}
