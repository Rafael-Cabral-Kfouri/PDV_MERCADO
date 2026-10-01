"use server";

import { Prisma, PaymentMethod, SaleStatus } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";

export type FinalizarItemInput = {
  produtoId: string;
  quantidade: number;
  precoUnitario: number;
};

export type FinalizarVendaInput = {
  codigoVenda: string;
  formaPagamento: PaymentMethod;
  itens: FinalizarItemInput[];
  /** Valor pago em dinheiro (opcional; usado só para validar troco no cliente). */
  valorPago?: number;
};

export type FinalizarVendaResult = {
  ok: boolean;
  message: string;
  vendaId?: string;
  codigoVenda?: string;
  total?: number;
  troco?: number;
};

/**
 * Finaliza a venda: valida estoque, persiste Sale/SaleItem, dá baixa no estoque.
 * Tudo em uma única transação para evitar inconsistência.
 *
 * @param input - Código da venda, forma de pagamento e itens do carrinho.
 * @returns Resultado com ids/total ou mensagem de erro (ex.: estoque insuficiente).
 */
export async function finalizarVendaAction(
  input: FinalizarVendaInput,
): Promise<FinalizarVendaResult> {
  try {
    const session = await requireAuth();

    if (!input.codigoVenda?.trim()) {
      return { ok: false, message: "Código de venda inválido." };
    }
    if (!input.itens?.length) {
      return { ok: false, message: "Não é possível finalizar uma venda sem itens." };
    }

    const formasValidas: PaymentMethod[] = [
      PaymentMethod.DINHEIRO,
      PaymentMethod.CARTAO_CREDITO,
      PaymentMethod.CARTAO_DEBITO,
      PaymentMethod.PIX,
    ];
    if (!formasValidas.includes(input.formaPagamento)) {
      return { ok: false, message: "Forma de pagamento inválida." };
    }

    for (const item of input.itens) {
      if (!item.produtoId || item.quantidade < 1 || item.precoUnitario < 0) {
        return { ok: false, message: "Itens da venda inválidos." };
      }
    }

    const total = input.itens.reduce(
      (acc, i) => acc + i.quantidade * i.precoUnitario,
      0,
    );

    let troco = 0;
    if (input.formaPagamento === PaymentMethod.DINHEIRO) {
      const pago = input.valorPago ?? 0;
      if (pago < total) {
        return {
          ok: false,
          message: "Valor pago insuficiente para o total da venda.",
        };
      }
      troco = Number((pago - total).toFixed(2));
    }

    const venda = await prisma.$transaction(async (tx) => {
      const existente = await tx.sale.findUnique({
        where: { codigoVenda: input.codigoVenda },
      });
      if (existente) {
        throw new Error("Código de venda já utilizado. Inicie uma nova venda (F2).");
      }

      // Reserva/baixa de estoque com condição atômica
      for (const item of input.itens) {
        const produto = await tx.product.findUnique({
          where: { id: item.produtoId },
        });
        if (!produto) {
          throw new Error("Produto não encontrado no estoque.");
        }
        if (produto.quantidadeEstoque < item.quantidade) {
          throw new Error(
            `Estoque insuficiente para "${produto.nome}" (disponível: ${produto.quantidadeEstoque}, pedido: ${item.quantidade}).`,
          );
        }

        const updated = await tx.product.updateMany({
          where: {
            id: item.produtoId,
            quantidadeEstoque: { gte: item.quantidade },
          },
          data: {
            quantidadeEstoque: { decrement: item.quantidade },
          },
        });
        if (updated.count === 0) {
          throw new Error(
            `Estoque insuficiente para "${produto.nome}". Tente novamente.`,
          );
        }
      }

      return tx.sale.create({
        data: {
          codigoVenda: input.codigoVenda,
          total: new Prisma.Decimal(total.toFixed(2)),
          formaPagamento: input.formaPagamento,
          status: SaleStatus.CONCLUIDA,
          operadorId: session.user.id,
          itens: {
            create: input.itens.map((item) => ({
              produtoId: item.produtoId,
              quantidade: item.quantidade,
              precoUnitario: new Prisma.Decimal(item.precoUnitario.toFixed(2)),
              precoTotal: new Prisma.Decimal(
                (item.quantidade * item.precoUnitario).toFixed(2),
              ),
            })),
          },
        },
      });
    });

    return {
      ok: true,
      message: "Venda finalizada com sucesso.",
      vendaId: venda.id,
      codigoVenda: venda.codigoVenda,
      total,
      troco,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Erro ao finalizar a venda.",
    };
  }
}
