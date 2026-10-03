"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  type ForwardedRef,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type RefObject,
} from "react";

type BarcodeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "defaultValue" | "type"
> & {
  /** Valor controlado pelo pai (ex.: limpar após bipar). */
  value: string;
  /**
   * Chamado quando o valor muda (digitação manual ou bipagem).
   *
   * @param value - Texto atual do campo, sem espaços.
   */
  onValueChange: (value: string) => void;
  /**
   * Chamado ao confirmar (Enter do teclado ou sufixo do leitor).
   * Usa o valor do DOM para não perder dígitos em bipagens rápidas.
   *
   * @param value - Código lido no momento do Enter.
   */
  onConfirm?: (value: string) => void;
};

/**
 * Une a ref interna do campo com a ref encaminhada pelo componente pai.
 *
 * @param el - Elemento input atual (ou null ao desmontar).
 * @param internal - Ref interna usada para sincronizar o valor.
 * @param forwarded - Ref opcional do pai (callback ou objeto).
 */
function assignRefs(
  el: HTMLInputElement | null,
  internal: RefObject<HTMLInputElement | null>,
  forwarded: ForwardedRef<HTMLInputElement>,
) {
  internal.current = el;
  if (typeof forwarded === "function") {
    forwarded(el);
  } else if (forwarded) {
    forwarded.current = el;
  }
}

/**
 * Campo de texto otimizado para leitores de código de barras em modo teclado.
 *
 * Leitores USB costumam enviar os dígitos em milissegundos e terminar com Enter.
 * Em inputs 100% controlados pelo React, o re-render pode apagar caracteres no meio
 * da bipagem. Este componente mantém o valor no DOM e sincroniza com o pai,
 * lendo sempre `input.value` nativo no Enter.
 *
 * @param value - Valor externo (quando o pai limpa ou preenche o campo).
 * @param onValueChange - Callback de alteração do texto.
 * @param onConfirm - Callback opcional ao pressionar Enter.
 * @param props - Demais atributos nativos de `input` (id, className, etc.).
 * @returns Elemento `input` pronto para bipagem e digitação manual.
 */
export const BarcodeInput = forwardRef<HTMLInputElement, BarcodeInputProps>(
  function BarcodeInput(
    { value, onValueChange, onConfirm, onKeyDown, ...props },
    forwardedRef,
  ) {
    const internalRef = useRef<HTMLInputElement>(null);
    const lastExternalValue = useRef(value);

    useEffect(() => {
      const el = internalRef.current;
      if (!el) return;
      if (value !== lastExternalValue.current || value !== el.value) {
        el.value = value;
        lastExternalValue.current = value;
      }
    }, [value]);

    /**
     * Normaliza o texto removendo espaços (leitores às vezes enviam espaços).
     *
     * @param raw - Valor bruto do input.
     * @returns Texto sem espaços.
     */
    function normalizar(raw: string): string {
      return raw.replace(/\s+/g, "");
    }

    /**
     * Trata Enter do leitor/teclado e encaminha demais teclas ao handler externo.
     *
     * @param e - Evento de teclado do input.
     */
    function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
      if (e.key === "Enter") {
        e.preventDefault();
        const atual = normalizar(e.currentTarget.value);
        if (e.currentTarget.value !== atual) {
          e.currentTarget.value = atual;
        }
        lastExternalValue.current = atual;
        onValueChange(atual);
        onConfirm?.(atual);
        return;
      }
      onKeyDown?.(e);
    }

    return (
      <input
        {...props}
        ref={(el) => assignRefs(el, internalRef, forwardedRef)}
        type="text"
        autoComplete="off"
        spellCheck={false}
        defaultValue={value}
        onChange={(e) => {
          const atual = normalizar(e.target.value);
          if (e.target.value !== atual) {
            e.target.value = atual;
          }
          lastExternalValue.current = atual;
          onValueChange(atual);
        }}
        onKeyDown={handleKeyDown}
      />
    );
  },
);
