"use server";

import { revalidatePath } from "next/cache";
import { Prisma, UnidadeVenda } from "@prisma/client";
import { requireAdmin } from "@/lib/auth-guards";
import { parseNfeXml } from "@/lib/nfe-xml";
import { prisma } from "@/lib/prisma";

const MAX_XML_BYTES = 5 * 1024 * 1024;

export type NfePreviewItem = {
  /** Índice estável na lista de preview (0-based). */
  index: number;
  nItem: number | null;
  nome: string;
  codigoBarras: string;
  codigoProdutoEmitente: string;
  quantidade: number;
  precoCusto: number;
  /** Preço de venda sugerido (existente ou custo). */
  precoVendaSugerido: number;
  unidadeNota: string;
  unidadeVenda: UnidadeVenda;
  avisos: string[];
  /** Se já existe produto com o mesmo código de barras. */
  produtoExistente: {
    id: string;
    nome: string;
    precoUnitario: number;
    quantidadeEstoque: number;
    unidadeVenda: UnidadeVenda;
  } | null;
};

export type NfePreviewResult = {
  ok: boolean;
  message: string;
  chaveAcesso?: string | null;
  numeroNota?: string | null;
  emitente?: string | null;
  itens?: NfePreviewItem[];
};

export type NfeImportItemInput = {
  selecionado: boolean;
  nome: string;
  codigoBarras: string;
  quantidade: number;
  precoVenda: number;
  unidadeVenda: UnidadeVenda;
  /** Se true e o produto já existir, atualiza o preço de venda. */
  atualizarPreco: boolean;
};

export type NfeImportResult = {
  ok: boolean;
  message: string;
  criados?: number;
  atualizados?: number;
  ignorados?: number;
};

/**
 * Gera um código interno numérico de 6 dígitos ainda não usado.
 *
 * @returns Código de barras interno único.
 * @throws Error se não conseguir gerar em 30 tentativas.
 */
async function gerarCodigoInternoUnico(): Promise<string> {
  for (let tentativa = 0; tentativa < 30; tentativa++) {
    const codigo = String(Math.floor(100000 + Math.random() * 900000));
    const existente = await prisma.product.findUnique({
      where: { codigoBarras: codigo },
    });
    if (!existente) return codigo;
  }
  throw new Error("Não foi possível gerar código interno único.");
}

/**
 * Normaliza a unidade de venda recebida do cliente.
 *
 * @param raw - Valor bruto (`UNIDADE` ou `KG`).
 * @returns Enum Prisma ou `null` se inválido.
 */
function parseUnidade(raw: string): UnidadeVenda | null {
  if (raw === UnidadeVenda.KG) return UnidadeVenda.KG;
  if (raw === UnidadeVenda.UNIDADE) return UnidadeVenda.UNIDADE;
  return null;
}

/**
 * Lê o XML da NF-e enviado no FormData, parseia os itens e cruza com o
 * cadastro atual (por código de barras) para montar um preview editável.
 *
 * @param formData - Deve conter o campo `xml` (arquivo `.xml`).
 * @returns Preview com emitente, número da nota e itens sugeridos.
 */
