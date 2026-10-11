/**
 * Calcula quantos meses cheios faltam entre duas datas (apenas calendário).
 *
 * @param de - Data de início (normalmente hoje).
 * @param ate - Data de destino (validade).
 * @returns Número de meses cheios restantes (pode ser negativo se `ate` for anterior).
 */
function mesesCheiosEntre(de: Date, ate: Date): number {
  let meses =
    (ate.getFullYear() - de.getFullYear()) * 12 +
    (ate.getMonth() - de.getMonth());

  if (ate.getDate() < de.getDate()) {
    meses -= 1;
  }

  return meses;
}

/**
 * Gera a frase de alerta de validade do produto.
 *
 * Regras:
 * - Sem data: nenhum aviso.
 * - Mais de 6 meses: nenhum aviso.
 * - De 6 a 2 meses: contagem regressiva ("Faltam X meses…").
 * - De 1 mês até o dia do vencimento (inclusive): "Falta 1 mês para o vencimento."
 * - Após a data de validade: "Produto vencido."
 *
 * @param dataValidade - Data de validade do produto (ou null/undefined).
 * @param agora - Data de referência (padrão: hoje). Útil para testes.
 * @returns Frase de alerta, ou `null` se não houver aviso.
 */
export function mensagemAlertaValidade(
  dataValidade: Date | null | undefined,
  agora: Date = new Date(),
): string | null {
  if (!dataValidade) return null;

  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const validade = new Date(
    dataValidade.getFullYear(),
    dataValidade.getMonth(),
    dataValidade.getDate(),
  );

  if (hoje > validade) {
    return "Produto vencido.";
  }

  const meses = mesesCheiosEntre(hoje, validade);

  // Último mês (ou menos de um mês cheio) até o dia do vencimento inclusive.
  if (meses < 1) {
    return "Falta 1 mês para o vencimento.";
  }

  if (meses > 6) return null;

  if (meses === 1) {
    return "Falta 1 mês para o vencimento.";
  }

  return `Faltam ${meses} meses para o vencimento.`;
}

/**
 * Indica se o alerta de validade é de produto já vencido.
 *
 * @param mensagem - Retorno de `mensagemAlertaValidade`.
 * @returns `true` quando a mensagem for de produto vencido.
 */
export function isAlertaProdutoVencido(mensagem: string | null): boolean {
  return mensagem === "Produto vencido.";
}

/**
 * Formata uma `Date` para o valor de input `type="date"` (`YYYY-MM-DD`).
 *
 * @param data - Data a formatar, ou null/undefined.
 * @returns String no formato ISO de data, ou string vazia.
 */
export function formatDateInputValue(
  data: Date | string | null | undefined,
): string {
  if (!data) return "";
  if (typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return data;
  }
  const d = typeof data === "string" ? new Date(data) : data;
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Converte o valor de um input `type="date"` (`YYYY-MM-DD`) em `Date` local.
 * Usa meio-dia para evitar mudança de dia por fuso horário.
 *
 * @param value - String `YYYY-MM-DD`, ISO ou vazia/null.
 * @returns Instância de `Date`, ou `null` se inválida/ausente.
 */
export function parseDateInputValue(
  value: string | null | undefined,
): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const d = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T12:00:00`)
    : new Date(trimmed);

  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Formata data de validade para exibição em pt-BR (`dd/mm/aaaa`).
 *
 * @param value - String `YYYY-MM-DD`, ISO ou null.
 * @returns Data formatada, ou string vazia.
 */
export function formatValidadePtBR(value: string | null | undefined): string {
  const d = parseDateInputValue(value);
  if (!d) return "";
  return d.toLocaleDateString("pt-BR");
}
