import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

/**
 * Configuração base do Auth.js compatível com Edge (middleware).
 * Providers e acesso ao Prisma ficam em `auth.ts`.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    /**
     * Propaga id, nome e função no JWT (necessário para o middleware ler o role).
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.nome = user.nome;
        token.funcao = user.funcao;
      }
      return token;
    },
    /**
     * Expõe id, nome e função na sessão usada pelo middleware e pelas páginas.
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.nome = token.nome as string;
        session.user.funcao = token.funcao as Role;
      }
      return session;
    },
    /**
     * Controla acesso às rotas e redirecionamentos por função (RBAC).
     * ADMIN (gerente) → /admin/* | CASHIER (operador) → /pdv (bloqueado em /admin).
     */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const role = auth?.user?.funcao;
      const { pathname } = nextUrl;

      const isLoginPage = pathname.startsWith("/login");
      const isAdminRoute = pathname.startsWith("/admin");
      const isPdvRoute = pathname.startsWith("/pdv");
      const isHome = pathname === "/";

      if (!isLoggedIn) {
        if (isLoginPage) return true;
        if (isHome) {
          return Response.redirect(new URL("/login", nextUrl));
        }
        return false;
      }

      const homeByRole = role === "ADMIN" ? "/admin/dashboard" : "/pdv";

      if (isLoginPage || isHome) {
        return Response.redirect(new URL(homeByRole, nextUrl));
      }

      // Operador (CASHIER) não acessa rotas administrativas
      if (isAdminRoute && role !== "ADMIN") {
        return Response.redirect(new URL("/pdv", nextUrl));
      }

      if (isPdvRoute || isAdminRoute) {
        return true;
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
