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
