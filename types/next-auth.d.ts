import type { DefaultSession } from "next-auth";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface User {
    nome: string;
    funcao: Role;
  }

  interface Session {
    user: {
      id: string;
      nome: string;
      funcao: Role;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    nome: string;
    funcao: Role;
  }
}
