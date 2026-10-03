import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "produtos");
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

type ImageKind = "jpg" | "png" | "webp";

/**
 * Identifica o tipo da imagem pelo MIME e, se necessário, pelos bytes mágicos.
 *
 * @param mime - Valor de `file.type` enviado pelo navegador (pode vir vazio ou `image/jpg`).
 * @param buffer - Conteúdo do arquivo para sniffing.
 * @returns Extensão normalizada (`jpg` | `png` | `webp`) ou `null` se inválido.
 */
function detectarTipoImagem(mime: string, buffer: Buffer): ImageKind | null {
  const tipo = mime.trim().toLowerCase();
  if (tipo === "image/jpeg" || tipo === "image/jpg") return "jpg";
  if (tipo === "image/png") return "png";
  if (tipo === "image/webp") return "webp";

  // Fallback: alguns ambientes enviam MIME vazio/incorreto
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }

  return null;
}

/**
 * Salva a foto do produto em `public/uploads/produtos` e retorna a URL pública.
 *
 * @param file - Arquivo enviado no formulário (File do FormData).
 * @returns Caminho público (ex.: `/uploads/produtos/uuid.jpg`) ou `null` se vazio.
 * @throws Error se tipo/tamanho inválidos ou falha de gravação.
 */
export async function salvarFotoProduto(
  file: File | null,
): Promise<string | null> {
  if (!file || file.size === 0) return null;

  if (file.size > MAX_BYTES) {
    throw new Error("A foto deve ter no máximo 2 MB.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = detectarTipoImagem(file.type, buffer);
  if (!kind) {
    throw new Error("Formato de imagem inválido. Use JPG, PNG ou WebP.");
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}.${kind}`;
  const fullPath = path.join(UPLOAD_DIR, filename);
  await writeFile(fullPath, buffer);

  return `/uploads/produtos/${filename}`;
}

/**
 * Remove um arquivo de foto do disco a partir da URL pública.
 *
 * @param fotoUrl - URL pública (ex.: `/uploads/produtos/uuid.jpg`) ou null.
 */
export async function removerFotoProduto(fotoUrl: string | null | undefined) {
  if (!fotoUrl?.startsWith("/uploads/produtos/")) return;
  const filename = path.basename(fotoUrl);
  const fullPath = path.join(UPLOAD_DIR, filename);
  try {
    await unlink(fullPath);
  } catch {
    // arquivo já inexistente — ignora
  }
}
