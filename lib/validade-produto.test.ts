import { describe, expect, it } from "vitest";
import { mensagemAlertaValidade } from "@/lib/validade-produto";

describe("mensagemAlertaValidade", () => {
  const hoje = new Date(2026, 9, 23); // 23/10/2026

  it("retorna null sem data de validade", () => {
    expect(mensagemAlertaValidade(null, hoje)).toBeNull();
    expect(mensagemAlertaValidade(undefined, hoje)).toBeNull();
  });

  it("indica produto vencido", () => {
    expect(mensagemAlertaValidade(new Date(2026, 9, 22), hoje)).toBe(
      "Produto vencido.",
    );
  });

  it("alerta quando está perto de vencer (≤ 6 meses)", () => {
    expect(mensagemAlertaValidade(new Date(2026, 11, 23), hoje)).toBe(
      "Faltam 2 meses para o vencimento.",
    );
    expect(mensagemAlertaValidade(new Date(2026, 10, 10), hoje)).toBe(
      "Falta 1 mês para o vencimento.",
    );
  });

  it("não alerta com mais de 6 meses", () => {
    expect(mensagemAlertaValidade(new Date(2027, 9, 23), hoje)).toBeNull();
  });
});
