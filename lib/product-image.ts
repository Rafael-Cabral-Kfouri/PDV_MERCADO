import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "produtos");
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

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

  if (!ALLOWED.has(file.type)) {
    throw new Error("Formato de imagem inválido. Use JPG, PNG ou WebP.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("A foto deve ter no máximo 2 MB.");
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  const fullPath = path.join(UPLOAD_DIR, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
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
