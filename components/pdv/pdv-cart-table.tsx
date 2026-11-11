"use client";

import type { UnidadeVenda } from "@prisma/client";
import { formatCurrencyBRL } from "@/lib/format";
import { promocaoAplicada } from "@/lib/pdv-utils";
import type { CartItem } from "@/components/pdv/pdv-types";

type PdvCartTableProps = {
  itens: CartItem[];
  onAlterarQuantidade: (
    lineId: string,
    quantidade: number,
    unidadeVenda: UnidadeVenda,
  ) => void;
  onRemover: (lineId: string) => void;
  onBlurQuantidade: () => void;
};

/**
 * Tabela do carrinho da venda atual no PDV.
 *
 * @param props.itens - Linhas do carrinho.
 * @param props.onAlterarQuantidade - Atualiza qtd/peso de uma linha.
 * @param props.onRemover - Remove a linha pelo `lineId`.
 * @param props.onBlurQuantidade - Callback ao sair do input de quantidade (refoco).
 */
export function PdvCartTable({
  itens,
  onAlterarQuantidade,
  onRemover,
  onBlurQuantidade,
}: PdvCartTableProps) {
  return (
    <section className="min-h-0 flex-1 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950">
      <div className="border-b border-zinc-700 px-4 py-2 text-xs font-medium tracking-wide text-zinc-400 uppercase">
        Itens da venda
      </div>
      <div className="h-[calc(100%-2.25rem)] overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-zinc-900 text-xs text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Código</th>
              <th className="px-3 py-2 font-medium">Produto</th>
              <th className="px-3 py-2 font-medium">Qtd</th>
              <th className="px-3 py-2 font-medium">Unit.</th>
              <th className="px-3 py-2 font-medium">Total</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-10 text-center text-zinc-500"
                >
                  Nenhum item. Bipe um produto para começar.
                </td>
              </tr>
            ) : (
              itens.map((item, index) => {
                const emPromo = promocaoAplicada(
                  {
                    promocaoAtiva: item.promocaoAtiva,
                    quantidadeMinimaPromocao: item.quantidadeMinimaPromocao,
                    precoPromocional: item.precoPromocional,
                  },
                  item.quantidade,
                );
                return (
                  <tr
                    key={item.lineId}
                    className="border-t border-zinc-800 text-zinc-100"
                  >
                    <td className="px-3 py-2 tabular-nums text-zinc-400">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {item.codigoBarras}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-0.5">
                        <span>{item.nome}</span>
                        {emPromo ? (
                          <span className="w-fit rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-300 uppercase">
                            Promo · a partir de {item.quantidadeMinimaPromocao}{" "}
                            un
                          </span>
                        ) : item.promocaoAtiva &&
                          item.quantidadeMinimaPromocao != null ? (
                          <span className="text-[10px] text-zinc-500">
                            Promo a partir de {item.quantidadeMinimaPromocao} un
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={item.unidadeVenda === "KG" ? 0.001 : 1}
                          step={item.unidadeVenda === "KG" ? 0.001 : 1}
                          value={item.quantidade}
                          onChange={(e) =>
                            onAlterarQuantidade(
                              item.lineId,
                              Number(e.target.value),
                              item.unidadeVenda,
                            )
                          }
                          onBlur={onBlurQuantidade}
                          className="w-20 rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-center outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <span className="text-xs text-zinc-500">
                          {item.unidadeVenda === "KG" ? "kg" : "un"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {emPromo ? (
                        <div className="flex flex-col">
                          <span className="text-xs text-zinc-500 line-through">
                            {formatCurrencyBRL(item.precoNormal)}
                          </span>
                          <span className="font-medium text-amber-300">
                            {formatCurrencyBRL(item.precoUnitario)}
                          </span>
                        </div>
                      ) : (
                        <>
                          {formatCurrencyBRL(item.precoUnitario)}
                          {item.unidadeVenda === "KG" ? (
                            <span className="text-xs text-zinc-500">/kg</span>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium tabular-nums">
                      {formatCurrencyBRL(
                        item.quantidade * item.precoUnitario,
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => onRemover(item.lineId)}
                        className="text-xs text-red-400 hover:underline"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
