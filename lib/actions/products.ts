"use server";

import { revalidatePath } from "next/cache";
import { Prisma, UnidadeVenda } from "@prisma/client";
import { requireAdmin } from "@/lib/auth-guards";
import { parseCurrencyBRL, parseDecimalBR } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { removerFotoProduto, salvarFotoProduto } from "@/lib/product-image";

export type ActionResult = {
  ok: boolean;
  message: string;
  codigoBarras?: string;
};

/**
 * Gera um código interno numérico de 6 dígitos ainda não usado em produtos.
 *
 * @returns Resultado com `codigoBarras` gerado ou mensagem de erro.
 */
export async function gerarCodigoInternoAction(): Promise<ActionResult> {
  try {
    await requireAdmin();

    for (let tentativa = 0; tentativa < 20; tentativa++) {
      const codigo = String(Math.floor(100000 + Math.random() * 900000));
      const existente = await prisma.product.findUnique({
        where: { codigoBarras: codigo },
      });
      if (!existente) {
        return {
          ok: true,
          message: "Código interno gerado.",
          codigoBarras: codigo,
        };
      }
    }

    return {
      ok: false,
      message: "Não foi possível gerar um código único. Tente novamente.",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Erro ao gerar código.",
    };
  }
}

/**
 * Normaliza e valida a unidade de venda recebida do formulário.
 *
 * @param raw - Valor bruto do FormData (`UNIDADE` ou `KG`).
 * @returns Enum Prisma válido ou `null` se inválido.
 */
function parseUnidadeVenda(raw: string): UnidadeVenda | null {
  if (raw === UnidadeVenda.KG) return UnidadeVenda.KG;
  if (raw === UnidadeVenda.UNIDADE) return UnidadeVenda.UNIDADE;
  return null;
}

/**
 * Cria ou atualiza um produto. A foto (`foto`) é opcional (JPG/PNG/WebP, máx. 2 MB).
 *
 * @param _prev - Estado anterior (compatível com useActionState, não usado).
 * @param formData - Campos: id?, nome, codigoBarras, precoUnitario, quantidadeEstoque, unidadeVenda, foto?, removerFoto?.
 * @returns Resultado com sucesso/erro para exibir toast.
 */
export async function salvarProdutoAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const id = String(formData.get("id") ?? "").trim() || null;
    const nome = String(formData.get("nome") ?? "").trim();
    const codigoBarras = String(formData.get("codigoBarras") ?? "")
      .trim()
      .replace(/\s+/g, "");
    const precoRaw = String(formData.get("precoUnitario") ?? "");
    const estoqueRaw = String(formData.get("quantidadeEstoque") ?? "");
    const unidadeVenda = parseUnidadeVenda(
      String(formData.get("unidadeVenda") ?? "UNIDADE"),
    );
    const removerFoto = formData.get("removerFoto") === "on";
    const fotoEntry = formData.get("foto");
    const fotoFile =
      fotoEntry instanceof File && fotoEntry.size > 0 ? fotoEntry : null;

    if (!nome) {
      return { ok: false, message: "Informe o nome do produto." };
    }
    if (!codigoBarras) {
      return {
        ok: false,
        message: "Informe o código de barras ou gere um código interno.",
      };
    }
    if (!unidadeVenda) {
      return { ok: false, message: "Unidade de venda inválida." };
    }

    const preco = parseCurrencyBRL(precoRaw);
    if (!Number.isFinite(preco) || preco <= 0) {
      return {
        ok: false,
        message:
          unidadeVenda === UnidadeVenda.KG
            ? "Preço por kg inválido."
            : "Preço unitário inválido.",
      };
    }

    const estoqueParsed = parseDecimalBR(estoqueRaw);
    if (!Number.isFinite(estoqueParsed) || estoqueParsed < 0) {
      return { ok: false, message: "Quantidade em estoque inválida." };
    }

    let quantidadeEstoque = estoqueParsed;
    if (unidadeVenda === UnidadeVenda.UNIDADE) {
      if (!Number.isInteger(estoqueParsed)) {
        return {
          ok: false,
          message: "Estoque por unidade deve ser um número inteiro.",
        };
      }
      quantidadeEstoque = Math.floor(estoqueParsed);
    } else {
      quantidadeEstoque = Number(estoqueParsed.toFixed(3));
    }

    const data: {
      nome: string;
      codigoBarras: string;
      precoUnitario: Prisma.Decimal;
      quantidadeEstoque: Prisma.Decimal;
      unidadeVenda: UnidadeVenda;
      fotoUrl?: string | null;
    } = {
      nome,
      codigoBarras,
      precoUnitario: new Prisma.Decimal(preco.toFixed(2)),
      quantidadeEstoque: new Prisma.Decimal(quantidadeEstoque.toFixed(3)),
      unidadeVenda,
    };

    if (id) {
      const atual = await prisma.product.findUnique({ where: { id } });
      if (!atual) {
        return { ok: false, message: "Produto não encontrado." };
      }

      if (fotoFile) {
        const novaUrl = await salvarFotoProduto(fotoFile);
        await removerFotoProduto(atual.fotoUrl);
        data.fotoUrl = novaUrl;
      } else if (removerFoto) {
        await removerFotoProduto(atual.fotoUrl);
        data.fotoUrl = null;
      }

      await prisma.product.update({ where: { id }, data });
      revalidatePath("/admin/produtos");
      revalidatePath("/pdv");
      return { ok: true, message: "Produto atualizado com sucesso." };
    }

    if (fotoFile) {
      data.fotoUrl = await salvarFotoProduto(fotoFile);
    }

    await prisma.product.create({ data });
    revalidatePath("/admin/produtos");
    revalidatePath("/pdv");
    return { ok: true, message: "Produto cadastrado com sucesso." };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, message: "Já existe um produto com este código de barras." };
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Erro ao salvar produto.",
    };
  }
}

/**
 * Remove um produto pelo id (e a foto associada, se houver).
 *
 * @param id - Identificador do produto.
 * @returns Resultado com sucesso/erro.
 */
export async function excluirProdutoAction(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (!id) return { ok: false, message: "Produto inválido." };

    const produto = await prisma.product.findUnique({ where: { id } });
    if (!produto) return { ok: false, message: "Produto não encontrado." };

    await prisma.product.delete({ where: { id } });
    await removerFotoProduto(produto.fotoUrl);
    revalidatePath("/admin/produtos");
    revalidatePath("/pdv");
    return { ok: true, message: "Produto excluído com sucesso." };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return {
        ok: false,
        message: "Não é possível excluir: produto vinculado a vendas.",
      };
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Erro ao excluir produto.",
    };
  }
}

/**
 * Lista produtos com busca opcional por nome ou código de barras.
 *
 * @param busca - Termo de busca (opcional).
 * @returns Lista de produtos ordenada por nome.
 */
export async function listarProdutos(busca?: string) {
  await requireAdmin();
  const termo = busca?.trim();

  return prisma.product.findMany({
    where: termo
      ? {
          OR: [
            { nome: { contains: termo, mode: "insensitive" } },
            { codigoBarras: { contains: termo, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { nome: "asc" },
  });
}
