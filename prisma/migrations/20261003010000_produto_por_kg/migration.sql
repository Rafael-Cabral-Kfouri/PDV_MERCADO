-- CreateEnum
CREATE TYPE "UnidadeVenda" AS ENUM ('UNIDADE', 'KG');

-- AlterTable Product: estoque decimal + unidade de venda
ALTER TABLE "Product" ADD COLUMN "unidadeVenda" "UnidadeVenda" NOT NULL DEFAULT 'UNIDADE';

ALTER TABLE "Product" ALTER COLUMN "quantidadeEstoque" SET DATA TYPE DECIMAL(12,3);
ALTER TABLE "Product" ALTER COLUMN "quantidadeEstoque" SET DEFAULT 0;

-- AlterTable SaleItem: quantidade decimal (peso ou unidades)
ALTER TABLE "SaleItem" ALTER COLUMN "quantidade" SET DATA TYPE DECIMAL(12,3);
