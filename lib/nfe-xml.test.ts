import { describe, expect, it } from "vitest";
import { parseNfeXml } from "@/lib/nfe-xml";

const XML_MINIMO_VALIDO = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc>
  <NFe>
    <infNFe Id="NFe35240112345678901234550010000012341123456789">
      <ide>
        <nNF>1234</nNF>
      </ide>
      <emit>
        <xNome>Fornecedor Teste LTDA</xNome>
      </emit>
      <det nItem="1">
        <prod>
          <cProd>SKU1</cProd>
          <cEAN>7891000100103</cEAN>
          <xProd>Produto Exemplo</xProd>
          <uCom>UN</uCom>
          <qCom>2.0000</qCom>
          <vUnCom>5.5000</vUnCom>
        </prod>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`;

describe("parseNfeXml", () => {
  it("parseia um XML de NF-e mínimo válido", () => {
    const result = parseNfeXml(XML_MINIMO_VALIDO);
    expect(result.numeroNota).toBe("1234");
    expect(result.emitente).toBe("Fornecedor Teste LTDA");
    expect(result.itens).toHaveLength(1);
    expect(result.itens[0]).toMatchObject({
      nome: "Produto Exemplo",
      codigoBarras: "7891000100103",
      quantidade: 2,
      precoCusto: 5.5,
      unidadeVenda: "UNIDADE",
    });
  });

  it("rejeita XML inválido / que não parece NF-e", () => {
    expect(() => parseNfeXml("<html><body>não é nota</body></html>")).toThrow(
      /não parece ser uma NF-e/i,
    );
    expect(() => parseNfeXml("")).toThrow(/vazio/i);
  });
});
