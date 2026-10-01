import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/**
 * Middleware de autenticação e RBAC.
 * Impede acesso de operadores (CASHIER) às rotas `/admin/*`
 * e redireciona usuários não autenticados para `/login`.
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/",
    "/login",
    "/admin/:path*",
    "/pdv/:path*",
  ],
};
