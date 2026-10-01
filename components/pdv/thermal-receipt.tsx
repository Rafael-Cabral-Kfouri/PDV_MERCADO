import { formatCurrencyBRL } from "@/lib/format";
import type { StoreSettingsDTO } from "@/lib/actions/settings";

export type ReceiptItem = {
  quantidade: number;
  nome: string;
  precoUnitario: number;
  precoTotal: number;
};

export type ReceiptData = {
  codigoVenda: string;
  operadorNome: string;
  dataHora: string;
  itens: ReceiptItem[];
  total: number;
  formaPagamento: string;
  valorPago: number | null;
  troco: number;
  loja: StoreSettingsDTO;
};

/**
 * Template de recibo não fiscal para bobina térmica 80mm (~300px).
 *
 * @param data - Dados da venda + estabelecimento.
 * @param variant - `preview` na tela; `print` é o alvo de `@media print`.
 */
export function ThermalReceipt({
  data,
  variant = "print",
}: {
  data: ReceiptData;
  variant?: "print" | "preview";
}) {
  const {
    loja,
    codigoVenda,
    operadorNome,
    dataHora,
    itens,
    total,
    formaPagamento,
    valorPago,
    troco,
  } = data;

  return (
    <div
      className={variant === "print" ? "receipt-print" : "receipt-preview"}
      id={variant === "print" ? "recibo-termico" : undefined}
    >
      <div className="receipt-inner">
        <header className="receipt-header">
          <p className="receipt-title">{loja.nomeEstabelecimento}</p>
          {loja.cnpj ? <p>CNPJ: {loja.cnpj}</p> : null}
          {loja.endereco ? <p>{loja.endereco}</p> : null}
          <p>{dataHora}</p>
        </header>

        <div className="receipt-sep" />

        <p>Venda: {codigoVenda}</p>
        <p>Operador: {operadorNome}</p>

        <div className="receipt-sep" />

        <table className="receipt-table">
          <thead>
            <tr>
              <th className="col-qtd">Qtd</th>
              <th className="col-desc">Descrição</th>
              <th className="col-val">Unit.</th>
              <th className="col-val">Total</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item, idx) => (
              <tr key={`${item.nome}-${idx}`}>
                <td className="col-qtd">{item.quantidade}</td>
                <td className="col-desc">{item.nome}</td>
                <td className="col-val">{formatCurrencyBRL(item.precoUnitario)}</td>
                <td className="col-val">{formatCurrencyBRL(item.precoTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="receipt-sep" />

        <p className="receipt-total">TOTAL {formatCurrencyBRL(total)}</p>
        <p>Pagamento: {formaPagamento}</p>
        {valorPago !== null ? (
          <p>Valor pago: {formatCurrencyBRL(valorPago)}</p>
        ) : null}
        {troco > 0 ? <p>Troco: {formatCurrencyBRL(troco)}</p> : null}

        <div className="receipt-sep" />

        <p className="receipt-footer">{loja.mensagemRodape}</p>
        <p className="receipt-footer">*** NÃO FISCAL ***</p>
      </div>
    </div>
  );
}

/**
 * Dispara a impressão do navegador (diálogo do SO escolhe a impressora).
 */
export function printThermalReceipt() {
  window.print();
}
