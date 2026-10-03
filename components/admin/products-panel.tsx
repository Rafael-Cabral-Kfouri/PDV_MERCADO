"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  excluirProdutoAction,
  gerarCodigoInternoAction,
  salvarProdutoAction,
  type ActionResult,
} from "@/lib/actions/products";
import { formatCurrencyBRL, formatQuantidade, maskCurrencyInput } from "@/lib/format";
import { BarcodeInput } from "@/components/ui/barcode-input";
import { useToast } from "@/components/ui/toast";
import type { UnidadeVenda } from "@prisma/client";

export type ProductRow = {
  id: string;
  nome: string;
  codigoBarras: string;
  precoUnitario: string;
  quantidadeEstoque: number;
  unidadeVenda: UnidadeVenda;
  fotoUrl: string | null;
};

type FormState = {
  id: string;
  nome: string;
  codigoBarras: string;
  precoUnitario: string;
  quantidadeEstoque: string;
  unidadeVenda: UnidadeVenda;
  fotoUrl: string | null;
  removerFoto: boolean;
};

const emptyForm: FormState = {
  id: "",
  nome: "",
  codigoBarras: "",
  precoUnitario: "",
  quantidadeEstoque: "0",
  unidadeVenda: "UNIDADE",
  fotoUrl: null,
  removerFoto: false,
};

/**
 * Painel de cadastro, busca, edição e exclusão de produtos (foto opcional).
 *
 * @param produtos - Lista inicial de produtos vindos do servidor.
 */
