"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";

export type LoginState = {
  error?: string;
};

/**
 * Autentica o usuário com e-mail e senha e redireciona conforme a função.
 * ADMIN → `/admin/dashboard` | CASHIER → `/pdv`.
 *
 * @param _prevState - Estado anterior do formulário (useActionState).
 * @param formData - FormData com campos `email` e `password`.
 * @returns Objeto com `error` em caso de falha; em sucesso redireciona (não retorna).
 */
export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { error: "E-mail ou senha inválidos." };
  }

  const senhaValida = await bcrypt.compare(password, user.senhaHash);
  if (!senhaValida) {
    return { error: "E-mail ou senha inválidos." };
  }

  const redirectTo =
    user.funcao === "ADMIN" ? "/admin/dashboard" : "/pdv";

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "E-mail ou senha inválidos." };
    }
    throw error;
  }

  redirect(redirectTo);
}

/**
 * Encerra a sessão do usuário e redireciona para a tela de login.
 *
 * @returns Não retorna — sempre redireciona para `/login`.
 */
export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
