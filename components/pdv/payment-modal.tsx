"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PaymentMethod } from "@prisma/client";
import { formatCurrencyBRL, maskCurrencyInput, parseCurrencyBRL } from "@/lib/format";

export type PaymentModalProps = {
  total: number;
  pending: boolean;
  onCancel: () => void;
  /**
   * Confirma o pagamento escolhido.
   *
   * @param forma - Forma de pagamento selecionada.
   * @param valorPago - Valor pago (obrigatório para dinheiro).
   */
  onConfirm: (forma: PaymentMethod, valorPago?: number) => void;
};

const FORMAS: { value: PaymentMethod; label: string }[] = [
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "CARTAO_CREDITO", label: "Cartão de crédito" },
  { value: "CARTAO_DEBITO", label: "Cartão de débito" },
  { value: "PIX", label: "PIX" },
];

/**
 * Modal de finalização da venda com formas de pagamento e cálculo de troco.
 *
 * @param total - Total da venda em reais.
 * @param pending - Indica se a confirmação está em andamento.
 * @param onCancel - Fecha o modal sem finalizar.
 * @param onConfirm - Callback ao confirmar pagamento.
 */
export function PaymentModal({
  total,
  pending,
  onCancel,
  onConfirm,
}: PaymentModalProps) {
  const [forma, setForma] = useState<PaymentMethod>("DINHEIRO");
  const [valorPagoMasked, setValorPagoMasked] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const pagoRef = useRef<HTMLInputElement>(null);

  const valorPago = useMemo(
    () => parseCurrencyBRL(valorPagoMasked),
    [valorPagoMasked],
  );

  const troco = useMemo(() => {
    if (forma !== "DINHEIRO" || !Number.isFinite(valorPago)) return 0;
    return Math.max(0, Number((valorPago - total).toFixed(2)));
  }, [forma, valorPago, total]);

  useEffect(() => {
    if (forma === "DINHEIRO") {
      pagoRef.current?.focus();
    }
  }, [forma]);

  useEffect(() => {
    /**
     * Esc fecha o modal; Enter confirma quando não está pendente.
     */
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  /**
   * Valida campos e dispara a confirmação do pagamento.
   */
  function confirmar() {
    setErro(null);
    if (forma === "DINHEIRO") {
      if (!Number.isFinite(valorPago) || valorPago <= 0) {
        setErro("Informe o valor pago em dinheiro.");
        return;
      }
      if (valorPago < total) {
        setErro("Valor pago insuficiente.");
        return;
      }
      onConfirm(forma, valorPago);
      return;
    }
    onConfirm(forma);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl">
        <h2 id="payment-title" className="text-lg font-semibold text-white">
          Finalizar venda
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Total:{" "}
          <span className="font-semibold text-emerald-400">
            {formatCurrencyBRL(total)}
          </span>
        </p>

        <fieldset className="mt-5 space-y-2">
          <legend className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
            Forma de pagamento
          </legend>
          {FORMAS.map((f) => (
            <label
              key={f.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                forma === f.value
                  ? "border-emerald-500 bg-emerald-500/10 text-white"
                  : "border-zinc-700 text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              <input
                type="radio"
                name="forma"
                value={f.value}
                checked={forma === f.value}
                onChange={() => {
                  setForma(f.value);
                  setErro(null);
                }}
                className="accent-emerald-500"
              />
              {f.label}
            </label>
          ))}
        </fieldset>

        {forma === "DINHEIRO" ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="valorPago"
                className="text-xs font-medium text-zinc-400 uppercase"
              >
                Valor pago
              </label>
              <input
                ref={pagoRef}
                id="valorPago"
                value={valorPagoMasked}
                onChange={(e) => {
                  setValorPagoMasked(maskCurrencyInput(e.target.value));
                  setErro(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmar();
                  }
                }}
                placeholder="R$ 0,00"
                className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 font-mono text-lg text-white outline-none ring-emerald-500 focus:ring-2"
              />
            </div>
            <div className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
              Troco:{" "}
              <span className="font-semibold text-emerald-400">
                {formatCurrencyBRL(
                  Number.isFinite(valorPago) && valorPago >= total ? troco : 0,
                )}
              </span>
            </div>
          </div>
        ) : null}

        {erro ? (
          <p className="mt-3 text-sm text-red-400" role="alert">
            {erro}
          </p>
        ) : null}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="flex-1 rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
          >
            Voltar (Esc)
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={pending}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {pending ? "Salvando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