export async function parseNfeXmlAction(
  formData: FormData,
): Promise<NfePreviewResult> {
  try {
    await requireAdmin();

    const entry = formData.get("xml");
    if (!(entry instanceof File) || entry.size === 0) {
      return { ok: false, message: "Selecione um arquivo XML da NF-e." };
    }
    if (entry.size > MAX_XML_BYTES) {
      return {
        ok: false,
        message: "Arquivo muito grande (máx. 5 MB).",
      };
    }

    const nomeArquivo = entry.name.toLowerCase();
    if (!nomeArquivo.endsWith(".xml") && entry.type && !entry.type.includes("xml")) {
      return {
        ok: false,
        message: "Envie o arquivo XML da nota fiscal (não o PDF).",
      };
    }

    const xml = await entry.text();
    const parsed = parseNfeXml(xml);

    const barcodes = parsed.itens
      .map((i) => i.codigoBarras)
      .filter((c) => c.length > 0);

    const existentes =
      barcodes.length > 0
        ? await prisma.product.findMany({
            where: { codigoBarras: { in: barcodes } },
          })
        : [];
    const byBarcode = new Map(
      existentes.map((p) => [p.codigoBarras, p] as const),
    );

    const itens: NfePreviewItem[] = parsed.itens.map((item, index) => {
      const produto = item.codigoBarras
        ? (byBarcode.get(item.codigoBarras) ?? null)
        : null;

      const unidadeVenda = (produto?.unidadeVenda ??
        item.unidadeVenda) as UnidadeVenda;

      const precoVendaSugerido = produto
        ? Number(produto.precoUnitario)
        : item.precoCusto > 0
          ? item.precoCusto
          : 0;

      return {
        index,
        nItem: item.nItem,
        nome: produto?.nome ?? item.nome,
        codigoBarras: item.codigoBarras,
        codigoProdutoEmitente: item.codigoProdutoEmitente,
        quantidade: item.quantidade,
        precoCusto: item.precoCusto,
        precoVendaSugerido,
        unidadeNota: item.unidadeNota,
        unidadeVenda,
        avisos: item.avisos,
        produtoExistente: produto
          ? {
              id: produto.id,
              nome: produto.nome,
              precoUnitario: Number(produto.precoUnitario),
              quantidadeEstoque: Number(produto.quantidadeEstoque),
              unidadeVenda: produto.unidadeVenda,
            }
          : null,
      };
    });

    const num = parsed.numeroNota ? ` nº ${parsed.numeroNota}` : "";
    return {
      ok: true,
      message: `${itens.length} item(ns) lido(s) da nota${num}. Revise e confirme a importação.`,
      chaveAcesso: parsed.chaveAcesso,
      numeroNota: parsed.numeroNota,
      emitente: parsed.emitente,
      itens,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Erro ao ler o XML da nota.",
    };
  }
}

/**
 * Importa os itens revisados da NF-e: cria produtos novos e/ou soma
 * quantidade ao estoque dos já cadastrados (por código de barras).
 *
 * Itens sem código de barras recebem um código interno de 6 dígitos.
 * Produtos existentes têm o estoque incrementado; o preço só muda se
 * `atualizarPreco` for true.
 *
 * @param itens - Lista revisada pelo usuário na tela de preview.
 * @returns Totais de criados/atualizados/ignorados e mensagem.
 */
