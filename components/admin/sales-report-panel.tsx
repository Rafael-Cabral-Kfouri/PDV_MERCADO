"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import type { PaymentMethod } from "@prisma/client";
import {
  obterRelatorioVendas,
  type OperadorOption,
  type PeriodoPreset,
  type RelatorioFiltros,
  type RelatorioVendas,
} from "@/lib/actions/sales-report";
import { formatCurrencyBRL, formatQuantidade } from "@/lib/format";

const FORMA_LABEL: Record<PaymentMethod, string> = {
  DINHEIRO: "Dinheiro",
  CARTAO_CREDITO: "Cartão de crédito",
  CARTAO_DEBITO: "Cartão de débito",
  PIX: "PIX",
};

const MESES = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

type FilterState = {
  preset: PeriodoPreset;
  ano: number;
  mes: number;
  dataInicio: string;
  dataFim: string;
  formaPagamento: PaymentMethod | "";
  operadorId: string;
};

/**
 * Formata ISO datetime para exibição pt-BR no fuso de Brasília.
 *
 * @param iso - Data ISO da venda.
 * @returns Ex.: "02/10/2026 15:42".
 */
function formatDataHora(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * Converte o estado dos filtros da UI no payload da server action.
 *
 * @param state - Valores dos controles de filtro.
 * @returns Objeto `RelatorioFiltros` para `obterRelatorioVendas`.
 */
function toFiltros(state: FilterState): RelatorioFiltros {
  return {
    preset: state.preset,
    ano: state.ano,
    mes: state.mes,
    dataInicio: state.dataInicio || undefined,
    dataFim: state.dataFim || undefined,
    formaPagamento: state.formaPagamento || undefined,
    operadorId: state.operadorId || undefined,
  };
}

/**
 * Painel de relatórios de vendas: filtros (incluindo mês), resumo,
 * breakdown por pagamento, lista expansível e ranking de produtos.
 *
 * @param initialRelatorio - Relatório carregado no servidor (mês atual).
 * @param operadores - Lista de operadores para o filtro.
 * @param initialFilters - Filtros iniciais alinhados ao relatório.
 */
export function SalesReportPanel({
  initialRelatorio,
  operadores,
  initialFilters,
}: {
  initialRelatorio: RelatorioVendas;
  operadores: OperadorOption[];
  initialFilters: FilterState;
}) {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [relatorio, setRelatorio] = useState(initialRelatorio);
  const [erro, setErro] = useState<string | null>(null);
  const [vendaAbertaId, setVendaAbertaId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const anos = useMemo(() => {
    const atual = initialFilters.ano;
    return [atual - 2, atual - 1, atual, atual + 1];
  }, [initialFilters.ano]);

  /**
   * Atualiza um campo do formulário de filtros.
   *
   * @param patch - Campos parciais a mesclar no estado.
   */
  function atualizarFiltro(patch: Partial<FilterState>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  /**
   * Dispara a busca do relatório com os filtros atuais.
   */
  function aplicarFiltros() {
    setErro(null);
    startTransition(async () => {
      try {
        const data = await obterRelatorioVendas(toFiltros(filters));
        setRelatorio(data);
        setVendaAbertaId(null);
      } catch (e) {
        setErro(
          e instanceof Error ? e.message : "Erro ao carregar o relatório.",
        );
      }
    });
  }

  /**
   * Alterna a expansão dos itens de uma venda na lista.
   *
   * @param id - Id da venda.
   */
  function toggleVenda(id: string) {
    setVendaAbertaId((atual) => (atual === id ? null : id));
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">Filtros</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Período
            <select
              value={filters.preset}
              onChange={(e) =>
                atualizarFiltro({ preset: e.target.value as PeriodoPreset })
              }
              className="rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="hoje">Hoje</option>
              <option value="ontem">Ontem</option>
              <option value="este_mes">Este mês</option>
              <option value="mes_passado">Mês passado</option>
              <option value="mes">Mês específico</option>
              <option value="intervalo">Intervalo livre</option>
            </select>
          </label>

          {filters.preset === "mes" ? (
            <>
              <label className="flex flex-col gap-1 text-sm text-zinc-700">
                Mês
                <select
                  value={filters.mes}
                  onChange={(e) =>
                    atualizarFiltro({ mes: Number(e.target.value) })
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {MESES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-zinc-700">
                Ano
                <select
                  value={filters.ano}
                  onChange={(e) =>
                    atualizarFiltro({ ano: Number(e.target.value) })
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {anos.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          {filters.preset === "intervalo" ? (
            <>
              <label className="flex flex-col gap-1 text-sm text-zinc-700">
                Data inicial
                <input
                  type="date"
                  value={filters.dataInicio}
                  onChange={(e) =>
                    atualizarFiltro({ dataInicio: e.target.value })
                  }
                  className="rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-zinc-700">
                Data final
                <input
                  type="date"
                  value={filters.dataFim}
                  onChange={(e) => atualizarFiltro({ dataFim: e.target.value })}
                  className="rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </label>
            </>
          ) : null}

          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Forma de pagamento
            <select
              value={filters.formaPagamento}
              onChange={(e) =>
                atualizarFiltro({
                  formaPagamento: e.target.value as PaymentMethod | "",
                })
              }
              className="rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Todas</option>
              <option value="DINHEIRO">Dinheiro</option>
              <option value="PIX">PIX</option>
              <option value="CARTAO_CREDITO">Cartão de crédito</option>
              <option value="CARTAO_DEBITO">Cartão de débito</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Operador
            <select
              value={filters.operadorId}
              onChange={(e) => atualizarFiltro({ operadorId: e.target.value })}
              className="rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Todos</option>
              {operadores.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.nome}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={aplicarFiltros}
            disabled={pending}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {pending ? "Carregando…" : "Gerar relatório"}
          </button>
          <p className="text-sm text-zinc-500">
            Período:{" "}
            <span className="font-medium text-zinc-800">
              {relatorio.periodoLabel}
            </span>
          </p>
        </div>
        {erro ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {erro}
          </p>
        ) : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
            Vendas
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">
            {relatorio.resumo.quantidadeVendas}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
            Faturamento
          </p>
          <p className="mt-1 text-2xl font-semibold text-emerald-800">
            {formatCurrencyBRL(relatorio.resumo.faturamento)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
            Ticket médio
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">
            {formatCurrencyBRL(relatorio.resumo.ticketMedio)}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">
          Por forma de pagamento
        </h3>
        {relatorio.porPagamento.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Sem vendas no período.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100">
            {relatorio.porPagamento.map((row) => (
              <li
                key={row.forma}
                className="flex items-center justify-between gap-4 py-2 text-sm"
              >
                <span className="text-zinc-700">
                  {FORMA_LABEL[row.forma]}{" "}
                  <span className="text-zinc-400">({row.quantidade})</span>
                </span>
                <span className="font-medium text-zinc-900">
                  {formatCurrencyBRL(row.total)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-900">
            Vendas ({relatorio.vendas.length})
          </h3>
          <p className="text-xs text-zinc-500">
            Clique em uma linha para ver os itens.
          </p>
        </div>
        {relatorio.vendas.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">Nenhuma venda encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs tracking-wide text-zinc-500 uppercase">
                <tr>
                  <th className="px-4 py-2 font-medium">Código</th>
                  <th className="px-4 py-2 font-medium">Data</th>
                  <th className="px-4 py-2 font-medium">Operador</th>
                  <th className="px-4 py-2 font-medium">Pagamento</th>
                  <th className="px-4 py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {relatorio.vendas.map((venda) => {
                  const aberta = vendaAbertaId === venda.id;
                  return (
                    <Fragment key={venda.id}>
                      <tr
                        onClick={() => toggleVenda(venda.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleVenda(venda.id);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-expanded={aberta}
                        className="cursor-pointer border-t border-zinc-100 hover:bg-zinc-50"
                      >
                        <td className="px-4 py-2.5 font-mono text-xs text-zinc-800">
                          {venda.codigoVenda}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-700">
                          {formatDataHora(venda.dataVenda)}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-700">
                          {venda.operadorNome}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-700">
                          {venda.formaPagamento
                            ? FORMA_LABEL[venda.formaPagamento]
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-zinc-900">
                          {formatCurrencyBRL(venda.total)}
                        </td>
                      </tr>
                      {aberta ? (
                        <tr className="bg-zinc-50">
                          <td colSpan={5} className="px-4 py-3">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="text-xs text-zinc-500">
                                  <th className="py-1 text-left font-medium">
                                    Produto
                                  </th>
                                  <th className="py-1 text-right font-medium">
                                    Qtd
                                  </th>
                                  <th className="py-1 text-right font-medium">
                                    Unit.
                                  </th>
                                  <th className="py-1 text-right font-medium">
                                    Total
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {venda.itens.map((item, idx) => (
                                  <tr key={`${venda.id}-${idx}`}>
                                    <td className="py-1 text-zinc-800">
                                      {item.produtoNome}
                                      <span className="ml-2 font-mono text-xs text-zinc-400">
                                        {item.codigoBarras}
                                      </span>
                                    </td>
                                    <td className="py-1 text-right text-zinc-700">
                                      {formatQuantidade(
                                        item.quantidade,
                                        item.unidadeVenda,
                                      )}
                                    </td>
                                    <td className="py-1 text-right text-zinc-700">
                                      {formatCurrencyBRL(item.precoUnitario)}
                                    </td>
                                    <td className="py-1 text-right font-medium text-zinc-900">
                                      {formatCurrencyBRL(item.precoTotal)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-900">
            Ranking de produtos
          </h3>
          <p className="text-xs text-zinc-500">
            Mais vendidos no período (por quantidade).
          </p>
        </div>
        {relatorio.ranking.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">Sem itens no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs tracking-wide text-zinc-500 uppercase">
                <tr>
                  <th className="px-4 py-2 font-medium">#</th>
                  <th className="px-4 py-2 font-medium">Produto</th>
                  <th className="px-4 py-2 font-medium text-right">Qtd</th>
                  <th className="px-4 py-2 font-medium text-right">
                    Faturamento
                  </th>
                </tr>
              </thead>
              <tbody>
                {relatorio.ranking.map((row, index) => (
                  <tr
                    key={row.produtoId}
                    className="border-t border-zinc-100 text-zinc-800"
                  >
                    <td className="px-4 py-2 text-zinc-500">{index + 1}</td>
                    <td className="px-4 py-2">
                      {row.nome}
                      <span className="ml-2 font-mono text-xs text-zinc-400">
                        {row.codigoBarras}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {formatQuantidade(row.quantidade, row.unidadeVenda)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {formatCurrencyBRL(row.faturamento)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
