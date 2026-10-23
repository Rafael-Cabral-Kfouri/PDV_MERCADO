/**
 * Limite de tentativas de login em memória (por processo Node).
 *
 * Limitação: o Map é perdido ao reiniciar o processo e não é compartilhado
 * entre múltiplas instâncias. Adequado ao PDV do mercado, que roda um único
 * processo via `iniciar-pdv.bat`.
 */

const MAX_TENTATIVAS = 5;
const JANELA_MS = 15 * 60 * 1000;

type TentativaRegistro = {
  falhas: number;
  inicioJanela: number;
};

const tentativasPorEmail = new Map<string, TentativaRegistro>();

/**
 * Normaliza o e-mail para chave do mapa de tentativas.
 *
 * @param email - E-mail informado no login.
 * @returns E-mail em minúsculas e sem espaços.
 */
function chaveEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Verifica se o e-mail está temporariamente bloqueado por excesso de falhas.
 *
 * @param email - E-mail tentando autenticar.
 * @returns Objeto com `bloqueado` e, se aplicável, mensagem clara para o usuário.
 */
export function verificarBloqueioLogin(email: string): {
  bloqueado: boolean;
  message?: string;
} {
  const key = chaveEmail(email);
  const reg = tentativasPorEmail.get(key);
  if (!reg) return { bloqueado: false };

  const agora = Date.now();
  if (agora - reg.inicioJanela > JANELA_MS) {
    tentativasPorEmail.delete(key);
    return { bloqueado: false };
  }

  if (reg.falhas >= MAX_TENTATIVAS) {
    const minutosRestantes = Math.max(
      1,
      Math.ceil((JANELA_MS - (agora - reg.inicioJanela)) / 60000),
    );
    return {
      bloqueado: true,
      message: `Muitas tentativas de login. Aguarde cerca de ${minutosRestantes} minuto(s) e tente novamente.`,
    };
  }

  return { bloqueado: false };
}

/**
 * Registra uma falha de autenticação para o e-mail.
 *
 * @param email - E-mail que falhou no login.
 * @returns Estado de bloqueio após registrar a falha.
 */
export function registrarFalhaLogin(email: string): {
  bloqueado: boolean;
  message?: string;
} {
  const key = chaveEmail(email);
  const agora = Date.now();
  const reg = tentativasPorEmail.get(key);

  if (!reg || agora - reg.inicioJanela > JANELA_MS) {
    tentativasPorEmail.set(key, { falhas: 1, inicioJanela: agora });
    return { bloqueado: false };
  }

  reg.falhas += 1;
  tentativasPorEmail.set(key, reg);
  return verificarBloqueioLogin(email);
}

/**
 * Limpa o contador de falhas após login bem-sucedido.
 *
 * @param email - E-mail autenticado com sucesso.
 */
export function limparTentativasLogin(email: string): void {
  tentativasPorEmail.delete(chaveEmail(email));
}
