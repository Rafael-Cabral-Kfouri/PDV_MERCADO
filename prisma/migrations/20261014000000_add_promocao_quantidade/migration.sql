-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "promocaoAtiva" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quantidadeMinimaPromocao" INTEGER,
ADD COLUMN     "precoPromocional" DECIMAL(10,2);
