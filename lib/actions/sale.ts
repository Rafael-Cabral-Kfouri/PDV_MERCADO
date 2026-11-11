"use server";

import { Prisma, PaymentMethod, SaleStatus, UnidadeVenda } from "@prisma/client";
import { requireAdmin, requireAuth } from "@/lib/auth-guards";
import { registrarAuditoria } from "@/lib/audit";
import { AppError, mensagemDeErro } from "@/lib/errors";
import {
  calcularItemVenda,
  calcularTroco,
  totalVenda,
} from "@/lib/pdv-utils";
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
        throw new AppError(
          "Código de venda já utilizado. Inicie uma nova venda (F2).",
        );
      }

      const itensResolvidos: ItemResolvido[] = [];

      for (const item of input.itens) {
        const produto = await tx.product.findUnique({
          where: { id: item.produtoId },
        });
        if (!produto) {
          throw new AppError("Produto não encontrado no estoque.");
        }

        const calculo = calcularItemVenda({
          nome: produto.nome,
          quantidade: item.quantidade,
          unidadeVenda:
            produto.unidadeVenda === UnidadeVenda.KG ? "KG" : "UNIDADE",
          precoNormal: Number(produto.precoUnitario),
          promocao: {
            promocaoAtiva:
              produto.promocaoAtiva &&
              produto.unidadeVenda === UnidadeVenda.UNIDADE,
            quantidadeMinimaPromocao: produto.quantidadeMinimaPromocao,
            precoPromocional:
              produto.precoPromocional == null
                ? null
                : Number(produto.precoPromocional),
          },
        });
        if (!calculo.ok) {
          throw new AppError(calculo.message);
        }

        const { quantidade: qty, precoUnitario: unitario, precoTotal } = calculo;

        const estoque = Number(produto.quantidadeEstoque);
        if (estoque < qty) {
          throw new AppError(
            `Estoque insuficiente para "${produto.nome}" (disponível: ${estoque}, pedido: ${qty}).`,
          );
        }

        itensResolvidos.push({
          produtoId: item.produtoId,
          quantidade: qty,
          precoUnitario: unitario,
          precoTotal,
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
          throw new AppError(
            `Estoque insuficiente para "${produto.nome}". Tente novamente.`,
          );
        }
      }

      const totalCalculado = totalVenda(itensResolvidos);

      let trocoCalculado = 0;
      if (input.formaPagamento === PaymentMethod.DINHEIRO) {
        const trocoResult = calcularTroco(totalCalculado, input.valorPago ?? 0);
        if (!trocoResult.ok) {
          throw new AppError(trocoResult.message);
        }
        trocoCalculado = trocoResult.troco;
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
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        message:
          "Código de venda já utilizado (concorrência). Inicie uma nova venda (F2).",
      };
    }
    return {
      ok: false,
      message: mensagemDeErro(error, "Erro ao finalizar a venda."),
    };
  }
}

export type CancelarVendaResult = {
  ok: boolean;
  message: string;
};

/**
 * Cancela uma venda concluída (somente ADMIN): devolve estoque, marca
 * `CANCELADA` e registra auditoria numa única transação.
 *
 * @param vendaId - Id da venda a cancelar.
 * @param motivo - Motivo obrigatório (mínimo 5 caracteres).
 * @returns Resultado com sucesso/erro (cancelamento duplicado falha com mensagem clara).
 */
export async function cancelarVendaAction(
  vendaId: string,
  motivo: string,
): Promise<CancelarVendaResult> {
  try {
    const session = await requireAdmin();
    const motivoTrim = motivo.trim();
    if (!vendaId) {
      return { ok: false, message: "Venda inválida." };
    }
    if (motivoTrim.length < 5) {
      return {
        ok: false,
        message: "Informe o motivo do cancelamento (mínimo 5 caracteres).",
      };
    }

    await prisma.$transaction(async (tx) => {
      const venda = await tx.sale.findUnique({
        where: { id: vendaId },
        include: { itens: true },
      });

      if (!venda) {
        throw new AppError("Venda não encontrada.");
      }
      if (venda.status === SaleStatus.CANCELADA) {
        throw new AppError("Esta venda já foi cancelada.");
      }
      if (venda.status !== SaleStatus.CONCLUIDA) {
        throw new AppError("Somente vendas concluídas podem ser canceladas.");
      }

      for (const item of venda.itens) {
        await tx.product.update({
          where: { id: item.produtoId },
          data: {
            quantidadeEstoque: { increment: item.quantidade },
          },
        });
      }

      await tx.sale.update({
        where: { id: vendaId },
        data: {
          status: SaleStatus.CANCELADA,
          canceladoEm: new Date(),
          canceladoPorId: session.user.id,
          motivoCancelamento: motivoTrim,
        },
      });

      await registrarAuditoria(tx, {
        usuarioId: session.user.id,
        acao: "VENDA_CANCELADA",
        entidade: "Sale",
        entidadeId: vendaId,
        detalhes: {
          codigoVenda: venda.codigoVenda,
          total: Number(venda.total),
          motivo: motivoTrim,
          itens: venda.itens.map((i) => ({
            produtoId: i.produtoId,
            quantidade: Number(i.quantidade),
          })),
        },
      });
    });

    return { ok: true, message: "Venda cancelada e estoque devolvido." };
  } catch (error) {
    return {
      ok: false,
      message: mensagemDeErro(error, "Erro ao cancelar a venda."),
    };
  }
}
