import { SalesReportPanel } from "@/components/admin/sales-report-panel";
import {
  listarOperadoresRelatorio,
  obterRelatorioVendas,
} from "@/lib/actions/sales-report";

/**
 * Obtém ano e mês atuais no fuso America/Sao_Paulo.
 *
 * @returns `{ ano, mes }` civis em Brasília.
 */
function mesAtualBrasil(): { ano: number; mes: number } {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [ano, mes] = iso.split("-").map(Number);
  return { ano, mes };
}

/**
 * Página administrativa de relatórios de vendas (resumo, lista e ranking).
 */
export default async function AdminVendasPage() {
  const { ano, mes } = mesAtualBrasil();
  const filtrosIniciais = {
    preset: "este_mes" as const,
    ano,
    mes,
    dataInicio: "",
    dataFim: "",
    formaPagamento: "" as const,
    operadorId: "",
  };

  const [relatorio, operadores] = await Promise.all([
    obterRelatorioVendas({ preset: "este_mes" }),
    listarOperadoresRelatorio(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold text-zinc-900">
          Relatório de vendas
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Resumo do período, lista de vendas e ranking dos produtos mais
          vendidos.
        </p>
      </div>
      <SalesReportPanel
        initialRelatorio={relatorio}
        operadores={operadores}
        initialFilters={filtrosIniciais}
      />
    </div>
  );
}
