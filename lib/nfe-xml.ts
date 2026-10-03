/**
 * Parser leve de XML de NF-e / NFC-e (sem dependências externas).
 * Extrai itens de `<det>/<prod>` com nome, EAN, quantidade, preço de custo e unidade.
 */

export type NfeItemParsed = {
  /** Número do item na nota (`nItem`), quando disponível. */
  nItem: number | null;
  /** Descrição do produto (`xProd`). */
  nome: string;
  /** Código de barras GTIN/EAN, se válido; caso contrário string vazia. */
  codigoBarras: string;
  /** Código do produto no emitente (`cProd`), útil quando não há GTIN. */
  codigoProdutoEmitente: string;
  /** Quantidade comercial (`qCom`). */
  quantidade: number;
  /** Preço unitário de custo (`vUnCom`). */
  precoCusto: number;
  /** Unidade comercial bruta da nota (`uCom`), ex.: UN, KG, CX. */
  unidadeNota: string;
  /** Unidade de venda sugerida para o PDV. */
  unidadeVenda: "UNIDADE" | "KG";
  /** Avisos não bloqueantes (ex.: sem GTIN). */
  avisos: string[];
};

export type NfeParseResult = {
  /** Chave de acesso da NF-e, se encontrada. */
  chaveAcesso: string | null;
  /** Número da nota (`nNF`), se encontrado. */
  numeroNota: string | null;
  /** Nome/razão social do emitente, se encontrado. */
  emitente: string | null;
  /** Itens parseados com sucesso. */
  itens: NfeItemParsed[];
};

/**
 * Obtém o conteúdo textual da primeira ocorrência de uma tag XML,
 * ignorando prefixos de namespace (ex.: `nfe:cEAN`).
 *
 * @param xml - Fragmento ou documento XML.
 * @param tag - Nome local da tag (sem namespace).
 * @returns Texto interno da tag, ou `null` se não existir.
 */
function textoTag(xml: string, tag: string): string | null {
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tag}>`,
    "i",
  );
  const m = xml.match(re);
  if (!m) return null;
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Extrai todos os blocos XML de uma tag (conteúdo interno),
 * ignorando prefixos de namespace.
 *
 * @param xml - Documento XML completo.
 * @param tag - Nome local da tag (ex.: `det`).
 * @returns Lista de conteúdos internos de cada ocorrência.
 */
function blocosTag(xml: string, tag: string): string[] {
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${tag}\\b([^>]*)>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tag}>`,
    "gi",
  );
  const blocos: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    blocos.push(m[0]);
  }
  return blocos;
}

/**
 * Lê o atributo `nItem` do elemento `<det>`, se presente.
 *
 * @param detXml - Bloco XML completo do `<det>`.
 * @returns Número do item ou `null`.
 */
