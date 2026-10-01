"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { PaymentMethod } from "@prisma/client";
import {
  buscarProdutoPorCodigo,
  buscarProdutosSugestao,
  type PdvProduct,
} from "@/lib/actions/pdv";
import { finalizarVendaAction } from "@/lib/actions/sale";
import { logoutAction } from "@/lib/actions/auth";
import { formatCurrencyBRL } from "@/lib/format";
import {
  gerarCodigoVenda,
  parseQtyPrefix,
  pareceCodigoBarras,
} from "@/lib/pdv-utils";
import { PaymentModal } from "@/components/pdv/payment-modal";
import {
  SaleSuccessModal,
  type SaleSuccessInfo,
} from "@/components/pdv/sale-success-modal";
import type { StoreSettingsDTO } from "@/lib/actions/settings";

export type CartItem = {
  lineId: string;
  produtoId: string;
  codigoBarras: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
};

type PdvScreenProps = {
  operadorNome: string;
  isAdmin: boolean;
  loja: StoreSettingsDTO;
};

const FORMA_LABEL: Record<PaymentMethod, string> = {
  DINHEIRO: "Dinheiro",
  CARTAO_CREDITO: "Cartão de crédito",
  CARTAO_DEBITO: "Cartão de débito",
  PIX: "PIX",
};

/**
 * Tela operacional do PDV (padrão de mercado).
 * F2 nova venda · F4 finalizar · F8 cancelar · bipagem / nome / NxCODIGO.
 *
 * @param operadorNome - Nome do usuário logado (cabeçalho).
 * @param isAdmin - Se true, exibe link para o painel admin.
 * @param loja - Configurações do estabelecimento (recibo / auto-print).
 */
