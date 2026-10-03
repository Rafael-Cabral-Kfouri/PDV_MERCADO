"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  importarNfeItensAction,
  parseNfeXmlAction,
  type NfeImportItemInput,
  type NfePreviewItem,
} from "@/lib/actions/nfe-import";
import {
  formatCurrencyBRL,
  formatQuantidade,
  maskCurrencyInput,
  parseCurrencyBRL,
} from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import type { UnidadeVenda } from "@prisma/client";

type EditableItem = {
  index: number;
  selecionado: boolean;
  nome: string;
  codigoBarras: string;
  quantidade: string;
  precoCusto: number;
  precoVenda: string;
  unidadeVenda: UnidadeVenda;
  atualizarPreco: boolean;
  unidadeNota: string;
  avisos: string[];
  produtoExistente: NfePreviewItem["produtoExistente"];
  codigoProdutoEmitente: string;
  nItem: number | null;
};

type MetaNota = {
  emitente: string | null;
  numeroNota: string | null;
  chaveAcesso: string | null;
};

/**
 * Converte um item do preview do servidor em estado editável da UI.
 *
 * @param item - Item retornado por `parseNfeXmlAction`.
 * @returns Linha editável para a tabela de revisão.
 */
function toEditable(item: NfePreviewItem): EditableItem {
  return {
    index: item.index,
    selecionado: true,
    nome: item.nome,
    codigoBarras: item.codigoBarras,
    quantidade: String(item.quantidade).replace(".", ","),
    precoCusto: item.precoCusto,
    precoVenda: formatCurrencyBRL(item.precoVendaSugerido),
    unidadeVenda: item.unidadeVenda,
    atualizarPreco: !item.produtoExistente,
    unidadeNota: item.unidadeNota,
    avisos: item.avisos,
    produtoExistente: item.produtoExistente,
    codigoProdutoEmitente: item.codigoProdutoEmitente,
    nItem: item.nItem,
  };
}

/**
 * Painel de importação de produtos via XML de NF-e/NFC-e.
 *
 * Fluxo: upload do XML → revisão dos itens (nome, código, qtd, preço, unidade)
 * → confirmação, que cadastra produtos novos e soma estoque dos existentes.
 */
