"use client";

import { useEffect, useRef, type RefObject } from "react";

type UseBarcodeWedgeOptions = {
  /** Se false, o listener fica inativo. */
  enabled?: boolean;
  /** Tamanho mínimo do código para aceitar como bipagem. */
  minLength?: number;
  /**
   * Intervalo máximo médio entre teclas (ms) para considerar bipagem.
   * Digitação humana costuma ser mais lenta.
   */
  maxKeyIntervalMs?: number;
  /**
   * Input “dono” da bipagem. Enquanto o foco estiver em outro campo
   * editável, o detector não intercepta teclas.
   */
  inputRef?: RefObject<HTMLInputElement | null>;
  /**
   * Chamado a cada tecla acumulada durante uma bipagem rápida
   * (para o código aparecer no campo enquanto lê).
   *
   * @param partial - Código parcial acumulado.
   */
  onPartial?: (partial: string) => void;
  /**
   * Chamado quando uma bipagem completa é detectada.
   *
   * @param code - Código lido (sem sufixo Enter/Tab).
   */
  onScan: (code: string) => void;
};

type BufferItem = {
  key: string;
  at: number;
};

/**
 * Indica se o elemento é um campo editável (input/textarea/contentEditable).
 *
 * @param el - Elemento alvo do evento ou `activeElement`.
 * @returns `true` se o usuário provavelmente está digitando ali.
 */
function isEditableElement(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea") return true;
  if (el.isContentEditable) return true;
  if (tag !== "input") return false;
  const type = ((el as HTMLInputElement).type || "text").toLowerCase();
  return ![
    "button",
    "checkbox",
    "radio",
    "submit",
    "reset",
    "file",
    "image",
    "hidden",
    "range",
    "color",
  ].includes(type);
}

/**
 * Calcula o intervalo médio entre teclas do buffer.
 *
 * @param itens - Teclas acumuladas com timestamp.
 * @returns Média em ms, ou 0 se houver menos de 2 teclas.
 */
function mediaIntervalo(itens: BufferItem[]): number {
  if (itens.length < 2) return 0;
  const gaps = itens.slice(1).map((item, i) => item.at - itens[i].at);
  return gaps.reduce((a, b) => a + b, 0) / gaps.length;
}

/**
 * Detecta bipagem de leitores USB em modo teclado (keyboard wedge).
 *
 * Acumula teclas rápidas e dispara `onScan` ao receber Enter/Tab (sufixo
 * típico do leitor) ou ao encerrar a sequência por timeout. Com `onPartial`,
 * atualiza o campo durante a leitura para o operador ver os dígitos.
 *
 * Ignora atalhos com Ctrl/Alt/Meta e não intercepta digitação em outros
 * campos editáveis (ex.: nome do produto, busca).
 *
 * @param options - Configuração do detector e callbacks.
 * @returns void — efeito colateral via `onScan` / `onPartial`.
 */
export function useBarcodeWedge({
  enabled = true,
  minLength = 4,
  maxKeyIntervalMs = 120,
  inputRef,
  onPartial,
  onScan,
}: UseBarcodeWedgeOptions): void {
  const bufferRef = useRef<BufferItem[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScanRef = useRef(onScan);
  const onPartialRef = useRef(onPartial);
  const interceptandoRef = useRef(false);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    onPartialRef.current = onPartial;
  }, [onPartial]);

  useEffect(() => {
    if (!enabled) return;

    /**
     * Limpa o buffer acumulado de teclas do leitor.
     */
    function limparBuffer() {
      bufferRef.current = [];
      interceptandoRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    /**
     * Avalia o buffer e, se parecer bipagem válida, chama `onScan`.
     *
     * @param fromEnter - Se true, Enter/Tab do leitor confirma mesmo com
     *   intervalos um pouco maiores (mais tolerante que o timeout).
     */
    function finalizarScan(fromEnter = false) {
      const itens = bufferRef.current;
      limparBuffer();
      if (itens.length < minLength) return;

      const media = mediaIntervalo(itens);
      const limite = fromEnter ? maxKeyIntervalMs * 2.5 : maxKeyIntervalMs;
      // Sequência lenta = digitação humana; não intercepta.
      if (media > limite) return;

      const code = itens
        .map((i) => i.key)
        .join("")
        .replace(/\s+/g, "");

      if (code.length < minLength) return;
      onScanRef.current(code);
    }

    /**
     * Captura teclas do leitor no document (fase capture).
     *
     * @param e - Evento nativo de teclado.
     */
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.isComposing) return;

      const target = e.target as HTMLElement | null;
      const nossoInput = inputRef?.current ?? null;
      const focoEmOutroEditavel =
        isEditableElement(target) &&
        !!nossoInput &&
        target !== nossoInput &&
        !nossoInput.contains(target);

      // Digitando nome/busca/outro campo: não interfere.
      if (focoEmOutroEditavel) {
        limparBuffer();
        return;
      }

      if (e.key === "Enter" || e.key === "Tab") {
        if (bufferRef.current.length >= minLength) {
          e.preventDefault();
          e.stopPropagation();
          finalizarScan(true);
        } else {
          limparBuffer();
        }
        return;
      }

      if (e.key.length !== 1) {
        if (!e.key.startsWith("F")) limparBuffer();
        return;
      }

      const agora = performance.now();
      const ultimo = bufferRef.current[bufferRef.current.length - 1];
      if (ultimo && agora - ultimo.at > maxKeyIntervalMs * 4) {
        bufferRef.current = [];
        interceptandoRef.current = false;
      }

      bufferRef.current.push({ key: e.key, at: agora });

      const media = mediaIntervalo(bufferRef.current);
      const bipagemRapida =
        bufferRef.current.length >= 2 && media <= maxKeyIntervalMs;

      if (bipagemRapida) {
        interceptandoRef.current = true;
        // Evita digitar no lugar errado (botão, body). No próprio input,
        // também bloqueia para não perder dígitos no React controlado —
        // o valor vai via onPartial/onScan.
        e.preventDefault();
        e.stopPropagation();

        const partial = bufferRef.current.map((i) => i.key).join("");
        onPartialRef.current?.(partial);
      }

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (bufferRef.current.length >= minLength) {
          finalizarScan(false);
        } else {
          limparBuffer();
        }
      }, maxKeyIntervalMs * 4);
    }

    /**
     * Alguns leitores/dispositivos colam o código (paste) em vez de digitar.
     *
     * @param e - Evento de colagem.
     */
    function onPaste(e: ClipboardEvent) {
      const text = e.clipboardData?.getData("text")?.replace(/\s+/g, "") ?? "";
      if (text.length < minLength) return;
      if (!/^[A-Za-z0-9\-./]+$/.test(text)) return;

      const target = e.target as HTMLElement | null;
      const nossoInput = inputRef?.current ?? null;
      if (
        isEditableElement(target) &&
        nossoInput &&
        target !== nossoInput &&
        !nossoInput.contains(target)
      ) {
        return;
      }

      e.preventDefault();
      onScanRef.current(text);
    }

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("paste", onPaste, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("paste", onPaste, true);
      limparBuffer();
    };
  }, [enabled, minLength, maxKeyIntervalMs, inputRef]);
}
