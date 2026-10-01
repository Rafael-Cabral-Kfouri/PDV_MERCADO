/**
 * Converte string de moeda brasileira (ex: "R$ 1.234,56" ou "12,50") em número.
 *
 * @param value - Valor formatado ou digitado pelo usuário.
 * @returns Número em reais (ex: 12.5) ou `NaN` se inválido.
 */
export function parseCurrencyBRL(value: string): number {
  const cleaned = value
    .replace(/R\$\s?/gi, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "")
    .trim();
  return Number.parseFloat(cleaned);
}

/**
 * Formata um número como moeda BRL (ex: 12.5 → "R$ 12,50").
 *
 * @param value - Valor numérico em reais.
 * @returns String formatada no padrão brasileiro.
 */
export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Aplica máscara de moeda enquanto o usuário digita (centavos).
 * Ex.: digitando "1250" → "R$ 12,50".
 *
 * @param rawDigits - String contendo apenas dígitos (ou texto a ser filtrado).
 * @returns Valor mascarado em R$.
 */
export function maskCurrencyInput(rawDigits: string): string {
  const digits = rawDigits.replace(/\D/g, "");
  if (!digits) return "";
  const cents = Number.parseInt(digits, 10);
  return formatCurrencyBRL(cents / 100);
}

/**
 * Formata CPF com máscara 000.000.000-00.
 *
 * @param value - Texto digitado (com ou sem máscara).
 * @returns CPF mascarado (máx. 14 caracteres).
 */
export function maskCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/**
 * Remove caracteres não numéricos (útil para CPF/código).
 *
 * @param value - Texto de entrada.
 * @returns Apenas dígitos.
 */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}
