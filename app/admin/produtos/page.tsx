import { ProductsPanel } from "@/components/admin/products-panel";
import { listarProdutos } from "@/lib/actions/products";

/**
 * Página administrativa de cadastro e listagem de produtos.
 */
export default async function AdminProdutosPage() {
  const produtos = await listarProdutos();

  const rows = produtos.map((p) => ({
    id: p.id,
    nome: p.nome,
    codigoBarras: p.codigoBarras,
    precoUnitario: p.precoUnitario.toString(),
    quantidadeEstoque: Number(p.quantidadeEstoque),
    unidadeVenda: p.unidadeVenda,
    fotoUrl: p.fotoUrl,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold text-zinc-900">Produtos</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Cadastre por unidade ou por kg (hortifruti), ou importe o XML da NF-e
          de compra. Use código de barras ou código interno.
        </p>
      </div>
      <ProductsPanel produtos={rows} />
    </div>
  );
}
