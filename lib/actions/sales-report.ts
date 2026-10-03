"use server";

import { PaymentMethod, SaleStatus, UnidadeVenda } from "@prisma/client";
import { requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";

export type PeriodoPreset =
  | "hoje"
  | "ontem"
  | "este_mes"
  | "mes_passado"
  | "mes"
  | "intervalo";

export type RelatorioFiltros = {
  /** Atalho de período (hoje, este mês, mês específico, etc.). */
  preset: PeriodoPreset;
  /** Ano (ex.: 2026) — usado com `preset: "mes"`. */
  ano?: number;
  /** Mês 1–12 — usado com `preset: "mes"`. */
  mes?: number;
  /** Data inicial YYYY-MM-DD — usado com `preset: "intervalo"`. */
  dataInicio?: string;
  /** Data final YYYY-MM-DD — usado com `preset: "intervalo"`. */
  dataFim?: string;
  /** Filtra por forma de pagamento (opcional). */
  formaPagamento?: PaymentMethod | "";
  /** Filtra por operador (opcional). */
  operadorId?: string;
};

export type PagamentoBreakdown = {
  forma: PaymentMethod;
  quantidade: number;
  total: number;
};

export type VendaRelatorioRow = {
  id: string;
  codigoVenda: string;
  dataVenda: string;
  total: number;
  formaPagamento: PaymentMethod | null;
  status: SaleStatus;
  operadorNome: string;
  itens: {
    produtoNome: string;
    codigoBarras: string;
    quantidade: number;
    precoUnitario: number;
    precoTotal: number;
    unidadeVenda: UnidadeVenda;
  }[];
};

export type RankingProdutoRow = {
  produtoId: string;
  nome: string;
  codigoBarras: string;
  quantidade: number;
  faturamento: number;
  unidadeVenda: UnidadeVenda;
};

export type RelatorioVendas = {
  periodoLabel: string;
  inicio: string;
  fim: string;
  resumo: {
    quantidadeVendas: number;
    faturamento: number;
    ticketMedio: number;
  };
  porPagamento: PagamentoBreakdown[];
  vendas: VendaRelatorioRow[];
  ranking: RankingProdutoRow[];
};

export type OperadorOption = {
  id: string;
  nome: string;
};

type DateParts = { y: number; m: number; d: number };

/**
 * Obtém ano/mês/dia atuais no fuso America/Sao_Paulo.
 *
 * @returns Partes da data de hoje em Brasília.
 */
function hojeBrasil(): DateParts {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

/**
 * Converte YYYY-MM-DD em partes numéricas.
 *
 * @param value - Data no formato YYYY-MM-DD.
 * @returns Partes da data ou `null` se inválida.
 */
function parseYmd(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

/**
 * Meia-noite em Brasília (UTC-3) para a data informada, em UTC.
 * São Paulo não usa horário de verão desde 2019.
 *
 * @param parts - Ano, mês e dia.
 * @returns Instant UTC correspondente à meia-noite BRT.
 */
function startOfDayBrasilUtc(parts: DateParts): Date {
  return new Date(Date.UTC(parts.y, parts.m - 1, parts.d, 3, 0, 0, 0));
}

/**
 * Soma dias a uma data (partes Y/M/D), retornando nova data civil.
 *
 * @param parts - Data base.
 * @param days - Dias a somar (pode ser negativo).
 * @returns Nova data civil.
 */
function addDays(parts: DateParts, days: number): DateParts {
  const dt = new Date(Date.UTC(parts.y, parts.m - 1, parts.d + days));
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
  };
}

/**
 * Monta rótulo amigável do mês em português.
 *
 * @param ano - Ano.
 * @param mes - Mês 1–12.
 * @returns Ex.: "outubro de 2026".
 */
function labelMes(ano: number, mes: number): string {
  const nome = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(ano, mes - 1, 1)));
  return nome;
}

/**
 * Formata data civil como DD/MM/YYYY.
 *
 * @param parts - Ano, mês e dia.
 * @returns Data formatada.
 */
