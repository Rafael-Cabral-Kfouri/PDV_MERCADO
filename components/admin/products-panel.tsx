"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  excluirProdutoAction,
  gerarCodigoInternoAction,
  salvarProdutoAction,
  type ActionResult,
} from "@/lib/actions/products";
import { formatCurrencyBRL } from "@/lib/format";
import { formatDateInputValue } from "@/lib/validade-produto";
import { NfeImportPanel } from "@/components/admin/nfe-import-panel";
import { ProductForm } from "@/components/admin/product-form";
import { ProductList } from "@/components/admin/product-list";
import {
  emptyProductForm,
  type ProductFormState,
  type ProductRow,
} from "@/components/admin/product-types";
import { useToast } from "@/components/ui/toast";

export type { ProductRow };

/**
 * Painel de cadastro, busca, edição e exclusão de produtos
 * (foto opcional e data de validade com alertas de vencimento).
 *
 * @param produtos - Lista inicial de produtos vindos do servidor.
 */
export function ProductsPanel({ produtos }: { produtos: ProductRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<ProductFormState>(emptyProductForm);
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
    setForm(emptyProductForm);
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
      dataValidade: formatDateInputValue(produto.dataValidade),
      fotoUrl: produto.fotoUrl,
      removerFoto: false,
      promocaoAtiva: produto.promocaoAtiva,
      quantidadeMinimaPromocao:
        produto.quantidadeMinimaPromocao != null
          ? String(produto.quantidadeMinimaPromocao)
          : "",
      precoPromocional:
        produto.precoPromocional != null
          ? formatCurrencyBRL(Number(produto.precoPromocional))
          : "",
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

  /**
   * Atualiza a prévia local ao escolher um arquivo de foto.
   *
   * @param file - Arquivo selecionado ou undefined se limpo.
   */
  function onFotoChange(file: File | undefined) {
    if (file) {
      setPreviewLocal(URL.createObjectURL(file));
      setForm((p) => ({ ...p, removerFoto: false }));
    } else {
      setPreviewLocal(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <NfeImportPanel />

      <ProductForm
        form={form}
        setForm={setForm}
        previewSrc={previewSrc}
        temPreviewLocal={previewLocal !== null}
        pending={pending}
        codigoRef={codigoRef}
        fotoRef={fotoRef}
        onSubmit={onSubmit}
        onLimpar={limparCampos}
        onGerarCodigoInterno={gerarCodigoInterno}
        onFotoChange={onFotoChange}
      />

      <ProductList
        produtos={filtrados}
        busca={busca}
        onBuscaChange={setBusca}
        pending={pending}
        onEditar={editarProduto}
        onExcluir={excluirProduto}
      />
    </div>
  );
}
