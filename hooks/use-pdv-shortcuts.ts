"use client";

import { useEffect } from "react";

type UsePdvShortcutsOptions = {
  /** Se true, ignora atalhos (modal de peso/pagamento/sucesso aberto). */
  modalAberto: boolean;
  /** F2 — inicia nova venda. */
  onNovaVenda: () => void;
  /** F4 — abre finalização. */
  onFinalizar: () => void;
  /** F8 — cancela a venda atual. */
  onCancelar: () => void;
  /** Esc — limpa busca e foca o input. */
  onLimparBusca: () => void;
};

/**
 * Registra atalhos de teclado do PDV: F2 nova · F4 finalizar · F8 cancelar · Esc limpa busca.
 * Não dispara enquanto um modal estiver aberto.
 *
 * @param options - Flags e callbacks dos atalhos.
 */
export function usePdvShortcuts({
  modalAberto,
  onNovaVenda,
  onFinalizar,
  onCancelar,
  onLimparBusca,
}: UsePdvShortcutsOptions) {
  useEffect(() => {
    /**
     * Atalhos: F2 nova · F4 finalizar · F8 cancelar · Esc limpa busca.
     */
    function onKeyDown(e: KeyboardEvent) {
      if (modalAberto) return;

      if (e.key === "F2") {
        e.preventDefault();
        onNovaVenda();
        return;
      }
      if (e.key === "F4") {
        e.preventDefault();
        onFinalizar();
        return;
      }
      if (e.key === "F8") {
        e.preventDefault();
        onCancelar();
        return;
      }
      if (e.key === "Escape") {
        onLimparBusca();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalAberto, onNovaVenda, onFinalizar, onCancelar, onLimparBusca]);
}
