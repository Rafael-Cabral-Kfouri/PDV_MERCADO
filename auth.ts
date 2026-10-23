import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import {
  limparTentativasLogin,
  registrarFalhaLogin,
  verificarBloqueioLogin,
} from "@/lib/login-rate-limit";
import { prisma } from "@/lib/prisma";

/**
 * Instância principal do Auth.js (NextAuth v5) com provedor de credenciais.
 * Sessão via JWT; `funcao` do usuário é propagada no token e na session.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      /**
       * Valida e-mail/senha contra o banco e retorna o usuário autenticado.
       * Respeita o limite de 5 falhas / 15 min por e-mail (Map em memória).
       *
       * @param credentials - Objeto com `email` e `password` enviados no login.
       * @returns Dados públicos do usuário (id, email, nome, funcao) ou `null` se inválido.
       */
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;

        if (
          typeof email !== "string" ||
          typeof password !== "string" ||
          !email ||
          !password
        ) {
          return null;
        }

        const emailNorm = email.trim().toLowerCase();
        const bloqueio = verificarBloqueioLogin(emailNorm);
        if (bloqueio.bloqueado) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: emailNorm },
        });
        if (!user) {
          registrarFalhaLogin(emailNorm);
          return null;
        }

        const senhaValida = await bcrypt.compare(password, user.senhaHash);
        if (!senhaValida) {
          registrarFalhaLogin(emailNorm);
          return null;
        }

        limparTentativasLogin(emailNorm);

        return {
          id: user.id,
          email: user.email,
          nome: user.nome,
          funcao: user.funcao,
        };
      },
    }),
  ],
});