function formatPartsBr(parts: DateParts): string {
  return `${String(parts.d).padStart(2, "0")}/${String(parts.m).padStart(2, "0")}/${parts.y}`;
}

/**
 * Resolve o intervalo [inicio, fim) e o rótulo a partir dos filtros de período.
 *
 * @param filtros - Preset e campos opcionais (mês/ano ou intervalo).
 * @returns Início inclusivo, fim exclusivo e texto do período.
 * @throws Error se o período for inválido.
 */
function resolverPeriodo(filtros: RelatorioFiltros): {
  inicio: Date;
  fim: Date;
  label: string;
} {
  const hoje = hojeBrasil();

  if (filtros.preset === "hoje") {
    const inicio = startOfDayBrasilUtc(hoje);
    const fim = startOfDayBrasilUtc(addDays(hoje, 1));
    return { inicio, fim, label: `Hoje (${formatPartsBr(hoje)})` };
  }

  if (filtros.preset === "ontem") {
    const ontem = addDays(hoje, -1);
    const inicio = startOfDayBrasilUtc(ontem);
    const fim = startOfDayBrasilUtc(hoje);
    return { inicio, fim, label: `Ontem (${formatPartsBr(ontem)})` };
  }

  if (filtros.preset === "este_mes") {
    const inicioParts = { y: hoje.y, m: hoje.m, d: 1 };
    const next =
      hoje.m === 12
        ? { y: hoje.y + 1, m: 1, d: 1 }
        : { y: hoje.y, m: hoje.m + 1, d: 1 };
    return {
      inicio: startOfDayBrasilUtc(inicioParts),
      fim: startOfDayBrasilUtc(next),
      label: labelMes(hoje.y, hoje.m),
    };
  }

  if (filtros.preset === "mes_passado") {
    const m = hoje.m === 1 ? 12 : hoje.m - 1;
    const y = hoje.m === 1 ? hoje.y - 1 : hoje.y;
    const inicioParts = { y, m, d: 1 };
    const next =
      m === 12 ? { y: y + 1, m: 1, d: 1 } : { y, m: m + 1, d: 1 };
    return {
      inicio: startOfDayBrasilUtc(inicioParts),
      fim: startOfDayBrasilUtc(next),
      label: labelMes(y, m),
    };
  }

  if (filtros.preset === "mes") {
    const ano = filtros.ano ?? hoje.y;
    const mes = filtros.mes ?? hoje.m;
    if (mes < 1 || mes > 12 || ano < 2000 || ano > 2100) {
      throw new Error("Mês/ano inválidos.");
    }
    const inicioParts = { y: ano, m: mes, d: 1 };
    const next =
      mes === 12 ? { y: ano + 1, m: 1, d: 1 } : { y: ano, m: mes + 1, d: 1 };
    return {
      inicio: startOfDayBrasilUtc(inicioParts),
      fim: startOfDayBrasilUtc(next),
      label: labelMes(ano, mes),
    };
  }

  // intervalo
  const ini = parseYmd(filtros.dataInicio ?? "");
  const fimParts = parseYmd(filtros.dataFim ?? "");
  if (!ini || !fimParts) {
    throw new Error("Informe data inicial e final no formato válido.");
  }
  const inicio = startOfDayBrasilUtc(ini);
  const fim = startOfDayBrasilUtc(addDays(fimParts, 1));
  if (inicio >= fim) {
    throw new Error("A data inicial deve ser anterior ou igual à data final.");
  }
  return {
    inicio,
    fim,
    label: `${formatPartsBr(ini)} a ${formatPartsBr(fimParts)}`,
  };
}

/**
 * Lista operadores (ADMIN e CASHIER) para o filtro do relatório.
 *
 * @returns Opções `{ id, nome }` ordenadas por nome.
 */
