"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";

export type StoreSettingsDTO = {
  nomeEstabelecimento: string;
  cnpj: string;
  endereco: string;
  mensagemRodape: string;
  imprimirAutomatico: boolean;
};

export type SettingsActionResult = {
  ok: boolean;
  message: string;
};

/**
 * Garante que exista o registro singleton de configurações da loja.
 *
 * @returns Configurações atuais do estabelecimento.
 */
async function ensureStoreSettings() {
  return prisma.storeSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      nomeEstabelecimento: "PDV Mercado",
      cnpj: "00.000.000/0001-00",
      endereco: "Rua Exemplo, 100 — Centro",
      mensagemRodape: "Obrigado pela preferência! Volte sempre.",
      imprimirAutomatico: false,
    },
  });
}

/**
 * Obtém as configurações do estabelecimento (qualquer usuário autenticado — PDV/recibo).
 *
 * @returns DTO com dados para cabeçalho/rodapé do recibo e flag de auto-impressão.
 */
export async function obterConfigLoja(): Promise<StoreSettingsDTO> {
  await requireAuth();
  const s = await ensureStoreSettings();
  return {
    nomeEstabelecimento: s.nomeEstabelecimento,
    cnpj: s.cnpj,
    endereco: s.endereco,
    mensagemRodape: s.mensagemRodape,
    imprimirAutomatico: s.imprimirAutomatico,
  };
}

/**
 * Salva as configurações do estabelecimento (somente ADMIN).
 *
 * @param _prev - Estado anterior (não usado).
 * @param formData - Campos do formulário de config.
 * @returns Resultado com sucesso/erro.
 */
export async function salvarConfigLojaAction(
  _prev: SettingsActionResult | null,
  formData: FormData,
): Promise<SettingsActionResult> {
  try {
    await requireAdmin();

    const nomeEstabelecimento = String(
      formData.get("nomeEstabelecimento") ?? "",
    ).trim();
    const cnpj = String(formData.get("cnpj") ?? "").trim();
    const endereco = String(formData.get("endereco") ?? "").trim();
    const mensagemRodape = String(formData.get("mensagemRodape") ?? "").trim();
    const imprimirAutomatico = formData.get("imprimirAutomatico") === "on";

    if (!nomeEstabelecimento) {
      return { ok: false, message: "Informe o nome do estabelecimento." };
    }

    await prisma.storeSettings.upsert({
      where: { id: "default" },
      update: {
        nomeEstabelecimento,
        cnpj,
        endereco,
        mensagemRodape:
          mensagemRodape || "Obrigado pela preferência! Volte sempre.",
        imprimirAutomatico,
      },
      create: {
        id: "default",
        nomeEstabelecimento,
        cnpj,
        endereco,
        mensagemRodape:
          mensagemRodape || "Obrigado pela preferência! Volte sempre.",
        imprimirAutomatico,
      },
    });

    revalidatePath("/admin/configuracoes");
    revalidatePath("/pdv");
    return { ok: true, message: "Configurações salvas com sucesso." };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Erro ao salvar configurações.",
    };
  }
}
