-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "nomeEstabelecimento" TEXT NOT NULL DEFAULT 'PDV Mercado',
    "cnpj" TEXT NOT NULL DEFAULT '',
    "endereco" TEXT NOT NULL DEFAULT '',
    "mensagemRodape" TEXT NOT NULL DEFAULT 'Obrigado pela preferência! Volte sempre.',
    "imprimirAutomatico" BOOLEAN NOT NULL DEFAULT false,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- Seed row
INSERT INTO "StoreSettings" ("id", "nomeEstabelecimento", "cnpj", "endereco", "mensagemRodape", "imprimirAutomatico", "atualizadoEm")
VALUES (
  'default',
  'PDV Mercado',
  '00.000.000/0001-00',
  'Rua Exemplo, 100 — Centro',
  'Obrigado pela preferência! Volte sempre.',
  false,
  CURRENT_TIMESTAMP
);
