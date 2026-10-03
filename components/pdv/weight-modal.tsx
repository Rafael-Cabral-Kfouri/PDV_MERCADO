"use client";

import { useEffect, useRef, useState } from "react";
import { formatCurrencyBRL, parseDecimalBR } from "@/lib/format";
import type { PdvProduct } from "@/lib/actions/pdv";

type WeightModalProps = {
  produto: PdvProduct;
  /** Peso inicial sugerido (ex.: prefixo `2*codigo`). */
  pesoInicial?: number;
  onCancel: () => void;
  /**
   * Confirma o peso digitado.
   *
   * @param pesoKg - Peso em quilogramas (> 0).
   */
  onConfirm: (pesoKg: number) => void;
};

/**
 * Modal para informar o peso (kg) de um produto cobrado por quilo.
 * O operador pesa em balança externa e digita o valor aqui.
 *
 * @param produto - Produto por kg selecionado no PDV.
 * @param pesoInicial - Sugestão de peso ao abrir o modal.
 * @param onCancel - Fecha sem adicionar ao carrinho.
 * @param onConfirm - Callback com o peso validado em kg.
 */
export function WeightModal({
  produto,
  pesoInicial,
  onCancel,
  onConfirm,
}: WeightModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pesoTexto, setPesoTexto] = useState(
    pesoInicial && pesoInicial > 0 && pesoInicial !== 1
      ? String(pesoInicial).replace(".", ",")
      : "",
  );
  const [erro, setErro] = useState<string | null>(null);

  const peso = parseDecimalBR(pesoTexto);
  const total =
    Number.isFinite(peso) && peso > 0
      ? Number((peso * produto.precoUnitario).toFixed(2))
      : null;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  /**
   * Valida o peso e confirma a inclusão no carrinho.
   */
  function confirmar() {
    const valor = parseDecimalBR(pesoTexto);
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro("Informe um peso válido maior que zero.");
      return;
    }
    const arredondado = Number(valor.toFixed(3));
    if (arredondado > produto.quantidadeEstoque) {
      setErro(
        `Estoque insuficiente (disp. ${produto.quantidadeEstoque} kg).`,
      );
      return;
    }
    onConfirm(arredondado);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="peso-titulo"
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl">
        <h2 id="peso-titulo" className="text-lg font-semibold text-white">
          Informar peso
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          {produto.nome} · {formatCurrencyBRL(produto.precoUnitario)}/kg
        </p>

        <label
          htmlFor="peso-kg"
          className="mt-5 block text-xs font-medium tracking-wide text-zinc-400 uppercase"
        >
          Peso (kg)
        </label>
        <input
          ref={inputRef}
          id="peso-kg"
          inputMode="decimal"
          value={pesoTexto}
          onChange={(e) => {
            setPesoTexto(e.target.value);
            setErro(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirmar();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
          }}
          placeholder="Ex.: 1,250"
          className="mt-2 w-full rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-3 font-mono text-2xl text-white outline-none ring-emerald-500 focus:ring-2"
          autoComplete="off"
        />

        <p className="mt-3 text-sm text-zinc-300">
          Total estimado:{" "}
          <span className="font-semibold text-emerald-400">
            {total !== null ? formatCurrencyBRL(total) : "—"}
          </span>
        </p>
        {erro ? <p className="mt-2 text-sm text-red-400">{erro}</p> : null}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-900"
          >
            Cancelar (Esc)
          </button>
          <button
            type="button"
            onClick={confirmar}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Adicionar (Enter)
          </button>
        </div>
      </div>
    </div>
  );
}
