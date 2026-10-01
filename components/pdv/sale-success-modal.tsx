"use client";

import { useEffect, useRef } from "react";
import { formatCurrencyBRL } from "@/lib/format";
import type { StoreSettingsDTO } from "@/lib/actions/settings";
import {
  printThermalReceipt,
  ThermalReceipt,
  type ReceiptItem,
} from "@/components/pdv/thermal-receipt";

export type SaleSuccessInfo = {
  codigoVenda: string;
  total: number;
  troco: number;
  valorPago: number | null;
  formaLabel: string;
  operadorNome: string;
  dataHora: string;
  itens: ReceiptItem[];
};

type SaleSuccessModalProps = {
  info: SaleSuccessInfo;
  loja: StoreSettingsDTO;
  onNovaVenda: () => void;
  onFechar: () => void;
};

/**
 * Modal pós-venda com resumo, recibo térmico 80mm e impressão (@media print).
 *
 * @param info - Dados da venda concluída.
 * @param loja - Configurações do estabelecimento (cabeçalho/rodapé/auto-print).
 * @param onNovaVenda - Inicia nova venda (F2).
 * @param onFechar - Fecha o modal e deixa o caixa livre.
 */
export function SaleSuccessModal({
  info,
  loja,
  onNovaVenda,
  onFechar,
}: SaleSuccessModalProps) {
  const autoPrinted = useRef(false);

  useEffect(() => {
    /**
     * F2 inicia nova venda; Esc fecha; P imprime.
     */
    function onKey(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        onNovaVenda();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onFechar();
      }
      if (e.key.toLowerCase() === "p" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        printThermalReceipt();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNovaVenda, onFechar]);

  useEffect(() => {
    if (loja.imprimirAutomatico && !autoPrinted.current) {
      autoPrinted.current = true;
      const t = window.setTimeout(() => printThermalReceipt(), 400);
      return () => window.clearTimeout(t);
    }
  }, [loja.imprimirAutomatico]);

  const receiptData = {
    codigoVenda: info.codigoVenda,
    operadorNome: info.operadorNome,
    dataHora: info.dataHora,
    itens: info.itens,
    total: info.total,
    formaPagamento: info.formaLabel,
    valorPago: info.valorPago,
    troco: info.troco,
    loja,
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 print:hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="success-title"
      >
        <div className="flex w-full max-w-3xl flex-col gap-4 md:flex-row">
          <div className="flex-1 rounded-2xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl">
            <h2
              id="success-title"
              className="text-lg font-semibold text-emerald-400"
            >
              Venda concluída
            </h2>
            <dl className="mt-4 space-y-2 text-sm text-zinc-300">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Código</dt>
                <dd className="font-mono">{info.codigoVenda}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Pagamento</dt>
                <dd>{info.formaLabel}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Total</dt>
                <dd className="font-semibold text-white">
                  {formatCurrencyBRL(info.total)}
                </dd>
              </div>
              {info.valorPago !== null ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Valor pago</dt>
                  <dd>{formatCurrencyBRL(info.valorPago)}</dd>
                </div>
              ) : null}
              {info.troco > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Troco</dt>
                  <dd className="font-semibold text-emerald-400">
                    {formatCurrencyBRL(info.troco)}
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => printThermalReceipt()}
                className="rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-900"
              >
                Imprimir recibo (P)
              </button>
              <button
                type="button"
                onClick={onNovaVenda}
                className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Nova venda (F2)
              </button>
              <button
                type="button"
                onClick={onFechar}
                className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
              >
                Fechar (Esc) — Caixa Livre
              </button>
            </div>
          </div>

          <div className="hidden max-h-[80vh] overflow-auto rounded-xl border border-zinc-700 bg-white p-3 md:block">
            <p className="mb-2 text-center text-xs text-zinc-500">
              Prévia 80mm
            </p>
            <ThermalReceipt data={receiptData} variant="preview" />
          </div>
        </div>
      </div>

      {/* Área usada na impressão (@media print) */}
      <div className="hidden print:block">
        <ThermalReceipt data={receiptData} variant="print" />
      </div>
    </>
  );
}
