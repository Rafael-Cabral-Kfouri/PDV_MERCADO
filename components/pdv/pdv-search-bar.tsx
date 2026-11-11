"use client";

import type { RefObject } from "react";
import type { PdvProduct } from "@/lib/actions/pdv";
import { formatCurrencyBRL } from "@/lib/format";
import { parseQtyPrefix } from "@/lib/pdv-utils";
import { BarcodeInput } from "@/components/ui/barcode-input";

type PdvSearchBarProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  input: string;
  caixaOcupado: boolean;
  modalAberto: boolean;
  buscando: boolean;
  feedback: string | null;
  sugestoes: PdvProduct[];
  sugestaoIndex: number;
  ultimoProduto: PdvProduct | null;
  onInputChange: (valor: string) => void;
  onConfirm: (valor: string) => void;
  onSugestaoIndexChange: (updater: (i: number) => number) => void;
  onSelecionarSugestao: (produto: PdvProduct, quantidade: number) => void;
};

/**
 * Barra de bipagem/busca do PDV: BarcodeInput, lista de sugestões,
 * feedback e cartão do último produto adicionado.
 *
 * @param props - Estado e handlers controlados pelo orquestrador.
 */
export function PdvSearchBar({
  inputRef,
  input,
  caixaOcupado,
  modalAberto,
  buscando,
  feedback,
  sugestoes,
  sugestaoIndex,
  ultimoProduto,
  onInputChange,
  onConfirm,
  onSugestaoIndexChange,
  onSelecionarSugestao,
}: PdvSearchBarProps) {
  return (
    <section className="relative shrink-0 rounded-xl border border-zinc-700 bg-zinc-950 p-4">
      <label
        htmlFor="pdv-input"
        className="text-xs font-medium tracking-wide text-zinc-400 uppercase"
      >
        Bipar código · digitar nome · atalho 3*codigo
      </label>
      <BarcodeInput
        ref={inputRef}
        id="pdv-input"
        value={input}
        captureGlobal={!modalAberto}
        onValueChange={(valor) => {
          onInputChange(valor);
        }}
        onConfirm={(valor) => {
          onConfirm(valor);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && sugestoes.length > 0) {
            e.preventDefault();
            onSugestaoIndexChange((i) => (i + 1) % sugestoes.length);
            return;
          }
          if (e.key === "ArrowUp" && sugestoes.length > 0) {
            e.preventDefault();
            onSugestaoIndexChange(
              (i) => (i - 1 + sugestoes.length) % sugestoes.length,
            );
            return;
          }
        }}
        placeholder={
          caixaOcupado
            ? "Aguardando bipagem..."
            : "Pressione F2 para iniciar a venda"
        }
        className="mt-2 w-full rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-3 font-mono text-xl text-white outline-none ring-emerald-500 focus:ring-2"
      />

      {sugestoes.length > 0 ? (
        <ul className="absolute right-4 left-4 z-20 mt-1 max-h-56 overflow-auto rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
          {sugestoes.map((s, idx) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  const { quantidade } = parseQtyPrefix(input);
                  onSelecionarSugestao(s, quantidade);
                }}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm ${
                  idx === sugestaoIndex
                    ? "bg-emerald-700 text-white"
                    : "text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                {s.fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.fotoUrl}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded object-cover"
                  />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-zinc-800 text-[10px] text-zinc-500">
                    —
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-mono text-xs opacity-80">
                    {s.codigoBarras}
                  </span>{" "}
                  {s.nome}
                </span>
                <span className="shrink-0 font-medium">
                  {formatCurrencyBRL(s.precoUnitario)}
                  {s.unidadeVenda === "KG" ? "/kg" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-2 min-h-5 text-sm text-zinc-400">
        {buscando
          ? "Buscando…"
          : feedback ??
            (caixaOcupado
              ? "Bipe o produto ou digite o nome para ver sugestões."
              : "Caixa livre — F2 inicia nova venda.")}
      </p>

      {ultimoProduto ? (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900/80 p-3">
          {ultimoProduto.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ultimoProduto.fotoUrl}
              alt={ultimoProduto.nome}
              className="h-16 w-16 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-zinc-800 text-xs text-zinc-500">
              Sem foto
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">
              {ultimoProduto.nome}
            </p>
            <p className="font-mono text-xs text-zinc-400">
              {ultimoProduto.codigoBarras}
            </p>
            <p className="text-sm text-emerald-400">
              {formatCurrencyBRL(ultimoProduto.precoUnitario)}
              {ultimoProduto.unidadeVenda === "KG" ? "/kg" : ""}
            </p>
            {ultimoProduto.promocaoAtiva &&
            ultimoProduto.quantidadeMinimaPromocao != null &&
            ultimoProduto.precoPromocional != null ? (
              <p className="text-xs text-amber-300">
                Promo ≥{ultimoProduto.quantidadeMinimaPromocao} un ·{" "}
                {formatCurrencyBRL(ultimoProduto.precoPromocional)}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
