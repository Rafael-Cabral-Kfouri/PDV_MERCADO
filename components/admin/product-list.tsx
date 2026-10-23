"use client";

import { formatCurrencyBRL, formatQuantidade } from "@/lib/format";
import {
  formatValidadePtBR,
  isAlertaProdutoVencido,
  mensagemAlertaValidade,
  parseDateInputValue,
} from "@/lib/validade-produto";
import type { ProductRow } from "@/components/admin/product-types";

type ProductListProps = {
  produtos: ProductRow[];
  busca: string;
  onBuscaChange: (valor: string) => void;
  pending: boolean;
  onEditar: (produto: ProductRow) => void;
  onExcluir: (id: string, nome: string) => void;
};

/**
 * Listagem de produtos com busca rápida, alertas de validade e ações.
 *
 * @param props.produtos - Lista já filtrada (ou completa) a exibir.
 * @param props.busca - Termo de busca controlado.
 * @param props.onBuscaChange - Atualiza o termo de busca.
 * @param props.pending - Desabilita exclusão durante transition.
 * @param props.onEditar - Preenche o formulário com o produto.
 * @param props.onExcluir - Confirma e exclui o produto.
 */
export function ProductList({
  produtos,
  busca,
  onBuscaChange,
  pending,
  onEditar,
  onExcluir,
}: ProductListProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">
            Listagem de produtos
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {produtos.length} produto(s)
          </p>
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:max-w-xs">
          <label htmlFor="busca" className="text-sm font-medium text-zinc-700">
            Busca rápida
          </label>
          <input
            id="busca"
            value={busca}
            onChange={(e) => onBuscaChange(e.target.value)}
            placeholder="Nome ou código de barras"
            className="rounded-lg border border-zinc-300 px-3 py-2 outline-none ring-emerald-600 focus:ring-2"
          />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500">
            <tr>
              <th className="px-2 py-2 font-medium">Foto</th>
              <th className="px-2 py-2 font-medium">Nome</th>
              <th className="px-2 py-2 font-medium">Código</th>
              <th className="px-2 py-2 font-medium">Cobrança</th>
              <th className="px-2 py-2 font-medium">Preço</th>
              <th className="px-2 py-2 font-medium">Promoção</th>
              <th className="px-2 py-2 font-medium">Estoque</th>
              <th className="px-2 py-2 font-medium">Validade</th>
              <th className="px-2 py-2 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {produtos.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-2 py-6 text-center text-zinc-500">
                  Nenhum produto encontrado.
                </td>
              </tr>
            ) : (
              produtos.map((produto) => {
                const alerta = mensagemAlertaValidade(
                  parseDateInputValue(produto.dataValidade),
                );
                const vencido = isAlertaProdutoVencido(alerta);

                return (
                  <tr
                    key={produto.id}
                    className="border-b border-zinc-100 text-zinc-800"
                  >
                    <td className="px-2 py-3">
                      {produto.fotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- uploads dinâmicos em /public
                        <img
                          src={produto.fotoUrl}
                          alt={produto.nome}
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded bg-zinc-100 text-[10px] text-zinc-400">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3">{produto.nome}</td>
                    <td className="px-2 py-3 font-mono text-xs">
                      {produto.codigoBarras}
                    </td>
                    <td className="px-2 py-3">
                      {produto.unidadeVenda === "KG" ? "kg" : "un"}
                    </td>
                    <td className="px-2 py-3">
                      {formatCurrencyBRL(Number(produto.precoUnitario))}
                      {produto.unidadeVenda === "KG" ? "/kg" : ""}
                    </td>
                    <td className="px-2 py-3">
                      {produto.promocaoAtiva &&
                      produto.quantidadeMinimaPromocao != null &&
                      produto.precoPromocional != null ? (
                        <span className="text-xs text-emerald-800">
                          ≥{produto.quantidadeMinimaPromocao} un →{" "}
                          {formatCurrencyBRL(Number(produto.precoPromocional))}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      {formatQuantidade(
                        Number(produto.quantidadeEstoque),
                        produto.unidadeVenda,
                      )}
                    </td>
                    <td className="px-2 py-3">
                      {produto.dataValidade ? (
                        <div className="flex flex-col gap-0.5">
                          <span>
                            {formatValidadePtBR(produto.dataValidade)}
                          </span>
                          {alerta ? (
                            <span
                              className={
                                vencido
                                  ? "text-xs font-semibold text-red-700"
                                  : "text-xs font-medium text-amber-700"
                              }
                            >
                              {alerta}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => onEditar(produto)}
                          className="text-emerald-700 hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => onExcluir(produto.id, produto.nome)}
                          className="text-red-600 hover:underline"
                          disabled={pending}
                        >
                          Excluir
                        </button>
                      </div>
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
