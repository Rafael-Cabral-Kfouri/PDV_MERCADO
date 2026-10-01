import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
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

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const senhaValida = await bcrypt.compare(password, user.senhaHash);
        if (!senhaValida) return null;

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
