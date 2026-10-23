"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { PaymentMethod, UnidadeVenda } from "@prisma/client";
import {
  buscarProdutoPorCodigo,
  buscarProdutosSugestao,
  type PdvProduct,
} from "@/lib/actions/pdv";
import { finalizarVendaAction } from "@/lib/actions/sale";
import { logoutAction } from "@/lib/actions/auth";
import { formatCurrencyBRL, formatQuantidade } from "@/lib/format";
import {
  gerarCodigoVenda,
  parseQtyPrefix,
  pareceCodigoBarras,
  precoEfetivo,
  promocaoAplicada,
} from "@/lib/pdv-utils";
import { PaymentModal } from "@/components/pdv/payment-modal";
import { WeightModal } from "@/components/pdv/weight-modal";
import {
  SaleSuccessModal,
  type SaleSuccessInfo,
} from "@/components/pdv/sale-success-modal";
import { PdvCartTable } from "@/components/pdv/pdv-cart-table";
import { PdvSearchBar } from "@/components/pdv/pdv-search-bar";
import { PdvSidebar } from "@/components/pdv/pdv-sidebar";
import {
  FORMA_LABEL,
  linhaComPreco,
  promoDoProduto,
  type CartItem,
} from "@/components/pdv/pdv-types";
import { usePdvShortcuts } from "@/hooks/use-pdv-shortcuts";
import type { StoreSettingsDTO } from "@/lib/actions/settings";

export type { CartItem };

