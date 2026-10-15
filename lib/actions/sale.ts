"use server";

import { Prisma, PaymentMethod, SaleStatus, UnidadeVenda } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guards";
import { precoEfetivo } from "@/lib/pdv-utils";
import { prisma } from "@/lib/prisma";

export type FinalizarItemInput = {
  produtoId: string;
  quantidade: number;
  /** Preço enviado pelo cliente (informativo); o servidor recalcula com promoção. */
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
 * Valida quantidade conforme a unidade de venda do produto.
 *
 * @param quantidade - Quantidade enviada pelo PDV.
 * @param unidadeVenda - `UNIDADE` (inteiro) ou `KG` (decimal > 0).
 * @returns `true` se a quantidade for válida.
 */
function quantidadeValida(
  quantidade: number,
  unidadeVenda: UnidadeVenda,
): boolean {
  if (!Number.isFinite(quantidade) || quantidade <= 0) return false;
  if (unidadeVenda === UnidadeVenda.UNIDADE) {
    return Number.isInteger(quantidade);
  }
  return quantidade <= 999999;
}

/**
 * Finaliza a venda: valida estoque, recalcula preços (incl. promoção),
 * persiste Sale/SaleItem e dá baixa no estoque em uma única transação.
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
      if (!item.produtoId || !Number.isFinite(item.quantidade)) {
        return { ok: false, message: "Itens da venda inválidos." };
      }
    }

    type ItemResolvido = {
      produtoId: string;
      quantidade: number;
      precoUnitario: number;
      precoTotal: number;
    };

    const { venda, total, troco } = await prisma.$transaction(async (tx) => {
      const existente = await tx.sale.findUnique({
        where: { codigoVenda: input.codigoVenda },
      });
      if (existente) {
        throw new Error(
          "Código de venda já utilizado. Inicie uma nova venda (F2).",
        );
      }

      const itensResolvidos: ItemResolvido[] = [];

      for (const item of input.itens) {
        const produto = await tx.product.findUnique({
          where: { id: item.produtoId },
        });
        if (!produto) {
          throw new Error("Produto não encontrado no estoque.");
        }

        const qty = Number(
          item.quantidade.toFixed(
            produto.unidadeVenda === UnidadeVenda.KG ? 3 : 0,
          ),
        );
        if (!quantidadeValida(qty, produto.unidadeVenda)) {
          throw new Error(
            produto.unidadeVenda === UnidadeVenda.KG
              ? `Peso inválido para "${produto.nome}".`
              : `Quantidade inválida para "${produto.nome}".`,
          );
        }

        const estoque = Number(produto.quantidadeEstoque);
        if (estoque < qty) {
          throw new Error(
            `Estoque insuficiente para "${produto.nome}" (disponível: ${estoque}, pedido: ${qty}).`,
          );
        }

        const precoNormal = Number(produto.precoUnitario);
        const unitario = precoEfetivo(
          precoNormal,
          {
            promocaoAtiva:
              produto.promocaoAtiva &&
              produto.unidadeVenda === UnidadeVenda.UNIDADE,
            quantidadeMinimaPromocao: produto.quantidadeMinimaPromocao,
            precoPromocional:
              produto.precoPromocional == null
                ? null
                : Number(produto.precoPromocional),
          },
          qty,
        );

        itensResolvidos.push({
          produtoId: item.produtoId,
          quantidade: qty,
          precoUnitario: unitario,
          precoTotal: Number((qty * unitario).toFixed(2)),
        });

        const qtyDecimal = new Prisma.Decimal(qty.toFixed(3));
        const updated = await tx.product.updateMany({
          where: {
            id: item.produtoId,
            quantidadeEstoque: { gte: qtyDecimal },
          },
          data: {
            quantidadeEstoque: { decrement: qtyDecimal },
          },
        });
        if (updated.count === 0) {
          throw new Error(
            `Estoque insuficiente para "${produto.nome}". Tente novamente.`,
          );
        }
      }

      const totalCalculado = Number(
        itensResolvidos
          .reduce((acc, i) => acc + i.precoTotal, 0)
          .toFixed(2),
      );

      let trocoCalculado = 0;
      if (input.formaPagamento === PaymentMethod.DINHEIRO) {
        const pago = input.valorPago ?? 0;
        if (pago < totalCalculado) {
          throw new Error("Valor pago insuficiente para o total da venda.");
        }
        trocoCalculado = Number((pago - totalCalculado).toFixed(2));
      }

      const vendaCriada = await tx.sale.create({
        data: {
          codigoVenda: input.codigoVenda,
          total: new Prisma.Decimal(totalCalculado.toFixed(2)),
          formaPagamento: input.formaPagamento,
          status: SaleStatus.CONCLUIDA,
          operadorId: session.user.id,
          itens: {
            create: itensResolvidos.map((item) => ({
              produtoId: item.produtoId,
              quantidade: new Prisma.Decimal(item.quantidade.toFixed(3)),
              precoUnitario: new Prisma.Decimal(item.precoUnitario.toFixed(2)),
              precoTotal: new Prisma.Decimal(item.precoTotal.toFixed(2)),
            })),
          },
        },
      });

      return {
        venda: vendaCriada,
        total: totalCalculado,
        troco: trocoCalculado,
      };
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