export async function importarNfeItensAction(
  itens: NfeImportItemInput[],
): Promise<NfeImportResult> {
  try {
    await requireAdmin();

    if (!Array.isArray(itens) || itens.length === 0) {
      return { ok: false, message: "Nenhum item para importar." };
    }

    let criados = 0;
    let atualizados = 0;
    let ignorados = 0;

    // Valida tudo antes de gravar
    const preparados: Array<{
      nome: string;
      codigoBarras: string;
      quantidade: number;
      precoVenda: number;
      unidadeVenda: UnidadeVenda;
      atualizarPreco: boolean;
    }> = [];

    for (const raw of itens) {
      if (!raw.selecionado) {
        ignorados += 1;
        continue;
      }

      const nome = String(raw.nome ?? "").trim();
      let codigoBarras = String(raw.codigoBarras ?? "")
        .trim()
        .replace(/\s+/g, "");
      const unidadeVenda = parseUnidade(String(raw.unidadeVenda ?? "UNIDADE"));
      const quantidade = Number(raw.quantidade);
      const precoVenda = Number(raw.precoVenda);

      if (!nome) {
        return { ok: false, message: "Há item selecionado sem nome." };
      }
      if (!unidadeVenda) {
        return { ok: false, message: `Unidade inválida no item "${nome}".` };
      }
      if (!Number.isFinite(quantidade) || quantidade <= 0) {
        return {
          ok: false,
          message: `Quantidade inválida no item "${nome}".`,
        };
      }
      if (!Number.isFinite(precoVenda) || precoVenda <= 0) {
        return {
          ok: false,
          message: `Preço de venda inválido no item "${nome}".`,
        };
      }

      let qtd = quantidade;
      if (unidadeVenda === UnidadeVenda.UNIDADE) {
        if (!Number.isInteger(quantidade)) {
          // Aceita decimal da nota, mas estoque por unidade fica inteiro (ceil)
          qtd = Math.round(quantidade);
          if (qtd <= 0) {
            return {
              ok: false,
              message: `Quantidade inválida no item "${nome}".`,
            };
          }
        }
      } else {
        qtd = Number(quantidade.toFixed(3));
      }

      if (!codigoBarras) {
        codigoBarras = await gerarCodigoInternoUnico();
      }

      preparados.push({
        nome,
        codigoBarras,
        quantidade: qtd,
        precoVenda: Number(precoVenda.toFixed(2)),
        unidadeVenda,
        atualizarPreco: Boolean(raw.atualizarPreco),
      });
    }

    if (preparados.length === 0) {
      return {
        ok: false,
        message: "Selecione ao menos um item para importar.",
      };
    }

    // Detecta códigos duplicados na própria importação
    const vistos = new Set<string>();
    for (const p of preparados) {
      if (vistos.has(p.codigoBarras)) {
        return {
          ok: false,
          message: `Código de barras repetido na importação: ${p.codigoBarras}.`,
        };
      }
      vistos.add(p.codigoBarras);
    }

    await prisma.$transaction(async (tx) => {
      for (const item of preparados) {
        const existente = await tx.product.findUnique({
          where: { codigoBarras: item.codigoBarras },
        });

        if (existente) {
          const estoqueAtual = Number(existente.quantidadeEstoque);
          const novoEstoque =
            existente.unidadeVenda === UnidadeVenda.KG ||
            item.unidadeVenda === UnidadeVenda.KG
              ? Number((estoqueAtual + item.quantidade).toFixed(3))
              : Math.round(estoqueAtual + item.quantidade);

          const data: {
            quantidadeEstoque: Prisma.Decimal;
            precoUnitario?: Prisma.Decimal;
            nome?: string;
          } = {
            quantidadeEstoque: new Prisma.Decimal(novoEstoque.toFixed(3)),
          };

          if (item.atualizarPreco) {
            data.precoUnitario = new Prisma.Decimal(item.precoVenda.toFixed(2));
          }

          // Atualiza nome só se o usuário alterou de forma significativa? Mantém nome do cadastro;
          // se quiser sincronizar descrição da nota, só quando atualizarPreco — melhor não sobrescrever.
          await tx.product.update({
            where: { id: existente.id },
            data,
          });
          atualizados += 1;
        } else {
          await tx.product.create({
            data: {
              nome: item.nome,
              codigoBarras: item.codigoBarras,
              precoUnitario: new Prisma.Decimal(item.precoVenda.toFixed(2)),
              quantidadeEstoque: new Prisma.Decimal(item.quantidade.toFixed(3)),
              unidadeVenda: item.unidadeVenda,
            },
          });
          criados += 1;
        }
      }
    });

    revalidatePath("/admin/produtos");
    revalidatePath("/pdv");

    const partes: string[] = [];
    if (criados) partes.push(`${criados} cadastrado(s)`);
    if (atualizados) partes.push(`${atualizados} com estoque atualizado`);
    if (ignorados) partes.push(`${ignorados} ignorado(s)`);

    return {
      ok: true,
      message: `Importação concluída: ${partes.join(", ")}.`,
      criados,
      atualizados,
      ignorados,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        message: "Conflito de código de barras ao importar. Revise os códigos.",
      };
    }
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Erro ao importar itens da nota.",
    };
  }
}
