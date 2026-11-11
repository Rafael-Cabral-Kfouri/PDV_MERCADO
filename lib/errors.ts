/**
 * Erro de negócio com mensagem segura para exibir ao usuário.
 * Erros técnicos (Prisma, rede, bugs) NÃO devem usar esta classe.
 */
export class AppError extends Error {
  /**
   * Cria um erro de regra de negócio.
   *
   * @param message - Mensagem amigável e segura para a interface.
   */
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Extrai mensagem segura de um erro capturado em Server Actions.
 * Só devolve `error.message` quando for `AppError`; caso contrário
 * registra no console e devolve o fallback (evita vazar detalhes internos).
 *
 * @param error - Valor capturado no `catch`.
 * @param fallback - Mensagem genérica para o usuário.
 * @returns Mensagem segura para retornar em `{ ok: false, message }`.
 */
export function mensagemDeErro(error: unknown, fallback: string): string {
  if (error instanceof AppError) {
    return error.message;
  }
  console.error(error);
  return fallback;
}
