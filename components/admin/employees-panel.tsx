"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  excluirFuncionarioAction,
  salvarFuncionarioAction,
  type EmployeeActionResult,
} from "@/lib/actions/employees";
import { maskCpf } from "@/lib/format";
import { useToast } from "@/components/ui/toast";

export type EmployeeRow = {
  id: string;
  nome: string;
  email: string;
  funcao: "ADMIN" | "CASHIER";
  cpf: string | null;
  rg: string | null;
  telefone: string | null;
  endereco: string | null;
};

type FormState = {
  id: string;
  nome: string;
  email: string;
  senha: string;
  funcao: "ADMIN" | "CASHIER" | "";
  cpf: string;
  rg: string;
  telefone: string;
  endereco: string;
};

const emptyForm: FormState = {
  id: "",
  nome: "",
  email: "",
  senha: "",
  funcao: "",
  cpf: "",
  rg: "",
  telefone: "",
  endereco: "",
};

/**
 * Painel de cadastro e listagem de funcionários com perfil Gerente ou Caixa.
 *
 * @param funcionarios - Lista inicial de funcionários.
 * @param currentUserId - Id do admin logado (para impedir autoexclusão na UI).
 */
export function EmployeesPanel({
  funcionarios,
  currentUserId,
}: {
  funcionarios: EmployeeRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [pending, startTransition] = useTransition();

  /**
   * Limpa todos os campos do formulário de funcionário.
   */
  function limparCampos() {
    setForm(emptyForm);
  }

  /**
   * Carrega um funcionário no formulário para edição.
   *
   * @param funcionario - Linha selecionada na tabela.
   */
  function editarFuncionario(funcionario: EmployeeRow) {
    setForm({
      id: funcionario.id,
      nome: funcionario.nome,
      email: funcionario.email,
      senha: "",
      funcao: funcionario.funcao,
      cpf: funcionario.cpf ? maskCpf(funcionario.cpf) : "",
      rg: funcionario.rg ?? "",
      telefone: funcionario.telefone ?? "",
      endereco: funcionario.endereco ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /**
   * Salva (cria ou atualiza) o funcionário via server action.
   *
   * @param e - Evento de submit.
   */
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result: EmployeeActionResult = await salvarFuncionarioAction(
        null,
        formData,
      );
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        limparCampos();
        router.refresh();
      }
    });
  }

  /**
   * Exclui um funcionário após confirmação.
   *
   * @param id - Id do funcionário.
   * @param nome - Nome para a mensagem de confirmação.
   */
  function excluirFuncionario(id: string, nome: string) {
    if (!window.confirm(`Excluir o funcionário "${nome}"?`)) return;
    startTransition(async () => {
      const result = await excluirFuncionarioAction(id);
      toast(result.message, result.ok ? "success" : "error");
      if (result.ok) {
        if (form.id === id) limparCampos();
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">
          {form.id ? "Editar funcionário" : "Cadastrar funcionário"}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Defina o perfil de acesso (Gerente ou Caixa) e os documentos.
        </p>

        <form onSubmit={onSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={form.id} />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="nome" className="text-sm font-medium text-zinc-700">
              Nome
            </label>
            <input
              id="nome"
              name="nome"
              required
              value={form.nome}
              onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
              className="rounded-lg border border-zinc-300 px-3 py-2 outline-none ring-emerald-600 focus:ring-2"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-zinc-700">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={(e) =>
                setForm((p) => ({ ...p, email: e.target.value }))
              }
              className="rounded-lg border border-zinc-300 px-3 py-2 outline-none ring-emerald-600 focus:ring-2"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="senha" className="text-sm font-medium text-zinc-700">
              Senha {form.id ? "(deixe em branco para manter)" : ""}
            </label>
            <input
              id="senha"
              name="senha"
              type="password"
              required={!form.id}
              minLength={form.id ? undefined : 6}
              value={form.senha}
              onChange={(e) =>
                setForm((p) => ({ ...p, senha: e.target.value }))
              }
              className="rounded-lg border border-zinc-300 px-3 py-2 outline-none ring-emerald-600 focus:ring-2"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="funcao"
              className="text-sm font-medium text-zinc-700"
            >
              Perfil de acesso
            </label>
            <select
              id="funcao"
              name="funcao"
              required
              value={form.funcao}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  funcao: e.target.value as FormState["funcao"],
                }))
              }
              className="rounded-lg border border-zinc-300 px-3 py-2 outline-none ring-emerald-600 focus:ring-2"
            >
              <option value="">Selecione…</option>
              <option value="ADMIN">Gerente (Admin)</option>
              <option value="CASHIER">Caixa (Operador)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cpf" className="text-sm font-medium text-zinc-700">
              CPF
            </label>
            <input
              id="cpf"
              name="cpf"
              value={form.cpf}
              onChange={(e) =>
                setForm((p) => ({ ...p, cpf: maskCpf(e.target.value) }))
              }
              placeholder="000.000.000-00"
              className="rounded-lg border border-zinc-300 px-3 py-2 outline-none ring-emerald-600 focus:ring-2"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="rg" className="text-sm font-medium text-zinc-700">
              RG
            </label>
            <input
              id="rg"
              name="rg"
              value={form.rg}
              onChange={(e) => setForm((p) => ({ ...p, rg: e.target.value }))}
              className="rounded-lg border border-zinc-300 px-3 py-2 outline-none ring-emerald-600 focus:ring-2"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="telefone"
              className="text-sm font-medium text-zinc-700"
            >
              Telefone
            </label>
            <input
              id="telefone"
              name="telefone"
              value={form.telefone}
              onChange={(e) =>
                setForm((p) => ({ ...p, telefone: e.target.value }))
              }
              className="rounded-lg border border-zinc-300 px-3 py-2 outline-none ring-emerald-600 focus:ring-2"
            />
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label
              htmlFor="endereco"
              className="text-sm font-medium text-zinc-700"
            >
              Endereço
            </label>
            <input
              id="endereco"
              name="endereco"
              value={form.endereco}
              onChange={(e) =>
                setForm((p) => ({ ...p, endereco: e.target.value }))
              }
              className="rounded-lg border border-zinc-300 px-3 py-2 outline-none ring-emerald-600 focus:ring-2"
            />
          </div>

          <div className="sm:col-span-2 flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              {pending ? "Salvando…" : form.id ? "Atualizar" : "Salvar"}
            </button>
            <button
              type="button"
              onClick={limparCampos}
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Limpar campos
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">
          Funcionários cadastrados
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="px-2 py-2 font-medium">Nome</th>
                <th className="px-2 py-2 font-medium">E-mail</th>
                <th className="px-2 py-2 font-medium">Perfil</th>
                <th className="px-2 py-2 font-medium">CPF</th>
                <th className="px-2 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {funcionarios.map((f) => (
                <tr key={f.id} className="border-b border-zinc-100">
                  <td className="px-2 py-3">{f.nome}</td>
                  <td className="px-2 py-3">{f.email}</td>
                  <td className="px-2 py-3">
                    {f.funcao === "ADMIN" ? "Gerente" : "Caixa"}
                  </td>
                  <td className="px-2 py-3 font-mono text-xs">
                    {f.cpf ? maskCpf(f.cpf) : "—"}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => editarFuncionario(f)}
                        className="text-emerald-700 hover:underline"
                      >
                        Editar
                      </button>
                      {f.id !== currentUserId ? (
                        <button
                          type="button"
                          onClick={() => excluirFuncionario(f.id, f.nome)}
                          className="text-red-600 hover:underline"
                          disabled={pending}
                        >
                          Excluir
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
