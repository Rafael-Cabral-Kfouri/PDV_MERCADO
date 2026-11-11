/**
 * Dados de promoção por quantidade usados no cálculo do preço efetivo.
 */
export type PromocaoQuantidade = {
  /** Se a promoção está habilitada no cadastro. */
  promocaoAtiva: boolean;
  /** Quantidade mínima de unidades para aplicar o preço promocional. */
  quantidadeMinimaPromocao: number | null;
  /** Preço unitário promocional (ou null se não configurado). */
  precoPromocional: number | null;
};

/** Unidade de venda usada nos cálculos puros (sem depender do Prisma no cliente/testes). */
export type UnidadeVendaCalc = "UNIDADE" | "KG";

/**
 * Valida quantidade conforme a unidade de venda do produto.
 *
 * @param quantidade - Quantidade enviada pelo PDV.
 * @param unidadeVenda - `UNIDADE` (inteiro > 0) ou `KG` (decimal > 0).
 * @returns `true` se a quantidade for válida.
 */
export function quantidadeValida(
  quantidade: number,
  unidadeVenda: UnidadeVendaCalc,
): boolean {
  if (!Number.isFinite(quantidade) || quantidade <= 0) return false;
  if (unidadeVenda === "UNIDADE") {
    return Number.isInteger(quantidade);
  }
  return quantidade <= 999999;
}

/**
 * Normaliza a quantidade conforme a unidade (0 casas para UNIDADE, 3 para KG).
 *
 * @param quantidade - Quantidade bruta.
 * @param unidadeVenda - Unidade do produto.
 * @returns Quantidade arredondada.
 */
export function normalizarQuantidade(
  quantidade: number,
  unidadeVenda: UnidadeVendaCalc,
): number {
  return Number(quantidade.toFixed(unidadeVenda === "KG" ? 3 : 0));
}

/**
 * Calcula o total de uma linha (quantidade × preço unitário), com 2 casas.
 *
 * @param quantidade - Quantidade (un ou kg).
 * @param precoUnitario - Preço unitário efetivo.
 * @returns Total da linha arredondado em 2 casas.
 */
export function totalItem(quantidade: number, precoUnitario: number): number {
  return Number((quantidade * precoUnitario).toFixed(2));
}

/**
 * Soma os totais das linhas da venda, com 2 casas.
 *
 * @param itens - Linhas com `precoTotal` já calculado.
 * @returns Total da venda arredondado em 2 casas.
 */
export function totalVenda(itens: ReadonlyArray<{ precoTotal: number }>): number {
  return Number(
    itens.reduce((acc, i) => acc + i.precoTotal, 0).toFixed(2),
  );
}

export type CalcularTrocoResult =
  | { ok: true; troco: number }
  | { ok: false; message: string };

/**
 * Calcula o troco para pagamento em dinheiro.
 *
 * @param total - Total da venda.
 * @param valorPago - Valor entregue pelo cliente.
 * @returns Troco com 2 casas, ou erro se o valor for insuficiente.
 */
export function calcularTroco(
  total: number,
  valorPago: number,
): CalcularTrocoResult {
  if (!Number.isFinite(valorPago) || valorPago < total) {
    return {
      ok: false,
      message: "Valor pago insuficiente para o total da venda.",
    };
  }
  return { ok: true, troco: Number((valorPago - total).toFixed(2)) };
}

export type ItemCalculoInput = {
  /** Nome do produto (usado nas mensagens de erro). */
  nome: string;
  /** Quantidade bruta informada. */
  quantidade: number;
  /** Unidade de venda. */
  unidadeVenda: UnidadeVendaCalc;
  /** Preço de tabela. */
  precoNormal: number;
  /** Dados de promoção (para KG, passe `promocaoAtiva: false`). */
  promocao: PromocaoQuantidade;
};

export type ItemCalculoOk = {
  ok: true;
  quantidade: number;
  precoUnitario: number;
  precoTotal: number;
};

export type ItemCalculoErro = {
  ok: false;
  message: string;
};

/**
 * Resolve quantidade, preço efetivo e total de uma linha de venda.
 *
 * @param input - Dados do produto e quantidade pedida.
 * @returns Linha resolvida ou mensagem de quantidade inválida.
 */