export function NfeImportPanel() {
  const router = useRouter();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [meta, setMeta] = useState<MetaNota | null>(null);
  const [itens, setItens] = useState<EditableItem[] | null>(null);

  /**
   * Atualiza um campo de um item editável pelo índice da lista.
   *
   * @param index - Índice na lista `itens`.
   * @param patch - Campos parciais a mesclar.
   */
  function updateItem(index: number, patch: Partial<EditableItem>) {
    setItens((prev) => {
      if (!prev) return prev;
      return prev.map((it) => (it.index === index ? { ...it, ...patch } : it));
    });
  }

  /**
   * Envia o XML ao servidor, monta o preview e exibe a tabela de revisão.
   *
   * @param e - Evento de submit do formulário de upload.
   */
  function onParse(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await parseNfeXmlAction(formData);
      if (!result.ok || !result.itens) {
        toast(result.message, "error");
        return;
      }
      setMeta({
        emitente: result.emitente ?? null,
        numeroNota: result.numeroNota ?? null,
        chaveAcesso: result.chaveAcesso ?? null,
      });
      setItens(result.itens.map(toEditable));
      toast(result.message, "success");
    });
  }

  /**
   * Cancela a revisão e limpa o arquivo selecionado.
   */
  function cancelarRevisao() {
    setItens(null);
    setMeta(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  /**
   * Confirma a importação dos itens selecionados (cria/atualiza estoque).
   */
  function confirmarImportacao() {
    if (!itens) return;

    const payload: NfeImportItemInput[] = itens.map((it) => ({
      selecionado: it.selecionado,
      nome: it.nome,
      codigoBarras: it.codigoBarras,
      quantidade: Number(
        it.quantidade.trim().replace(/\s+/g, "").replace(",", "."),
      ),
      precoVenda: parseCurrencyBRL(it.precoVenda),
      unidadeVenda: it.unidadeVenda,
      atualizarPreco: it.atualizarPreco,
    }));

    startTransition(async () => {
      const result = await importarNfeItensAction(payload);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        cancelarRevisao();
        router.refresh();
      }
    });
  }

  const selecionados = itens?.filter((i) => i.selecionado).length ?? 0;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">
        Importar nota fiscal (XML)
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Envie o XML da NF-e/NFC-e de compra. Os itens serão cadastrados ou terão
        o estoque somado. O preço da nota é de custo — ajuste o preço de venda
        antes de confirmar.
      </p>

      <form
        onSubmit={onParse}
        encType="multipart/form-data"
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="nfe-xml" className="text-sm font-medium text-zinc-700">
            Arquivo XML
          </label>
          <input
            ref={fileRef}
            id="nfe-xml"
            name="xml"
            type="file"
            accept=".xml,text/xml,application/xml"
            required
            disabled={pending || itens !== null}
            className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-emerald-800 disabled:opacity-60"
          />
        </div>
        <button
          type="submit"
          disabled={pending || itens !== null}
          className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {pending && !itens ? "Lendo XML…" : "Ler nota"}
        </button>
      </form>

      {itens && meta ? (
        <div className="mt-6 flex flex-col gap-4">
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            {meta.emitente ? (
              <p>
                <span className="font-medium">Emitente:</span> {meta.emitente}
              </p>
            ) : null}
            {meta.numeroNota ? (
              <p>
                <span className="font-medium">Nota:</span> {meta.numeroNota}
              </p>
            ) : null}
            {meta.chaveAcesso ? (
              <p className="font-mono text-xs break-all text-zinc-500">
                Chave: {meta.chaveAcesso}
              </p>
            ) : null}
            <p className="mt-1 text-zinc-600">
              {selecionados} de {itens.length} item(ns) selecionado(s)
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-zinc-500">
                <tr>
                  <th className="px-2 py-2 font-medium">OK</th>
                  <th className="px-2 py-2 font-medium">Produto</th>
                  <th className="px-2 py-2 font-medium">Código</th>
                  <th className="px-2 py-2 font-medium">Qtd</th>
                  <th className="px-2 py-2 font-medium">Un.</th>
                  <th className="px-2 py-2 font-medium">Custo NF</th>
                  <th className="px-2 py-2 font-medium">Preço venda</th>
                  <th className="px-2 py-2 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr
                    key={item.index}
                    className={`border-b border-zinc-100 align-top ${
                      item.selecionado ? "text-zinc-800" : "text-zinc-400"
                    }`}
                  >
                    <td className="px-2 py-3">
                      <input
                        type="checkbox"
                        checked={item.selecionado}
                        onChange={(e) =>
                          updateItem(item.index, {
                            selecionado: e.target.checked,
                          })
                        }
                        className="accent-emerald-700"
                        aria-label={`Selecionar ${item.nome}`}
                      />
                    </td>
                    <td className="px-2 py-3 min-w-[12rem]">
                      <input
                        value={item.nome}
                        disabled={!item.selecionado}
                        onChange={(e) =>
                          updateItem(item.index, { nome: e.target.value })
                        }
                        className="w-full rounded border border-zinc-300 px-2 py-1 outline-none ring-emerald-600 focus:ring-2 disabled:bg-zinc-50"
                      />
                      {item.avisos.length > 0 ? (
                        <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
                          {item.avisos.map((a) => (
                            <li key={a}>{a}</li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                    <td className="px-2 py-3 min-w-[9rem]">
                      <input
                        value={item.codigoBarras}
                        disabled={!item.selecionado}
                        onChange={(e) =>
                          updateItem(item.index, {
                            codigoBarras: e.target.value.replace(/\s+/g, ""),
                          })
                        }
                        placeholder="Vazio → código interno"
                        className="w-full rounded border border-zinc-300 px-2 py-1 font-mono text-xs outline-none ring-emerald-600 focus:ring-2 disabled:bg-zinc-50"
                      />
                      {item.codigoProdutoEmitente ? (
                        <p className="mt-0.5 text-[10px] text-zinc-400">
                          cProd: {item.codigoProdutoEmitente}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-2 py-3 w-24">
                      <input
                        value={item.quantidade}
                        disabled={!item.selecionado}
                        onChange={(e) =>
                          updateItem(item.index, {
                            quantidade: e.target.value,
                          })
                        }
                        className="w-full rounded border border-zinc-300 px-2 py-1 outline-none ring-emerald-600 focus:ring-2 disabled:bg-zinc-50"
                      />
                    </td>
                    <td className="px-2 py-3">
                      <select
                        value={item.unidadeVenda}
                        disabled={!item.selecionado}
                        onChange={(e) =>
                          updateItem(item.index, {
                            unidadeVenda: e.target.value as UnidadeVenda,
                          })
                        }
                        className="rounded border border-zinc-300 px-2 py-1 outline-none ring-emerald-600 focus:ring-2 disabled:bg-zinc-50"
                      >
                        <option value="UNIDADE">un</option>
                        <option value="KG">kg</option>
                      </select>
                      {item.unidadeNota ? (
                        <p className="mt-0.5 text-[10px] text-zinc-400">
                          NF: {item.unidadeNota}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap">
                      {formatCurrencyBRL(item.precoCusto)}
                    </td>
                    <td className="px-2 py-3 min-w-[8rem]">
                      <input
                        value={item.precoVenda}
                        disabled={!item.selecionado}
                        onChange={(e) =>
                          updateItem(item.index, {
                            precoVenda: maskCurrencyInput(e.target.value),
                          })
                        }
                        className="w-full rounded border border-zinc-300 px-2 py-1 outline-none ring-emerald-600 focus:ring-2 disabled:bg-zinc-50"
                      />
                      {item.produtoExistente ? (
                        <label className="mt-1 flex items-center gap-1.5 text-xs text-zinc-600">
                          <input
                            type="checkbox"
                            checked={item.atualizarPreco}
                            disabled={!item.selecionado}
                            onChange={(e) =>
                              updateItem(item.index, {
                                atualizarPreco: e.target.checked,
                              })
                            }
                            className="accent-emerald-700"
                          />
                          Atualizar preço
                        </label>
                      ) : null}
                    </td>
                    <td className="px-2 py-3 text-xs">
                      {item.produtoExistente ? (
                        <div>
                          <span className="rounded bg-sky-50 px-1.5 py-0.5 font-medium text-sky-800">
                            Já cadastrado
                          </span>
                          <p className="mt-1 text-zinc-500">
                            Estoque atual:{" "}
                            {formatQuantidade(
                              item.produtoExistente.quantidadeEstoque,
                              item.produtoExistente.unidadeVenda,
                            )}
                          </p>
                        </div>
                      ) : (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-800">
                          Novo
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={confirmarImportacao}
              disabled={pending || selecionados === 0}
              className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              {pending
                ? "Importando…"
                : `Confirmar importação (${selecionados})`}
            </button>
            <button
              type="button"
              onClick={cancelarRevisao}
              disabled={pending}
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() =>
                setItens((prev) =>
                  prev
                    ? prev.map((i) => ({ ...i, selecionado: true }))
                    : prev,
                )
              }
              disabled={pending}
              className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              Selecionar todos
            </button>
            <button
              type="button"
              onClick={() =>
                setItens((prev) =>
                  prev
                    ? prev.map((i) => ({ ...i, selecionado: false }))
                    : prev,
                )
              }
              disabled={pending}
              className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              Desmarcar todos
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