type PdvScreenProps = {
  operadorNome: string;
  isAdmin: boolean;
  loja: StoreSettingsDTO;
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
  const [pesoPendente, setPesoPendente] = useState<{
    produto: PdvProduct;
    pesoSugerido: number;
  } | null>(null);
  const [sucesso, setSucesso] = useState<SaleSuccessInfo | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const caixaOcupado = codigoVenda !== null;
  const modalAberto =
    modalPagamento || sucesso !== null || pesoPendente !== null;

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
   * Só seleciona o texto quando o campo já tem conteúdo — evita apagar
   * dígitos no meio de uma bipagem rápida do leitor.
   */
  const focarInput = useCallback(() => {
    window.requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      if (el.value.length > 0) {
        el.select();
      }
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
    setPesoPendente(null);
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
    setPesoPendente(null);
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
   * Adiciona produto ao carrinho (mesma SKU soma quantidade/peso).
   * Produtos por kg abrem o modal de peso antes de entrar no carrinho.
   *
   * @param produto - Produto do banco.
   * @param quantidade - Quantidade (un) ou sugestão de peso (kg).
   */
  const adicionarProduto = useCallback(
    (produto: PdvProduct, quantidade: number) => {
      if (!caixaOcupado) {
        setFeedback("Pressione F2 para iniciar uma nova venda.");
        focarInput();
        return;
      }

      if (produto.unidadeVenda === "KG") {
        setSugestoes([]);
        setPesoPendente({
          produto,
          pesoSugerido: quantidade > 0 ? quantidade : 0,
        });
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

      const promo = promoDoProduto(produto);
      const qtyAtual =
        itens.find((i) => i.produtoId === produto.id)?.quantidade ?? 0;
      const novaQtyTotal = qtyAtual + qty;
      if (novaQtyTotal > produto.quantidadeEstoque) {
        setFeedback(
          `Estoque insuficiente: ${produto.nome} (disp. ${produto.quantidadeEstoque}).`,
        );
        focarInput();
        return;
      }

      const unitarioEfetivo = precoEfetivo(
        produto.precoUnitario,
        promo,
        novaQtyTotal,
      );

      setItens((prev) => {
        const idx = prev.findIndex((i) => i.produtoId === produto.id);
        if (idx >= 0) {
          const atual = prev[idx];
          const next = [...prev];
          next[idx] = linhaComPreco(
            {
              lineId: atual.lineId,
              produtoId: atual.produtoId,
              codigoBarras: atual.codigoBarras,
              nome: atual.nome,
              precoNormal: atual.precoNormal,
              unidadeVenda: atual.unidadeVenda,
              promocaoAtiva: atual.promocaoAtiva,
              quantidadeMinimaPromocao: atual.quantidadeMinimaPromocao,
              precoPromocional: atual.precoPromocional,
            },
            atual.quantidade + qty,
          );
          return next;
        }
        return [
          ...prev,
          linhaComPreco(
            {
              lineId: `${produto.id}-${Date.now()}`,
              produtoId: produto.id,
              codigoBarras: produto.codigoBarras,
              nome: produto.nome,
              precoNormal: produto.precoUnitario,
              unidadeVenda: produto.unidadeVenda,
              promocaoAtiva: promo.promocaoAtiva,
              quantidadeMinimaPromocao: promo.quantidadeMinimaPromocao,
              precoPromocional: promo.precoPromocional,
            },
            qty,
          ),
        ];
      });
      setInput("");
      setSugestoes([]);
      setUltimoProduto(produto);
      setFeedback(
        promocaoAplicada(promo, novaQtyTotal)
          ? `${produto.nome} · +${qty} · Promoção aplicada (${formatCurrencyBRL(unitarioEfetivo)}/un)`
          : `${produto.nome} · +${qty}`,
      );
      focarInput();
    },
    [caixaOcupado, focarInput, itens],
  );

  /**
   * Confirma o peso digitado no modal e inclui o item por kg no carrinho.
   *
   * @param pesoKg - Peso em quilogramas (> 0).
   */
  const confirmarPeso = useCallback(
    (pesoKg: number) => {
      const pendente = pesoPendente;
      if (!pendente) return;
      const { produto } = pendente;
      const qty = Number(pesoKg.toFixed(3));

      if (produto.quantidadeEstoque < qty) {
        setFeedback(
          `Estoque insuficiente: ${produto.nome} (disp. ${produto.quantidadeEstoque} kg).`,
        );
        setPesoPendente(null);
        focarInput();
        return;
      }

      setItens((prev) => {
        const idx = prev.findIndex((i) => i.produtoId === produto.id);
        if (idx >= 0) {
          const novaQty = Number((prev[idx].quantidade + qty).toFixed(3));
          if (novaQty > produto.quantidadeEstoque) {
            setFeedback(
              `Estoque insuficiente: ${produto.nome} (disp. ${produto.quantidadeEstoque} kg).`,
            );
            return prev;
          }
          const next = [...prev];
          const atual = prev[idx];
          next[idx] = linhaComPreco(
            {
              lineId: atual.lineId,
              produtoId: atual.produtoId,
              codigoBarras: atual.codigoBarras,
              nome: atual.nome,
              precoNormal: atual.precoNormal,
              unidadeVenda: atual.unidadeVenda,
              promocaoAtiva: false,
              quantidadeMinimaPromocao: null,
              precoPromocional: null,
            },
            novaQty,
          );
          return next;
        }
        return [
          ...prev,
          linhaComPreco(
            {
              lineId: `${produto.id}-${Date.now()}`,
              produtoId: produto.id,
              codigoBarras: produto.codigoBarras,
              nome: produto.nome,
              precoNormal: produto.precoUnitario,
              unidadeVenda: "KG",
              promocaoAtiva: false,
              quantidadeMinimaPromocao: null,
              precoPromocional: null,
            },
            qty,
          ),
        ];
      });
      setPesoPendente(null);
      setInput("");
      setSugestoes([]);
      setUltimoProduto(produto);
      setFeedback(
        `${produto.nome} · +${formatQuantidade(qty, "KG")} · ${formatCurrencyBRL(qty * produto.precoUnitario)}`,
      );
      focarInput();
    },
    [pesoPendente, focarInput],
  );

  /**
   * Resolve Enter no input: código adiciona; nome usa sugestões.
   * Preferir o valor do DOM (passado pelo BarcodeInput) para não perder
   * dígitos quando o leitor envia Enter antes do React atualizar o state.
   *
   * @param valorLido - Texto atual do campo no momento do Enter (opcional).
   */
  const confirmarInput = useCallback(
    async (valorLido?: string) => {
      const raw = (valorLido ?? input).trim();
      if (!raw || modalAberto) return;

      if (!caixaOcupado) {
        setFeedback("Pressione F2 para iniciar uma nova venda.");
        return;
      }

      setInput(raw);
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
    },
    [
      input,
      modalAberto,
      caixaOcupado,
      sugestoes,
      sugestaoIndex,
      adicionarProduto,
      focarInput,
    ],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const valor = input.trim();
    const { termo } = parseQtyPrefix(valor);

    // Limpeza de sugestões curtas fica no onValueChange (evita setState síncrono no effect).
    if (!caixaOcupado || modalAberto || termo.length < 2 || pareceCodigoBarras(termo)) {
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

  const limparBusca = useCallback(() => {
    setSugestoes([]);
    setInput("");
    focarInput();
  }, [focarInput]);

  usePdvShortcuts({
    modalAberto,
    onNovaVenda: iniciarVenda,
    onFinalizar: abrirFinalizacao,
    onCancelar: cancelarVenda,
    onLimparBusca: limparBusca,
  });

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
   * Altera quantidade/peso de uma linha do carrinho.
   *
   * @param lineId - Id da linha.
   * @param quantidade - Nova quantidade (un) ou peso (kg).
   * @param unidadeVenda - Unidade da linha para validar casas decimais.
   */
  function alterarQuantidade(
    lineId: string,
    quantidade: number,
    unidadeVenda: UnidadeVenda,
  ) {
    if (!Number.isFinite(quantidade) || quantidade <= 0) return;
    const qty =
      unidadeVenda === "KG"
        ? Number(quantidade.toFixed(3))
        : Math.floor(quantidade);
    if (unidadeVenda === "UNIDADE" && qty < 1) return;
    setItens((prev) =>
      prev.map((i) => {
        if (i.lineId !== lineId) return i;
        return linhaComPreco(
          {
            lineId: i.lineId,
            produtoId: i.produtoId,
            codigoBarras: i.codigoBarras,
            nome: i.nome,
            precoNormal: i.precoNormal,
            unidadeVenda: i.unidadeVenda,
            promocaoAtiva: i.promocaoAtiva,
            quantidadeMinimaPromocao: i.quantidadeMinimaPromocao,
            precoPromocional: i.precoPromocional,
          },
          qty,
        );
      }),
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
      precoTotal: Number((i.quantidade * i.precoUnitario).toFixed(2)),
      unidadeVenda: i.unidadeVenda,
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
          <PdvSearchBar
            inputRef={inputRef}
            input={input}
            caixaOcupado={caixaOcupado}
            modalAberto={modalAberto}
            buscando={buscando}
            feedback={feedback}
            sugestoes={sugestoes}
            sugestaoIndex={sugestaoIndex}
            ultimoProduto={ultimoProduto}
            onInputChange={(valor) => {
              setInput(valor);
              setFeedback(null);
              const { termo } = parseQtyPrefix(valor.trim());
              if (!pareceCodigoBarras(termo) && termo.length < 2) {
                setSugestoes([]);
              }
            }}
            onConfirm={(valor) => {
              void confirmarInput(valor);
            }}
            onSugestaoIndexChange={setSugestaoIndex}
            onSelecionarSugestao={adicionarProduto}
          />

          <PdvCartTable
            itens={itens}
            onAlterarQuantidade={alterarQuantidade}
            onRemover={removerItem}
            onBlurQuantidade={focarInput}
          />
        </div>

        <PdvSidebar
          totalGeral={totalGeral}
          qtdItens={itens.length}
          caixaOcupado={caixaOcupado}
          pending={pending}
          onFinalizar={abrirFinalizacao}
          onCancelar={cancelarVenda}
        />
      </div>

      {pesoPendente ? (
        <WeightModal
          produto={pesoPendente.produto}
          pesoInicial={pesoPendente.pesoSugerido}
          onCancel={() => {
            setPesoPendente(null);
            focarInput();
          }}
          onConfirm={confirmarPeso}
        />
      ) : null}

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
