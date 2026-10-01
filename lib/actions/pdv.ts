"use server";

import { requireAuth } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";

export type PdvProduct = {
  id: string;
  nome: string;
  codigoBarras: string;
  precoUnitario: number;
  quantidadeEstoque: number;
  fotoUrl: string | null;
};

/**
 * Busca um produto pelo código de barras exato (bipagem / Enter no código).
 *
 * @param codigoBarras - Código bipado ou digitado (sem espaços).
 * @returns Produto encontrado ou `null` se não existir.
 */
export async function buscarProdutoPorCodigo(
  codigoBarras: string,
): Promise<PdvProduct | null> {
  await requireAuth();
  const codigo = codigoBarras.trim();
  if (!codigo) return null;

  const produto = await prisma.product.findUnique({
    where: { codigoBarras: codigo },
  });

  if (!produto) return null;

  return {
    id: produto.id,
    nome: produto.nome,
    codigoBarras: produto.codigoBarras,
    precoUnitario: Number(produto.precoUnitario),
    quantidadeEstoque: produto.quantidadeEstoque,
    fotoUrl: produto.fotoUrl,
  };
}

/**
 * Busca sugestões de produtos pelo nome (ou trecho de código).
 * Usado quando o operador digita texto — não adiciona automaticamente.
 *
 * @param termo - Nome parcial ou código parcial (mín. 2 caracteres).
 * @param limite - Quantidade máxima de resultados (padrão 8).
 * @returns Lista de produtos candidatos para o operador escolher.
 */
export async function buscarProdutosSugestao(
  termo: string,
  limite = 8,
): Promise<PdvProduct[]> {
  await requireAuth();
  const q = termo.trim();
  if (q.length < 2) return [];

  const produtos = await prisma.product.findMany({
    where: {
      OR: [
        { nome: { contains: q, mode: "insensitive" } },
        { codigoBarras: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { nome: "asc" },
    take: limite,
  });

  return produtos.map((p) => ({
    id: p.id,
    nome: p.nome,
    codigoBarras: p.codigoBarras,
    precoUnitario: Number(p.precoUnitario),
    quantidadeEstoque: p.quantidadeEstoque,
    fotoUrl: p.fotoUrl,
  }));
}
