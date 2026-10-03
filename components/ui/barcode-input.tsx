"use client";

import {
  forwardRef,
  useCallback,
  useRef,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from "react";
import { useBarcodeWedge } from "@/hooks/use-barcode-wedge";

type BarcodeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "defaultValue" | "type"
> & {
  /** Valor exibido no campo. */
  value: string;
  /**
   * Chamado quando o valor muda (digitação, colagem ou bipagem).
   *
   * @param value - Texto atual sem espaços.
   */
  onValueChange: (value: string) => void;
  /**
   * Chamado ao confirmar Enter (teclado ou sufixo do leitor).
   *
   * @param value - Código confirmado.
   */
  onConfirm?: (value: string) => void;
  /**
   * Se true (padrão), captura bipagem mesmo sem foco no campo
   * (listener global em modo teclado).
   */
  captureGlobal?: boolean;
};

/**
 * Campo otimizado para leitores de código de barras (USB keyboard wedge).
 *
 * Combina input controlado com detector de bipagem rápida: durante a leitura
 * os dígitos aparecem no campo (`onPartial`) e, ao Enter do leitor, confirma
 * o código completo. Também aceita digitação manual e colagem.
 *
 * @param value - Valor atual do campo.
 * @param onValueChange - Atualiza o state do pai.
 * @param onConfirm - Opcional; Enter ou fim de bipagem.
 * @param captureGlobal - Ativa captura global (padrão: true).
 * @param props - Demais props nativas do input.
 * @returns Input pronto para bipagem e digitação manual.
 */
export const BarcodeInput = forwardRef<HTMLInputElement, BarcodeInputProps>(
  function BarcodeInput(
    {
      value,
      onValueChange,
      onConfirm,
      onKeyDown,
      captureGlobal = true,
      disabled,
      ...props
    },
    forwardedRef,
  ) {
    const localRef = useRef<HTMLInputElement | null>(null);

    /**
     * Mantém o ref local e o ref encaminhado pelo pai apontando para o input.
     *
     * @param node - Elemento do input ou `null` no unmount.
     */
    function setRefs(node: HTMLInputElement | null) {
      localRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    }

    const handleScan = useCallback(
      (code: string) => {
        onValueChange(code);
        onConfirm?.(code);
      },
      [onValueChange, onConfirm],
    );

    const handlePartial = useCallback(
      (partial: string) => {
        onValueChange(partial);
      },
      [onValueChange],
    );

    useBarcodeWedge({
      enabled: captureGlobal && !disabled,
      minLength: 4,
      inputRef: localRef,
      onPartial: handlePartial,
      onScan: handleScan,
    });

    /**
     * Normaliza removendo espaços.
     *
     * @param raw - Texto bruto.
     * @returns Texto sem espaços.
     */
    function normalizar(raw: string): string {
      return raw.replace(/\s+/g, "");
    }

    /**
     * Enter confirma o valor atual do campo (digitação manual).
     * Em bipagem rápida o wedge já trata o Enter na fase capture.
     *
     * @param e - Evento de teclado.
     */
    function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
      if (e.key === "Enter") {
        e.preventDefault();
        const atual = normalizar(e.currentTarget.value || value);
        onValueChange(atual);
        onConfirm?.(atual);
        return;
      }
      onKeyDown?.(e);
    }

    return (
      <input
        {...props}
        ref={setRefs}
        type="text"
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onValueChange(normalizar(e.target.value))}
        onKeyDown={handleKeyDown}
        onPaste={(e) => {
          const text = normalizar(e.clipboardData.getData("text"));
          if (text.length >= 4) {
            e.preventDefault();
            onValueChange(text);
            onConfirm?.(text);
          }
        }}
      />
    );
  },
);