export function PdvScreen({ operadorNome, isAdmin, loja }: PdvScreenProps) {
  const [agora, setAgora] = useState(() => new Date());
  const [codigoVenda, setCodigoVenda] = useState<string | null>(null);
  const [itens, setItens] = useState<CartItem[]>([]);
  const [input, setInput] = useState("");
  const [sugestoes, setSugestoes] = useState<PdvProduct[]>([]);
  const [sugestaoIndex, setSugestaoIndex] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [ultimoProduto, setUltimoProduto] = useState<PdvProduct | null>(null);
  const [modalPagamento, setModalPagamento] = useState(false);
  const [sucesso, setSucesso] = useState<SaleSuccessInfo | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const caixaOcupado = codigoVenda !== null;
  const modalAberto = modalPagamento || sucesso !== null;

  const totalGeral = useMemo(
    () =>
      itens.reduce((acc, item) => acc + item.quantidade * item.precoUnitario, 0),
    [itens],
  );

  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  /**
   * Foca o input principal (uso contínuo de bipagem).
   */
  const focarInput = useCallback(() => {
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  useEffect(() => {
    if (!modalAberto) focarInput();
  }, [focarInput, modalAberto]);

  /**
   * Inicia nova venda (F2): gera código, limpa carrinho e foca o input.
   */
  const iniciarVenda = useCallback(() => {
    setSucesso(null);
    setModalPagamento(false);
    setCodigoVenda(gerarCodigoVenda());
    setItens([]);
    setInput("");
    setSugestoes([]);
    setFeedback(null);
    setUltimoProduto(null);
    focarInput();
  }, [focarInput]);

  /**
   * Cancela a venda atual (F8): limpa tudo e volta para Caixa Livre.
   */
  const cancelarVenda = useCallback(() => {
    if (!caixaOcupado && !sucesso) return;
    if (itens.length > 0) {
      const ok = window.confirm(
        "Cancelar a venda atual? Os itens do carrinho serão descartados.",
      );
      if (!ok) return;
    }
    setModalPagamento(false);
    setSucesso(null);
    setCodigoVenda(null);
    setItens([]);
    setInput("");
    setSugestoes([]);
    setUltimoProduto(null);
    setFeedback("Venda cancelada. Caixa Livre — pressione F2 para nova venda.");
    focarInput();
  }, [caixaOcupado, sucesso, itens.length, focarInput]);

  /**
   * Abre o modal de pagamento (F4), se houver itens.
   */
  const abrirFinalizacao = useCallback(() => {
    if (!caixaOcupado) {
      setFeedback("Pressione F2 para iniciar uma nova venda.");
      return;
    }
    if (itens.length === 0) {
      setFeedback("Adicione ao menos um item antes de finalizar.");
      return;
    }
    setSugestoes([]);
    setModalPagamento(true);
  }, [caixaOcupado, itens.length]);

  /**
   * Adiciona produto ao carrinho (mesma SKU soma quantidade).
   *
   * @param produto - Produto do banco.
   * @param quantidade - Quantidade a adicionar.
   */
  const adicionarProduto = useCallback(
    (produto: PdvProduct, quantidade: number) => {
      if (!caixaOcupado) {
        setFeedback("Pressione F2 para iniciar uma nova venda.");
        focarInput();
        return;
      }

      const qty = Math.max(1, Math.floor(quantidade));
      if (produto.quantidadeEstoque < qty) {
        setFeedback(
          `Estoque insuficiente: ${produto.nome} (disp. ${produto.quantidadeEstoque}).`,
        );
        focarInput();
        return;
      }

      setItens((prev) => {
        const idx = prev.findIndex((i) => i.produtoId === produto.id);
        if (idx >= 0) {
          const novaQty = prev[idx].quantidade + qty;
          if (novaQty > produto.quantidadeEstoque) {
            setFeedback(
              `Estoque insuficiente: ${produto.nome} (disp. ${produto.quantidadeEstoque}).`,
            );
            return prev;
          }
          const next = [...prev];
          next[idx] = { ...next[idx], quantidade: novaQty };
          return next;
        }
        return [
          ...prev,
          {
            lineId: `${produto.id}-${Date.now()}`,
            produtoId: produto.id,
            codigoBarras: produto.codigoBarras,
            nome: produto.nome,
            quantidade: qty,
            precoUnitario: produto.precoUnitario,
          },
        ];
      });
      setInput("");
      setSugestoes([]);
      setUltimoProduto(produto);
      setFeedback(`${produto.nome} · +${qty}`);
      focarInput();
    },
    [caixaOcupado, focarInput],
  );

  /**
   * Resolve Enter no input: código adiciona; nome usa sugestões.
   */
  const confirmarInput = useCallback(async () => {
    const raw = input.trim();
    if (!raw || modalAberto) return;

    if (!caixaOcupado) {
      setFeedback("Pressione F2 para iniciar uma nova venda.");
      return;
    }

    const { quantidade, termo } = parseQtyPrefix(raw);

    if (sugestoes.length > 0 && !pareceCodigoBarras(termo)) {
      const escolhido = sugestoes[sugestaoIndex] ?? sugestoes[0];
      adicionarProduto(escolhido, quantidade);
      return;
    }

    setBuscando(true);
    setFeedback(null);
    try {
      if (pareceCodigoBarras(termo)) {
        const produto = await buscarProdutoPorCodigo(termo);
        if (!produto) {
          setFeedback(`Produto não encontrado: ${termo}`);
          setInput("");
          focarInput();
          return;
        }
        adicionarProduto(produto, quantidade);
        return;
      }

      const lista = await buscarProdutosSugestao(termo);
      if (lista.length === 0) {
        setFeedback("Nenhum produto encontrado. Refine a busca.");
        setSugestoes([]);
        return;
      }
      if (lista.length === 1) {
        adicionarProduto(lista[0], quantidade);
        return;
      }
      setSugestoes(lista);
      setSugestaoIndex(0);
      setFeedback("Selecione um produto na lista (↑↓ + Enter) ou clique.");
    } finally {
      setBuscando(false);
    }
  }, [
    input,
    modalAberto,
    caixaOcupado,
    sugestoes,
    sugestaoIndex,
    adicionarProduto,
    focarInput,
  ]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const valor = input.trim();
    const { termo } = parseQtyPrefix(valor);

    if (!caixaOcupado || modalAberto || termo.length < 2 || pareceCodigoBarras(termo)) {
      if (!pareceCodigoBarras(termo) && termo.length < 2) setSugestoes([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const lista = await buscarProdutosSugestao(termo);
      setSugestoes(lista);
      setSugestaoIndex(0);
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input, caixaOcupado, modalAberto]);

  useEffect(() => {
    /**
     * Atalhos: F2 nova · F4 finalizar · F8 cancelar · Esc limpa busca.
     */
    function onKeyDown(e: KeyboardEvent) {
      if (modalAberto) return;

      if (e.key === "F2") {
        e.preventDefault();
        iniciarVenda();
        return;
      }
      if (e.key === "F4") {
        e.preventDefault();
        abrirFinalizacao();
        return;
      }
      if (e.key === "F8") {
        e.preventDefault();
        cancelarVenda();
        return;
      }
      if (e.key === "Escape") {
        setSugestoes([]);
        setInput("");
        focarInput();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalAberto, iniciarVenda, abrirFinalizacao, cancelarVenda, focarInput]);

  /**
   * Remove um item do carrinho.
   *
   * @param lineId - Id da linha.
   */
  function removerItem(lineId: string) {
    setItens((prev) => prev.filter((i) => i.lineId !== lineId));
    focarInput();
  }

  /**
   * Altera quantidade de uma linha (mínimo 1).
   *
   * @param lineId - Id da linha.
   * @param quantidade - Nova quantidade.
   */
  function alterarQuantidade(lineId: string, quantidade: number) {
    const qty = Math.floor(quantidade);
    if (!Number.isFinite(qty) || qty < 1) return;
    setItens((prev) =>
      prev.map((i) => (i.lineId === lineId ? { ...i, quantidade: qty } : i)),
    );
  }

  /**
   * Confirma pagamento: persiste venda, baixa estoque e abre modal de sucesso.
   *
   * @param forma - Forma de pagamento.
   * @param valorPago - Valor pago (dinheiro).
   */
  function confirmarPagamento(forma: PaymentMethod, valorPago?: number) {
    if (!codigoVenda) return;

    const itensSnapshot = itens.map((i) => ({
      quantidade: i.quantidade,
      nome: i.nome,
      precoUnitario: i.precoUnitario,
      precoTotal: i.quantidade * i.precoUnitario,
    }));
    const totalSnapshot = totalGeral;
    const codigoSnapshot = codigoVenda;

    startTransition(async () => {
      const result = await finalizarVendaAction({
        codigoVenda: codigoSnapshot,
        formaPagamento: forma,
        valorPago,
        itens: itens.map((i) => ({
          produtoId: i.produtoId,
          quantidade: i.quantidade,
          precoUnitario: i.precoUnitario,
        })),
      });

      if (!result.ok) {
        setFeedback(result.message);
        setModalPagamento(false);
        focarInput();
        return;
      }

      const pago =
        forma === "DINHEIRO"
          ? (valorPago ?? null)
          : null;

      setModalPagamento(false);
      setItens([]);
      setCodigoVenda(null);
      setInput("");
      setUltimoProduto(null);
      setSucesso({
        codigoVenda: result.codigoVenda ?? codigoSnapshot,
        total: result.total ?? totalSnapshot,
        troco: result.troco ?? 0,
        valorPago: pago,
        formaLabel: FORMA_LABEL[forma],
        operadorNome,
        dataHora: new Date().toLocaleString("pt-BR"),
        itens: itensSnapshot,
      });
    });
  }

  /**
   * Fecha o modal de sucesso e deixa o caixa livre.
   */
  function fecharSucesso() {
    setSucesso(null);
    setFeedback("Caixa Livre — pressione F2 para nova venda.");
    focarInput();
  }

  const horario = agora.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-zinc-900 text-zinc-100">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-700 bg-zinc-950 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs tracking-wide text-emerald-400 uppercase">
            PDV Mercado
          </p>
          <p className="truncate text-sm font-medium">
            Operador: {operadorNome}
          </p>
          {codigoVenda ? (
            <p className="font-mono text-xs text-zinc-400">
              Venda: {codigoVenda}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="font-mono text-lg tabular-nums text-zinc-200">
            {horario}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              caixaOcupado
                ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40"
                : "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
            }`}
          >
            {caixaOcupado ? "Caixa Ocupado" : "Caixa Livre"}
          </span>
          <button
            type="button"
            onClick={iniciarVenda}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
            title="Atalho F2"
          >
            F2 Nova
          </button>
          <button
            type="button"
            onClick={abrirFinalizacao}
            disabled={!caixaOcupado || itens.length === 0}
            className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
            title="Atalho F4"
          >
            F4 Finalizar
          </button>
          <button
            type="button"
            onClick={cancelarVenda}
            disabled={!caixaOcupado && !sucesso}
            className="rounded-lg bg-red-700/80 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
            title="Atalho F8"
          >
            F8 Cancelar
          </button>
          {isAdmin ? (
            <a
              href="/admin/dashboard"
              className="rounded-lg border border-zinc-600 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
            >
              Admin
            </a>
          ) : null}
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg border border-zinc-600 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
        <div className="flex min-h-0 flex-col gap-3 p-4">
          <section className="relative shrink-0 rounded-xl border border-zinc-700 bg-zinc-950 p-4">
            <label
              htmlFor="pdv-input"
              className="text-xs font-medium tracking-wide text-zinc-400 uppercase"
            >
              Bipar código · digitar nome · atalho 3*codigo
            </label>
            <input
              ref={inputRef}
              id="pdv-input"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setFeedback(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" && sugestoes.length > 0) {
                  e.preventDefault();
                  setSugestaoIndex((i) => (i + 1) % sugestoes.length);
                  return;
                }
                if (e.key === "ArrowUp" && sugestoes.length > 0) {
                  e.preventDefault();
                  setSugestaoIndex(
                    (i) => (i - 1 + sugestoes.length) % sugestoes.length,
                  );
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  void confirmarInput();
                }
              }}
              placeholder={
                caixaOcupado
                  ? "Aguardando bipagem..."
                  : "Pressione F2 para iniciar a venda"
              }
              className="mt-2 w-full rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-3 font-mono text-xl text-white outline-none ring-emerald-500 focus:ring-2"
              autoComplete="off"
            />

            {sugestoes.length > 0 ? (
              <ul className="absolute right-4 left-4 z-20 mt-1 max-h-56 overflow-auto rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
                {sugestoes.map((s, idx) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        const { quantidade } = parseQtyPrefix(input);
                        adicionarProduto(s, quantidade);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm ${
                        idx === sugestaoIndex
                          ? "bg-emerald-700 text-white"
                          : "text-zinc-200 hover:bg-zinc-800"
                      }`}
                    >
                      {s.fotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.fotoUrl}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-zinc-800 text-[10px] text-zinc-500">
                          —
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-mono text-xs opacity-80">
                          {s.codigoBarras}
                        </span>{" "}
                        {s.nome}
                      </span>
                      <span className="shrink-0 font-medium">
                        {formatCurrencyBRL(s.precoUnitario)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="mt-2 min-h-5 text-sm text-zinc-400">
              {buscando
                ? "Buscando…"
                : feedback ??
                  (caixaOcupado
                    ? "Bipe o produto ou digite o nome para ver sugestões."
                    : "Caixa livre — F2 inicia nova venda.")}
            </p>

            {ultimoProduto ? (
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900/80 p-3">
                {ultimoProduto.fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ultimoProduto.fotoUrl}
                    alt={ultimoProduto.nome}
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-zinc-800 text-xs text-zinc-500">
                    Sem foto
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {ultimoProduto.nome}
                  </p>
                  <p className="font-mono text-xs text-zinc-400">
                    {ultimoProduto.codigoBarras}
                  </p>
                  <p className="text-sm text-emerald-400">
                    {formatCurrencyBRL(ultimoProduto.precoUnitario)}
                  </p>
                </div>
              </div>
            ) : null}
          </section>

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
                    itens.map((item, index) => (
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
                        <td className="px-3 py-2">{item.nome}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={1}
                            value={item.quantidade}
                            onChange={(e) =>
                              alterarQuantidade(
                                item.lineId,
                                Number(e.target.value),
                              )
                            }
                            onBlur={focarInput}
                            className="w-16 rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-center outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {formatCurrencyBRL(item.precoUnitario)}
                        </td>
                        <td className="px-3 py-2 font-medium tabular-nums">
                          {formatCurrencyBRL(
                            item.quantidade * item.precoUnitario,
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => removerItem(item.lineId)}
                            className="text-xs text-red-400 hover:underline"
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="flex shrink-0 flex-col gap-4 border-t border-zinc-700 bg-zinc-950 p-4 lg:border-t-0 lg:border-l">
          <div className="rounded-2xl bg-emerald-600 p-6 text-white shadow-lg">
            <p className="text-sm font-medium text-emerald-100">
              Valor total da venda
            </p>
            <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums">
              {formatCurrencyBRL(totalGeral)}
            </p>
            <p className="mt-3 text-sm text-emerald-100">
              {itens.length} item(ns) ·{" "}
              {itens.reduce((a, i) => a + i.quantidade, 0)} un.
            </p>
          </div>

          <button
            type="button"
            onClick={abrirFinalizacao}
            disabled={!caixaOcupado || itens.length === 0 || pending}
            className="rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Finalizar venda (F4)
          </button>
          <button
            type="button"
            onClick={cancelarVenda}
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
              <li>
                <kbd className="text-zinc-200">Esc</kbd> — Limpar busca
              </li>
            </ul>
          </div>
        </aside>
      </div>

      {modalPagamento ? (
        <PaymentModal
          total={totalGeral}
          pending={pending}
          onCancel={() => {
            setModalPagamento(false);
            focarInput();
          }}
          onConfirm={confirmarPagamento}
        />
      ) : null}

      {sucesso ? (
        <SaleSuccessModal
          info={sucesso}
          loja={loja}
          onNovaVenda={iniciarVenda}
          onFechar={fecharSucesso}
        />
      ) : null}
    </div>
  );
}
