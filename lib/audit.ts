import type { Prisma } from "@prisma/client";

export type AuditoriaAcao =
  | "PRODUTO_PRECO_ALTERADO"
  | "ESTOQUE_AJUSTADO"
  | "PRODUTO_EXCLUIDO"
  | "FUNCIONARIO_CRIADO"
  | "FUNCIONARIO_ALTERADO"
  | "FUNCIONARIO_EXCLUIDO"
  | "VENDA_CANCELADA"
  | "NFE_IMPORTADA";

export type RegistrarAuditoriaInput = {
  /** Id do usuário autenticado que executou a ação. */
  usuarioId: string;
  /** Código da ação (ex.: `VENDA_CANCELADA`). */
  acao: AuditoriaAcao | string;
  /** Nome da entidade afetada (ex.: `Sale`, `Product`, `User`). */
  entidade: string;
  /** Id da entidade, quando aplicável. */
  entidadeId?: string | null;
  /** Detalhes serializáveis (sem senhas/hashes). */
  detalhes?: Prisma.InputJsonValue;
};

/**
 * Cliente de transação Prisma (ou o client raiz) capaz de criar `AuditLog`.
 */
type TxComAudit = {
  auditLog: {
    create: (args: {
      data: {
        usuarioId: string;
        acao: string;
        entidade: string;
        entidadeId?: string | null;
        detalhes?: Prisma.InputJsonValue;
      };
    }) => Promise<unknown>;
  };
};

/**
 * Persiste um registro de auditoria dentro de uma transação (ou fora dela).
 *
 * @param tx - Cliente Prisma ou `tx` de `$transaction`.
 * @param input - Dados da ação auditada (sem senha/hash).
 * @returns Promise do create do `AuditLog`.
 */
export async function registrarAuditoria(
  tx: TxComAudit,
  input: RegistrarAuditoriaInput,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      usuarioId: input.usuarioId,
      acao: input.acao,
      entidade: input.entidade,
      entidadeId: input.entidadeId ?? null,
      detalhes: input.detalhes,
    },
  });
}
