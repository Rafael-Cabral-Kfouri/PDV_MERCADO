"use client";

import type {
  Dispatch,
  FormEvent,
  RefObject,
  SetStateAction,
} from "react";
import { maskCurrencyInput } from "@/lib/format";
import { BarcodeInput } from "@/components/ui/barcode-input";
import type { ProductFormState } from "@/components/admin/product-types";

type ProductFormProps = {
  form: ProductFormState;
  setForm: Dispatch<SetStateAction<ProductFormState>>;
  previewSrc: string | null;
  /** True quando há prévia de arquivo local (oculta “Remover foto atual”). */
  temPreviewLocal: boolean;
  pending: boolean;
  codigoRef: RefObject<HTMLInputElement | null>;
  fotoRef: RefObject<HTMLInputElement | null>;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onLimpar: () => void;
  onGerarCodigoInterno: () => void;
  onFotoChange: (file: File | undefined) => void;
};

/**
 * Formulário de cadastro/edição de produto (código, preço, promoção, foto).
 *
 * @param props.form - Estado controlado dos campos.
 * @param props.setForm - Setter do estado do formulário.
 * @param props.previewSrc - URL da prévia da foto (local ou servidor).
 * @param props.pending - Desabilita ações durante transition.
 * @param props.codigoRef - Ref do campo de código de barras (foco).
 * @param props.fotoRef - Ref do input de arquivo.
 * @param props.onSubmit - Handler de submit (cria/atualiza).
 * @param props.onLimpar - Limpa campos e foco.
 * @param props.onGerarCodigoInterno - Gera código interno de 6 dígitos.
 * @param props.onFotoChange - Atualiza prévia ao escolher arquivo.
 */
export function ProductForm({
  form,
  setForm,
  previewSrc,
  temPreviewLocal,
  pending,
  codigoRef,
  fotoRef,
  onSubmit,
  onLimpar,
  onGerarCodigoInterno,
  onFotoChange,
}: ProductFormProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">
        {form.id ? "Editar produto" : "Cadastrar produto"}
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Bipe o código de barras ou digite manualmente. Foto opcional
        (JPG/PNG/WebP, máx. 2 MB).
      </p>

      <form
        onSubmit={onSubmit}
        encType="multipart/form-data"
        className="mt-6 grid gap-4 sm:grid-cols-2"
      >
        <input type="hidden" name="id" value={form.id} />

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
              onConfirm={(codigo) => {
                setForm((p) => ({ ...p, codigoBarras: codigo }));
                window.requestAnimationFrame(() => {
                  (
                    document.getElementById("nome") as HTMLInputElement | null
                  )?.focus();
                });
              }}
              placeholder="Bipe ou digite o código"
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 font-mono outline-none ring-emerald-600 focus:ring-2"
            />
            <button
              type="button"
              onClick={onGerarCodigoInterno}
              disabled={pending}
              className="rounded-lg border border-emerald-700 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
            >
              Gerar código interno
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            Pode bipar mesmo sem clicar no campo. O código preenche sozinho.
          </p>
        </div>

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
          <span className="text-sm font-medium text-zinc-700">Cobrado por</span>
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
                  setForm((p) => ({
                    ...p,
                    unidadeVenda: "KG",
                    promocaoAtiva: false,
                  }))
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

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="dataValidade"
            className="text-sm font-medium text-zinc-700"
          >
            Data de validade
          </label>
          <input
            id="dataValidade"
            name="dataValidade"
            type="date"
            value={form.dataValidade}
            onChange={(e) =>
              setForm((p) => ({ ...p, dataValidade: e.target.value }))
            }
            className="rounded-lg border border-zinc-300 px-3 py-2 outline-none ring-emerald-600 focus:ring-2"
          />
          <p className="text-xs text-zinc-500">
            Opcional. Alertas aparecem a partir de 6 meses do vencimento.
          </p>
        </div>

        <div className="sm:col-span-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-800">
            <input
              type="checkbox"
              name="promocaoAtiva"
              checked={form.promocaoAtiva}
              disabled={form.unidadeVenda === "KG"}
              onChange={(e) =>
                setForm((p) => ({ ...p, promocaoAtiva: e.target.checked }))
              }
              className="accent-emerald-700"
            />
            Promoção por quantidade
          </label>
          <p className="mt-1 text-xs text-zinc-500">
            {form.unidadeVenda === "KG"
              ? "Disponível apenas para produtos cobrados por unidade."
              : "Ao atingir a quantidade mínima no caixa, o preço unitário passa a ser o promocional."}
          </p>
          {form.promocaoAtiva && form.unidadeVenda === "UNIDADE" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="quantidadeMinimaPromocao"
                  className="text-sm font-medium text-zinc-700"
                >
                  Quantidade mínima
                </label>
                <input
                  id="quantidadeMinimaPromocao"
                  name="quantidadeMinimaPromocao"
                  type="number"
                  min={2}
                  step={1}
                  required
                  value={form.quantidadeMinimaPromocao}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      quantidadeMinimaPromocao: e.target.value,
                    }))
                  }
                  placeholder="Ex.: 3"
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none ring-emerald-600 focus:ring-2"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="precoPromocional"
                  className="text-sm font-medium text-zinc-700"
                >
                  Preço promocional
                </label>
                <input
                  id="precoPromocional"
                  name="precoPromocional"
                  required
                  inputMode="numeric"
                  value={form.precoPromocional}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      precoPromocional: maskCurrencyInput(e.target.value),
                    }))
                  }
                  placeholder="R$ 0,00"
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none ring-emerald-600 focus:ring-2"
                />
              </div>
            </div>
          ) : null}
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
                onFotoChange(e.target.files?.[0]);
              }}
              className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-emerald-800"
            />
            {form.fotoUrl && !temPreviewLocal ? (
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
            onClick={onLimpar}
            disabled={pending}
            className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Limpar campos
          </button>
        </div>
      </form>
    </section>
  );
}
