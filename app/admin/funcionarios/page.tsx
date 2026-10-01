import { EmployeesPanel } from "@/components/admin/employees-panel";
import { auth } from "@/auth";
import { listarFuncionarios } from "@/lib/actions/employees";

/**
 * Página administrativa de cadastro de funcionários.
 */
export default async function AdminFuncionariosPage() {
  const session = await auth();
  const funcionarios = await listarFuncionarios();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold text-zinc-900">Funcionários</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Defina perfil de acesso e documentos dos colaboradores.
        </p>
      </div>
      <EmployeesPanel
        funcionarios={funcionarios}
        currentUserId={session?.user?.id ?? ""}
      />
    </div>
  );
}
