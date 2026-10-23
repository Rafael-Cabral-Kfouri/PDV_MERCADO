import { describe, expect, it } from "vitest";
import {
  calcularItemVenda,
  calcularTroco,
  precoEfetivo,
  quantidadeValida,
  totalItem,
  totalVenda,
} from "@/lib/pdv-utils";

describe("precoEfetivo", () => {
  const promo = {
    promocaoAtiva: true,
    quantidadeMinimaPromocao: 3,
    precoPromocional: 8,
  };

  it("usa preço normal quando promoção está inativa", () => {
    expect(
      precoEfetivo(10, { ...promo, promocaoAtiva: false }, 5),
    ).toBe(10);
  });

  it("usa preço normal abaixo da quantidade mínima", () => {
    expect(precoEfetivo(10, promo, 2)).toBe(10);
  });

  it("usa preço promocional na quantidade mínima", () => {
    expect(precoEfetivo(10, promo, 3)).toBe(8);
  });

  it("usa preço promocional acima da quantidade mínima", () => {
    expect(precoEfetivo(10, promo, 10)).toBe(8);
  });

  it("ignora promoção quando o produto é por kg (promocaoAtiva false)", () => {
    expect(
      precoEfetivo(12.5, { ...promo, promocaoAtiva: false }, 5),
    ).toBe(12.5);
  });
});

describe("cálculo da venda", () => {
  it("arredonda total do item em 2 casas", () => {
    expect(totalItem(3, 1.333)).toBe(4);
    expect(totalItem(1.5, 2.1)).toBe(3.15);
  });

  it("normaliza kg com 3 casas e calcula total", () => {
    const item = calcularItemVenda({
      nome: "Banana",
      quantidade: 1.23456,
      unidadeVenda: "KG",
      precoNormal: 10,
      promocao: {
        promocaoAtiva: false,
        quantidadeMinimaPromocao: null,
        precoPromocional: null,
      },
    });
    expect(item.ok).toBe(true);
    if (item.ok) {
      expect(item.quantidade).toBe(1.235);
      expect(item.precoTotal).toBe(12.35);
    }
  });

  it("rejeita quantidade 0, negativa e fracionada em UNIDADE", () => {
    expect(quantidadeValida(0, "UNIDADE")).toBe(false);
    expect(quantidadeValida(-1, "UNIDADE")).toBe(false);
    expect(quantidadeValida(1.5, "UNIDADE")).toBe(false);
    expect(quantidadeValida(2, "UNIDADE")).toBe(true);

    const fracionada = calcularItemVenda({
      nome: "Água",
      quantidade: 1.5,
      unidadeVenda: "UNIDADE",
      precoNormal: 2,
      promocao: {
        promocaoAtiva: false,
        quantidadeMinimaPromocao: null,
        precoPromocional: null,
      },
    });
    expect(fracionada.ok).toBe(false);
  });

  it("soma o total da venda com 2 casas", () => {
    expect(totalVenda([{ precoTotal: 10.105 }, { precoTotal: 0.1 }])).toBe(
      10.21,
    );
  });

  it("rejeita troco quando o valor pago é insuficiente", () => {
    const result = calcularTroco(50, 49.99);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/insuficiente/i);
    }
  });

  it("calcula troco com 2 casas quando o valor é suficiente", () => {
    const result = calcularTroco(50, 100);
    expect(result).toEqual({ ok: true, troco: 50 });
  });
});
