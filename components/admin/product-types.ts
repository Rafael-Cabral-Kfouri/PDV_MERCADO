import type { UnidadeVenda } from "@prisma/client";

export type ProductRow = {
  id: string;
  nome: string;
  codigoBarras: string;
  precoUnitario: string;
  quantidadeEstoque: number;
  unidadeVenda: UnidadeVenda;
  fotoUrl: string | null;
  dataValidade: string | null;
  promocaoAtiva: boolean;
  quantidadeMinimaPromocao: number | null;
  precoPromocional: string | null;
};

export type ProductFormState = {
  id: string;
  nome: string;
  codigoBarras: string;
  precoUnitario: string;
  quantidadeEstoque: string;
  unidadeVenda: UnidadeVenda;
  dataValidade: string;
  fotoUrl: string | null;
  removerFoto: boolean;
  promocaoAtiva: boolean;
  quantidadeMinimaPromocao: string;
  precoPromocional: string;
};

export const emptyProductForm: ProductFormState = {
  id: "",
  nome: "",
  codigoBarras: "",
  precoUnitario: "",
  quantidadeEstoque: "0",
  unidadeVenda: "UNIDADE",
  dataValidade: "",
  fotoUrl: null,
  removerFoto: false,
  promocaoAtiva: false,
  quantidadeMinimaPromocao: "",
  precoPromocional: "",
};