export async function listarOperadoresRelatorio(): Promise<OperadorOption[]> {
  await requireAdmin();
  const users = await prisma.user.findMany({
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  return users;
}

/**
 * Gera o relatório de vendas do período: resumo, breakdown por pagamento,
 * lista de vendas (com itens) e ranking de produtos mais vendidos.
 *
 * @param filtros - Período (preset/mês/intervalo) e filtros opcionais de pagamento/operador.
 * @returns Dados serializáveis para a UI administrativa.
 * @throws Error se o usuário não for admin ou se o período for inválido.
 */
export async function obterRelatorioVendas(
  filtros: RelatorioFiltros,
): Promise<RelatorioVendas> {
  await requireAdmin();

  const { inicio, fim, label } = resolverPeriodo(filtros);

  const where = {
    status: SaleStatus.CONCLUIDA,
    dataVenda: { gte: inicio, lt: fim },
    ...(filtros.formaPagamento
      ? { formaPagamento: filtros.formaPagamento }
      : {}),
    ...(filtros.operadorId ? { operadorId: filtros.operadorId } : {}),
  };

  const [agg, porPagamentoRaw, vendasRaw, itensRaw] = await Promise.all([
    prisma.sale.aggregate({
      where,
      _sum: { total: true },
      _count: true,
      _avg: { total: true },
    }),
    prisma.sale.groupBy({
      by: ["formaPagamento"],
      where,
      _sum: { total: true },
      _count: true,
    }),
    prisma.sale.findMany({
      where,
      include: {
        operador: { select: { nome: true } },
        itens: {
          include: {
            produto: {
              select: { nome: true, codigoBarras: true, unidadeVenda: true },
            },
          },
        },
      },
      orderBy: { dataVenda: "desc" },
    }),
    prisma.saleItem.findMany({
      where: { venda: where },
      select: {
        produtoId: true,
        quantidade: true,
        precoTotal: true,
        produto: {
          select: { nome: true, codigoBarras: true, unidadeVenda: true },
        },
      },
    }),
  ]);

  const quantidadeVendas = agg._count;
  const faturamento = Number(agg._sum.total ?? 0);
  const ticketMedio =
    quantidadeVendas > 0 ? Number(agg._avg.total ?? 0) : 0;

  const porPagamento: PagamentoBreakdown[] = porPagamentoRaw
    .filter((row) => row.formaPagamento != null)
    .map((row) => ({
      forma: row.formaPagamento as PaymentMethod,
      quantidade: row._count,
      total: Number(row._sum.total ?? 0),
    }))
    .sort((a, b) => b.total - a.total);

  const vendas: VendaRelatorioRow[] = vendasRaw.map((v) => ({
    id: v.id,
    codigoVenda: v.codigoVenda,
    dataVenda: v.dataVenda.toISOString(),
    total: Number(v.total),
    formaPagamento: v.formaPagamento,
    status: v.status,
    operadorNome: v.operador.nome,
    itens: v.itens.map((i) => ({
      produtoNome: i.produto.nome,
      codigoBarras: i.produto.codigoBarras,
      quantidade: Number(i.quantidade),
      precoUnitario: Number(i.precoUnitario),
      precoTotal: Number(i.precoTotal),
      unidadeVenda: i.produto.unidadeVenda,
    })),
  }));

  const rankingMap = new Map<
    string,
    RankingProdutoRow
  >();
  for (const item of itensRaw) {
    const qty = Number(item.quantidade);
    const atual = rankingMap.get(item.produtoId);
    if (atual) {
      atual.quantidade += qty;
      atual.faturamento += Number(item.precoTotal);
    } else {
      rankingMap.set(item.produtoId, {
        produtoId: item.produtoId,
        nome: item.produto.nome,
        codigoBarras: item.produto.codigoBarras,
        quantidade: qty,
        faturamento: Number(item.precoTotal),
        unidadeVenda: item.produto.unidadeVenda,
      });
    }
  }

  const ranking = Array.from(rankingMap.values()).sort((a, b) => {
    if (b.quantidade !== a.quantidade) return b.quantidade - a.quantidade;
    return b.faturamento - a.faturamento;
  });

  return {
    periodoLabel: label,
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    resumo: {
      quantidadeVendas,
      faturamento,
      ticketMedio,
    },
    porPagamento,
    vendas,
    ranking,
  };
}