function lerNItem(detXml: string): number | null {
  const m = detXml.match(/\bnItem\s*=\s*["'](\d+)["']/i);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normaliza um código EAN/GTIN vindo da NF-e.
 * Valores como `SEM GTIN`, zeros ou vazios são tratados como ausentes.
 *
 * @param raw - Valor bruto de `cEAN` ou `cEANTrib`.
 * @returns Apenas dígitos do GTIN, ou string vazia se inválido.
 */
export function normalizarGtin(raw: string | null | undefined): string {
  if (!raw) return "";
  const upper = raw.trim().toUpperCase();
  if (!upper || upper === "SEM GTIN" || upper === "NONE" || upper === "N/A") {
    return "";
  }
  const digits = upper.replace(/\D/g, "");
  if (!digits || /^0+$/.test(digits)) return "";
  // GTIN costuma ter 8, 12, 13 ou 14 dígitos
  if (![8, 12, 13, 14].includes(digits.length)) {
    // Ainda assim aceita se for numérico razoável (código interno bipável)
    if (digits.length >= 4 && digits.length <= 20) return digits;
    return "";
  }
  return digits;
}

/**
 * Converte a unidade comercial da nota (`uCom`/`uTrib`) na unidade do PDV.
 *
 * @param uCom - Unidade bruta da NF-e (ex.: KG, UN, CX).
 * @returns `KG` para unidades de peso; caso contrário `UNIDADE`.
 */
export function mapearUnidadeVenda(uCom: string | null | undefined): "UNIDADE" | "KG" {
  const u = (uCom ?? "").trim().toUpperCase();
  if (
    u === "KG" ||
    u === "KIL" ||
    u === "KILO" ||
    u === "QUILO" ||
    u === "KGS" ||
    u === "G" ||
    u === "GR" ||
    u === "GRAMA" ||
    u === "GRAMAS"
  ) {
    return "KG";
  }
  return "UNIDADE";
}

/**
 * Interpreta número decimal no padrão da NF-e (ponto como separador).
 *
 * @param raw - Texto numérico (ex.: `10.0000`).
 * @returns Número finito ou `NaN`.
 */
function parseNumeroNfe(raw: string | null): number {
  if (!raw) return Number.NaN;
  const cleaned = raw.trim().replace(/\s+/g, "").replace(",", ".");
  return Number.parseFloat(cleaned);
}

/**
 * Interpreta um bloco `<det>` da NF-e e devolve o item comercial.
 *
 * @param detXml - XML completo do elemento `<det>`.
 * @returns Item parseado, ou `null` se não houver dados mínimos (`xProd`).
 */
function parseDetItem(detXml: string): NfeItemParsed | null {
  const prodXml = textoTag(detXml, "prod") ?? detXml;
  const nome = textoTag(prodXml, "xProd")?.trim() ?? "";
  if (!nome) return null;

  const cEAN = normalizarGtin(textoTag(prodXml, "cEAN"));
  const cEANTrib = normalizarGtin(textoTag(prodXml, "cEANTrib"));
  const codigoBarras = cEAN || cEANTrib;
  const codigoProdutoEmitente = (textoTag(prodXml, "cProd") ?? "").trim();
  const unidadeNota = (textoTag(prodXml, "uCom") ?? textoTag(prodXml, "uTrib") ?? "").trim();
  const quantidade = parseNumeroNfe(textoTag(prodXml, "qCom") ?? textoTag(prodXml, "qTrib"));
  const precoCusto = parseNumeroNfe(
    textoTag(prodXml, "vUnCom") ?? textoTag(prodXml, "vUnTrib"),
  );

  const avisos: string[] = [];
  if (!codigoBarras) {
    avisos.push(
      "Sem GTIN/código de barras na nota. Informe um código ou gere um interno antes de importar.",
    );
  }
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    avisos.push("Quantidade inválida ou zerada na nota.");
  }
  if (!Number.isFinite(precoCusto) || precoCusto < 0) {
    avisos.push("Preço unitário de custo ausente ou inválido.");
  }

  // Gramas na nota → converte para kg no PDV
  let qtd = Number.isFinite(quantidade) ? quantidade : 0;
  let custo = Number.isFinite(precoCusto) ? precoCusto : 0;
  let unidadeVenda = mapearUnidadeVenda(unidadeNota);
  const uUpper = unidadeNota.toUpperCase();
  if (uUpper === "G" || uUpper === "GR" || uUpper === "GRAMA" || uUpper === "GRAMAS") {
    qtd = qtd / 1000;
    custo = custo * 1000;
    unidadeVenda = "KG";
    avisos.push("Unidade em gramas convertida para kg.");
  }

  if (unidadeVenda === "UNIDADE") {
    // Mantém frações se a nota trouxe (ex.: caixa), mas arredonda estoque típico
    qtd = Number(qtd.toFixed(3));
  } else {
    qtd = Number(qtd.toFixed(3));
  }
  custo = Number(custo.toFixed(4));

  return {
    nItem: lerNItem(detXml),
    nome,
    codigoBarras,
    codigoProdutoEmitente,
    quantidade: qtd,
    precoCusto: Number(custo.toFixed(2)),
    unidadeNota,
    unidadeVenda,
    avisos,
  };
}

/**
 * Faz o parse de um XML de NF-e ou NFC-e e extrai cabeçalho + itens de produto.
 *
 * Aceita XML “puro” (`NFe`/`infNFe`) ou envelopado (`nfeProc` / `nfceProc`).
 *
 * @param xmlRaw - Conteúdo textual do arquivo `.xml`.
 * @returns Dados da nota e lista de itens.
 * @throws Error se o XML não parecer uma NF-e ou não tiver itens.
 */
export function parseNfeXml(xmlRaw: string): NfeParseResult {
  const xml = xmlRaw.replace(/^\uFEFF/, "").trim();
  if (!xml) {
    throw new Error("Arquivo XML vazio.");
  }

  const lower = xml.toLowerCase();
  const pareceNfe =
    lower.includes("<nfe") ||
    lower.includes("<infNFe".toLowerCase()) ||
    lower.includes("nfeproc") ||
    lower.includes("nfce") ||
    lower.includes("<det");
  if (!pareceNfe) {
    throw new Error(
      "O arquivo não parece ser uma NF-e/NFC-e em XML. Exporte o XML da nota (não o PDF).",
    );
  }

  const dets = blocosTag(xml, "det");
  if (dets.length === 0) {
    throw new Error("Nenhum item (<det>) encontrado no XML da nota.");
  }

  const itens: NfeItemParsed[] = [];
  for (const det of dets) {
    const item = parseDetItem(det);
    if (item) itens.push(item);
  }

  if (itens.length === 0) {
    throw new Error("Não foi possível ler os produtos da nota.");
  }

  const chaveAcesso =
    textoTag(xml, "chNFe") ??
    (() => {
      const m = xml.match(/Id\s*=\s*["']NFe(\d{44})["']/i);
      return m?.[1] ?? null;
    })();

  const ide = blocosTag(xml, "ide")[0] ?? xml;
  const emit = blocosTag(xml, "emit")[0] ?? "";

  return {
    chaveAcesso,
    numeroNota: textoTag(ide, "nNF"),
    emitente: textoTag(emit, "xNome") ?? textoTag(emit, "xFant"),
    itens,
  };
}
