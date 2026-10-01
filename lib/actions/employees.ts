"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { Prisma, Role } from "@prisma/client";
import { requireAdmin } from "@/lib/auth-guards";
import { onlyDigits } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export type EmployeeActionResult = {
  ok: boolean;
  message: string;
};

/**
 * Cria ou atualiza um funcionário com perfil Gerente (ADMIN) ou Caixa (CASHIER).
 *
 * @param _prev - Estado anterior (não usado).
 * @param formData - Campos: id?, nome, email, senha?, funcao, cpf, rg, telefone, endereco.
 * @returns Resultado com sucesso/erro para toast.
 */
export async function salvarFuncionarioAction(
  _prev: EmployeeActionResult | null,
  formData: FormData,
): Promise<EmployeeActionResult> {
  try {
    await requireAdmin();

    const id = String(formData.get("id") ?? "").trim() || null;
    const nome = String(formData.get("nome") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const senha = String(formData.get("senha") ?? "");
    const funcaoRaw = String(formData.get("funcao") ?? "");
    const cpf = onlyDigits(String(formData.get("cpf") ?? ""));
    const rg = String(formData.get("rg") ?? "").trim() || null;
    const telefone = String(formData.get("telefone") ?? "").trim() || null;
    const endereco = String(formData.get("endereco") ?? "").trim() || null;

    if (!nome) return { ok: false, message: "Informe o nome do funcionário." };
    if (!email) return { ok: false, message: "Informe o e-mail." };

    const funcao =
      funcaoRaw === "ADMIN" || funcaoRaw === "CASHIER" ? funcaoRaw : null;
    if (!funcao) {
      return { ok: false, message: "Selecione o perfil: Gerente ou Caixa." };
    }

    if (cpf && cpf.length !== 11) {
      return { ok: false, message: "CPF deve ter 11 dígitos." };
    }

    if (!id && senha.length < 6) {
      return { ok: false, message: "Senha deve ter pelo menos 6 caracteres." };
    }
    if (id && senha && senha.length < 6) {
      return { ok: false, message: "Nova senha deve ter pelo menos 6 caracteres." };
    }

    const baseData = {
      nome,
      email,
      funcao: funcao as Role,
      cpf: cpf || null,
      rg,
      telefone,
      endereco,
    };

    if (id) {
      const data = senha
        ? { ...baseData, senhaHash: await hash(senha, 10) }
        : baseData;
      await prisma.user.update({ where: { id }, data });
      revalidatePath("/admin/funcionarios");
      return { ok: true, message: "Funcionário atualizado com sucesso." };
    }

    await prisma.user.create({
      data: {
        ...baseData,
        senhaHash: await hash(senha, 10),
      },
    });
    revalidatePath("/admin/funcionarios");
    return { ok: true, message: "Funcionário cadastrado com sucesso." };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        message: "E-mail ou CPF já cadastrado para outro funcionário.",
      };
    }
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Erro ao salvar funcionário.",
    };
  }
}

/**
 * Exclui um funcionário pelo id (não permite autoexclusão).
 *
 * @param id - Identificador do usuário/funcionário.
 * @returns Resultado com sucesso/erro.
 */
export async function excluirFuncionarioAction(
  id: string,
): Promise<EmployeeActionResult> {
  try {
    const session = await requireAdmin();
    if (!id) return { ok: false, message: "Funcionário inválido." };
    if (session.user.id === id) {
      return { ok: false, message: "Você não pode excluir o próprio usuário." };
    }

    await prisma.user.delete({ where: { id } });
    revalidatePath("/admin/funcionarios");
    return { ok: true, message: "Funcionário excluído com sucesso." };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return {
        ok: false,
        message: "Não é possível excluir: funcionário vinculado a vendas.",
      };
    }
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Erro ao excluir funcionário.",
    };
  }
}

/**
 * Lista funcionários cadastrados, ordenados por nome.
 *
 * @returns Lista sem o hash de senha.
 */
export async function listarFuncionarios() {
  await requireAdmin();
  return prisma.user.findMany({
    select: {
      id: true,
      nome: true,
      email: true,
      funcao: true,
      cpf: true,
      rg: true,
      telefone: true,
      endereco: true,
      criadoEm: true,
    },
    orderBy: { nome: "asc" },
  });
}