export function calcularItemVenda(
  input: ItemCalculoInput,
): ItemCalculoOk | ItemCalculoErro {
  // UNIDADE: valida o valor bruto (não arredonda 1.5 → 2).
  // KG: normaliza para 3 casas e depois valida.
  const qty =
    input.unidadeVenda === "UNIDADE"
      ? input.quantidade
      : normalizarQuantidade(input.quantidade, "KG");

  if (!quantidadeValida(qty, input.unidadeVenda)) {
    return {
      ok: false,
      message:
        input.unidadeVenda === "KG"
          ? `Peso inválido para "${input.nome}".`
          : `Quantidade inválida para "${input.nome}".`,
    };
  }

  const unitario = precoEfetivo(input.precoNormal, input.promocao, qty);
  return {
    ok: true,
    quantidade: qty,
    precoUnitario: unitario,
    precoTotal: totalItem(qty, unitario),
  };
}

/**
 * Calcula o preço unitário efetivo considerando promoção por quantidade.
 * Quando a promoção está ativa e a quantidade no carrinho atinge o mínimo,
 * todas as unidades da linha usam o preço promocional.
 *
 * @param precoNormal - Preço de tabela do produto.
 * @param promocao - Flags e valores de promoção do cadastro.
 * @param quantidade - Quantidade (unidades) no carrinho para aquela linha.
 * @returns Preço unitário a cobrar (normal ou promocional).
 */
export function precoEfetivo(
  precoNormal: number,
  promocao: PromocaoQuantidade,
  quantidade: number,
): number {
  const {
    promocaoAtiva,
    quantidadeMinimaPromocao,
    precoPromocional,
  } = promocao;

  if (
    !promocaoAtiva ||
    precoPromocional == null ||
    quantidadeMinimaPromocao == null ||
    quantidadeMinimaPromocao < 2 ||
    !Number.isFinite(quantidade) ||
    quantidade < quantidadeMinimaPromocao
  ) {
    return precoNormal;
  }

  return precoPromocional;
}

/**
 * Indica se a promoção por quantidade está aplicada para a quantidade informada.
 *
 * @param promocao - Flags e valores de promoção do cadastro.
 * @param quantidade - Quantidade (unidades) no carrinho.
 * @returns `true` se o preço promocional deve ser usado.
 */
export function promocaoAplicada(
  promocao: PromocaoQuantidade,
  quantidade: number,
): boolean {
  return (
    promocao.promocaoAtiva &&
    promocao.precoPromocional != null &&
    promocao.quantidadeMinimaPromocao != null &&
    promocao.quantidadeMinimaPromocao >= 2 &&
    Number.isFinite(quantidade) &&
    quantidade >= promocao.quantidadeMinimaPromocao
  );
}

/**
 * Gera um código de venda único para a sessão de caixa (ainda não persistido).
 * Persistência da Sale ocorre no fechamento (Prompt 5).
 *
 * @returns Código no formato `VD{yyyyMMddHHmmss}{4 dígitos}`.
 */
export function gerarCodigoVenda(): string {
  const agora = new Date();
  const pad = (n: number, size = 2) => String(n).padStart(size, "0");
  const stamp =
    `${agora.getFullYear()}${pad(agora.getMonth() + 1)}${pad(agora.getDate())}` +
    `${pad(agora.getHours())}${pad(agora.getMinutes())}${pad(agora.getSeconds())}`;
  const sufixo = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `VD${stamp}${sufixo}`;
}

/**
 * Interpreta atalho de quantidade no padrão de mercado `NxCODIGO` ou `N*CODIGO`.
 * Exemplos: `3*7891234567890`, `2x789123`.
 *
 * @param raw - Texto digitado/bipado no input principal.
 * @returns Quantidade (>=1) e o código/termo restante.
 */
export function parseQtyPrefix(raw: string): {
  quantidade: number;
  termo: string;
} {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d+)\s*[xX*]\s*(.+)$/);
  if (match) {
    const quantidade = Number.parseInt(match[1], 10);
    return {
      quantidade: Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 1,
      termo: match[2].trim(),
    };
  }
  return { quantidade: 1, termo: trimmed };
}

/**
 * Indica se o termo parece código de barras/código interno (só dígitos).
 *
 * @param termo - Texto após remover prefixo de quantidade.
 * @returns `true` se for numérico (bipagem típica).
 */
export function pareceCodigoBarras(termo: string): boolean {
  return /^\d{4,}$/.test(termo.trim());
}
