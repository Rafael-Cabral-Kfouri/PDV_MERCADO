import type { PaymentMethod, UnidadeVenda } from "@prisma/client";
import type { PdvProduct } from "@/lib/actions/pdv";
import { precoEfetivo } from "@/lib/pdv-utils";

export type CartItem = {
  lineId: string;
  produtoId: string;
  codigoBarras: string;
  nome: string;
  quantidade: number;
  /** Preço de tabela (sem promoção). */
  precoNormal: number;
  /** Preço unitário efetivo (normal ou promocional). */
  precoUnitario: number;
  unidadeVenda: UnidadeVenda;
  promocaoAtiva: boolean;
  quantidadeMinimaPromocao: number | null;
  precoPromocional: number | null;
};

export const FORMA_LABEL: Record<PaymentMethod, string> = {
  DINHEIRO: "Dinheiro",
  CARTAO_CREDITO: "Cartão de crédito",
  CARTAO_DEBITO: "Cartão de débito",
  PIX: "PIX",
};

/**
 * Extrai os dados de promoção de um produto do PDV.
 *
 * @param produto - Produto buscado no caixa.
 * @returns Flags e valores usados por `precoEfetivo` / `promocaoAplicada`.
 */
export function promoDoProduto(produto: PdvProduct) {
  return {
    promocaoAtiva:
      produto.promocaoAtiva && produto.unidadeVenda === "UNIDADE",
    quantidadeMinimaPromocao: produto.quantidadeMinimaPromocao,
    precoPromocional: produto.precoPromocional,
  };
}

/**
 * Monta (ou atualiza) uma linha do carrinho recalculando o preço efetivo.
 *
 * @param base - Campos fixos da linha (sem quantidade/preço efetivo).
 * @param quantidade - Quantidade atual da linha.
 * @returns Linha completa com `precoUnitario` já considerando promoção.
 */
export function linhaComPreco(
  base: Omit<CartItem, "quantidade" | "precoUnitario">,
  quantidade: number,
): CartItem {
  const unitario = precoEfetivo(
    base.precoNormal,
    {
      promocaoAtiva: base.promocaoAtiva,
      quantidadeMinimaPromocao: base.quantidadeMinimaPromocao,
      precoPromocional: base.precoPromocional,
    },
    quantidade,
  );
  return { ...base, quantidade, precoUnitario: unitario };
}
