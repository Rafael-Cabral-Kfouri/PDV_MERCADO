import { beforeEach, describe, expect, it, vi } from "vitest";
import { SaleStatus } from "@prisma/client";

const {
  requireAdminMock,
  findUniqueMock,
  productUpdateMock,
  saleUpdateMock,
  auditCreateMock,
  transactionMock,
} = vi.hoisted(() => {
  const findUniqueMock = vi.fn();
  const productUpdateMock = vi.fn();
  const saleUpdateMock = vi.fn();
  const auditCreateMock = vi.fn();
  const transactionMock = vi.fn();
  return {
    requireAdminMock: vi.fn(),
    findUniqueMock,
    productUpdateMock,
    saleUpdateMock,
    auditCreateMock,
    transactionMock,
  };
});

vi.mock("@/lib/auth-guards", () => ({
  requireAdmin: requireAdminMock,
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
  },
}));

import { cancelarVendaAction } from "@/lib/actions/sale";

describe("cancelarVendaAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({
      user: { id: "admin-1", funcao: "ADMIN" },
    });

    transactionMock.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        sale: {
          findUnique: findUniqueMock,
          update: saleUpdateMock,
        },
        product: {
          update: productUpdateMock,
        },
        auditLog: {
          create: auditCreateMock,
        },
      };
      return fn(tx);
    });
  });

  it("devolve estoque, altera status e registra auditoria", async () => {
    findUniqueMock.mockResolvedValue({
      id: "venda-1",
      codigoVenda: "VD123",
      total: 20,
      status: SaleStatus.CONCLUIDA,
      itens: [
        { produtoId: "prod-1", quantidade: 2 },
        { produtoId: "prod-2", quantidade: 1.5 },
      ],
    });
    productUpdateMock.mockResolvedValue({});
    saleUpdateMock.mockResolvedValue({});
    auditCreateMock.mockResolvedValue({});

    const result = await cancelarVendaAction("venda-1", "Cliente desistiu");

    expect(result.ok).toBe(true);
    expect(productUpdateMock).toHaveBeenCalledTimes(2);
    expect(productUpdateMock).toHaveBeenCalledWith({
      where: { id: "prod-1" },
      data: { quantidadeEstoque: { increment: 2 } },
    });
    expect(productUpdateMock).toHaveBeenCalledWith({
      where: { id: "prod-2" },
      data: { quantidadeEstoque: { increment: 1.5 } },
    });
    expect(saleUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "venda-1" },
        data: expect.objectContaining({
          status: SaleStatus.CANCELADA,
          canceladoPorId: "admin-1",
          motivoCancelamento: "Cliente desistiu",
        }),
      }),
    );
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          acao: "VENDA_CANCELADA",
          entidade: "Sale",
          entidadeId: "venda-1",
        }),
      }),
    );
  });

  it("rejeita cancelamento duplicado", async () => {
    findUniqueMock.mockResolvedValue({
      id: "venda-1",
      codigoVenda: "VD123",
      total: 10,
      status: SaleStatus.CANCELADA,
      itens: [],
    });

    const result = await cancelarVendaAction("venda-1", "Motivo qualquer");

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/já foi cancelada/i);
    expect(productUpdateMock).not.toHaveBeenCalled();
    expect(saleUpdateMock).not.toHaveBeenCalled();
  });

  it("exige motivo com pelo menos 5 caracteres", async () => {
    const result = await cancelarVendaAction("venda-1", "abc");
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/motivo/i);
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