export function ProductsPanel({ produtos }: { produtos: ProductRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [previewLocal, setPreviewLocal] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [pending, startTransition] = useTransition();
  const codigoRef = useRef<HTMLInputElement>(null);
  const fotoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    codigoRef.current?.focus();
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return produtos;
    return produtos.filter(
      (p) =>
        p.nome.toLowerCase().includes(termo) ||
        p.codigoBarras.toLowerCase().includes(termo),
    );
  }, [busca, produtos]);

  const previewSrc =
    previewLocal ??
    (!form.removerFoto && form.fotoUrl ? form.fotoUrl : null);

  /**
   * Limpa o formulário e devolve o foco ao campo de código de barras.
   */
  function limparCampos() {
    setForm(emptyForm);
    setPreviewLocal(null);
    if (fotoRef.current) fotoRef.current.value = "";
    codigoRef.current?.focus();
  }

  /**
   * Preenche o formulário com os dados do produto selecionado para edição.
   *
   * @param produto - Linha da tabela a editar.
   */
  function editarProduto(produto: ProductRow) {
    setForm({
      id: produto.id,
      nome: produto.nome,
      codigoBarras: produto.codigoBarras,
      precoUnitario: formatCurrencyBRL(Number(produto.precoUnitario)),
      quantidadeEstoque: String(produto.quantidadeEstoque).replace(".", ","),
      unidadeVenda: produto.unidadeVenda,
      fotoUrl: produto.fotoUrl,
      removerFoto: false,
    });
    setPreviewLocal(null);
    if (fotoRef.current) fotoRef.current.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /**
   * Solicita ao servidor um código interno de 6 dígitos e preenche o campo.
   */
  function gerarCodigoInterno() {
    startTransition(async () => {
      const result = await gerarCodigoInternoAction();
      if (result.ok && result.codigoBarras) {
        setForm((prev) => ({ ...prev, codigoBarras: result.codigoBarras! }));
        toast(result.message, "success");
      } else {
        toast(result.message, "error");
      }
    });
  }

  /**
   * Envia o formulário para criar ou atualizar o produto (inclui arquivo de foto).
   *
   * @param e - Evento de submit do formulário.
   */
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result: ActionResult = await salvarProdutoAction(null, formData);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        limparCampos();
        router.refresh();
      }
    });
  }

  /**
   * Confirma e exclui um produto.
   *
   * @param id - Id do produto.
   * @param nome - Nome exibido na confirmação.
   */
  function excluirProduto(id: string, nome: string) {
    if (!window.confirm(`Excluir o produto "${nome}"?`)) return;
    startTransition(async () => {
      const result = await excluirProdutoAction(id);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        if (form.id === id) limparCampos();
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">
          {form.id ? "Editar produto" : "Cadastrar produto"}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Bipe o código de barras ou digite manualmente. Foto opcional (JPG/PNG/WebP, máx. 2 MB).
        </p>

        <form
          onSubmit={onSubmit}
          encType="multipart/form-data"
          className="mt-6 grid gap-4 sm:grid-cols-2"
        >
          <input type="hidden" name="id" value={form.id} />

          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label htmlFor="nome" className="text-sm font-medium text-zinc-700">
              Nome do produto
            </label>
            <input
              id="nome"
              name="nome"
              required
              value={form.nome}
              onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
              className="rounded-lg border border-zinc-300 px-3 py-2 outline-none ring-emerald-600 focus:ring-2"
            />
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label
              htmlFor="codigoBarras"
              className="text-sm font-medium text-zinc-700"
            >
              Código de barras
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <BarcodeInput
                ref={codigoRef}
                id="codigoBarras"
                name="codigoBarras"
                required
                inputMode="numeric"
                value={form.codigoBarras}
                onValueChange={(codigoBarras) =>
                  setForm((p) => ({ ...p, codigoBarras }))
                }
                onConfirm={() => {
                  (
                    codigoRef.current?.form?.elements.namedItem(
                      "nome",
                    ) as HTMLInputElement | null
                  )?.focus();
                }}
                placeholder="Bipe ou digite o código"
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 font-mono outline-none ring-emerald-600 focus:ring-2"
              />
              <button
                type="button"
                onClick={gerarCodigoInterno}
                disabled={pending}
                className="rounded-lg border border-emerald-700 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
              >
                Gerar código interno
              </button>
            </div>
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700">
              Cobrado por
            </span>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="radio"
                  name="unidadeVenda"
                  value="UNIDADE"
                  checked={form.unidadeVenda === "UNIDADE"}
                  onChange={() =>
                    setForm((p) => ({ ...p, unidadeVenda: "UNIDADE" }))
                  }
                  className="accent-emerald-700"
                />
                Unidade
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="radio"
                  name="unidadeVenda"
                  value="KG"
                  checked={form.unidadeVenda === "KG"}
                  onChange={() =>
                    setForm((p) => ({ ...p, unidadeVenda: "KG" }))
                  }
                  className="accent-emerald-700"
                />
                Quilo (kg)
              </label>
            </div>
            <p className="text-xs text-zinc-500">
              Produtos por kg pedem o peso no caixa (balança externa).
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="precoUnitario"
              className="text-sm font-medium text-zinc-700"
            >
              {form.unidadeVenda === "KG" ? "Preço por kg" : "Preço unitário"}
            </label>
            <input
              id="precoUnitario"
              name="precoUnitario"
              required
              inputMode="numeric"
              value={form.precoUnitario}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  precoUnitario: maskCurrencyInput(e.target.value),
                }))
              }
              placeholder="R$ 0,00"
              className="rounded-lg border border-zinc-300 px-3 py-2 outline-none ring-emerald-600 focus:ring-2"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="quantidadeEstoque"
              className="text-sm font-medium text-zinc-700"
            >
              {form.unidadeVenda === "KG"
                ? "Estoque (kg)"
                : "Quantidade em estoque"}
            </label>
            <input
              id="quantidadeEstoque"
              name="quantidadeEstoque"
              type="text"
              inputMode="decimal"
              required
              value={form.quantidadeEstoque}
              onChange={(e) =>
                setForm((p) => ({ ...p, quantidadeEstoque: e.target.value }))
              }
              placeholder={form.unidadeVenda === "KG" ? "Ex.: 12,500" : "0"}
              className="rounded-lg border border-zinc-300 px-3 py-2 outline-none ring-emerald-600 focus:ring-2"
            />
          </div>

          <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="foto" className="text-sm font-medium text-zinc-700">
                Foto do produto (opcional)
              </label>
              <input
                ref={fotoRef}
                id="foto"
                name="foto"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setPreviewLocal(URL.createObjectURL(file));
                    setForm((p) => ({ ...p, removerFoto: false }));
                  } else {
                    setPreviewLocal(null);
                  }
                }}
                className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-emerald-800"
              />
              {form.fotoUrl && !previewLocal ? (
                <label className="mt-1 flex items-center gap-2 text-sm text-zinc-600">
                  <input
                    type="checkbox"
                    name="removerFoto"
                    checked={form.removerFoto}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, removerFoto: e.target.checked }))
                    }
                    className="accent-emerald-700"
                  />
                  Remover foto atual
                </label>
              ) : null}
            </div>
            {previewSrc ? (
              <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewSrc}
                  alt="Prévia"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-xs text-zinc-400">
                Sem foto
              </div>
            )}
          </div>

          <div className="sm:col-span-2 flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              {pending ? "Salvando…" : form.id ? "Atualizar" : "Salvar"}
            </button>
            <button
              type="button"
              onClick={limparCampos}
              disabled={pending}
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Limpar campos
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Listagem de produtos
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {filtrados.length} produto(s)
            </p>
          </div>
          <div className="flex w-full flex-col gap-1.5 sm:max-w-xs">
            <label htmlFor="busca" className="text-sm font-medium text-zinc-700">
              Busca rápida
            </label>
            <input
              id="busca"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome ou código de barras"
              className="rounded-lg border border-zinc-300 px-3 py-2 outline-none ring-emerald-600 focus:ring-2"
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="px-2 py-2 font-medium">Foto</th>
                <th className="px-2 py-2 font-medium">Nome</th>
                <th className="px-2 py-2 font-medium">Código</th>
                <th className="px-2 py-2 font-medium">Cobrança</th>
                <th className="px-2 py-2 font-medium">Preço</th>
                <th className="px-2 py-2 font-medium">Estoque</th>
                <th className="px-2 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-zinc-500">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                filtrados.map((produto) => (
                  <tr
                    key={produto.id}
                    className="border-b border-zinc-100 text-zinc-800"
                  >
                    <td className="px-2 py-3">
                      {produto.fotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- uploads dinâmicos em /public
                        <img
                          src={produto.fotoUrl}
                          alt={produto.nome}
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded bg-zinc-100 text-[10px] text-zinc-400">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3">{produto.nome}</td>
                    <td className="px-2 py-3 font-mono text-xs">
                      {produto.codigoBarras}
                    </td>
                    <td className="px-2 py-3">
                      {produto.unidadeVenda === "KG" ? "kg" : "un"}
                    </td>
                    <td className="px-2 py-3">
                      {formatCurrencyBRL(Number(produto.precoUnitario))}
                      {produto.unidadeVenda === "KG" ? "/kg" : ""}
                    </td>
                    <td className="px-2 py-3">
                      {formatQuantidade(
                        Number(produto.quantidadeEstoque),
                        produto.unidadeVenda,
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => editarProduto(produto)}
                          className="text-emerald-700 hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            excluirProduto(produto.id, produto.nome)
                          }
                          className="text-red-600 hover:underline"
                          disabled={pending}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
