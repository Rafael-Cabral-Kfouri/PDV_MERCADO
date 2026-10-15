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
