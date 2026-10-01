import Link from "next/link";
import { auth } from "@/auth";
import { logoutAction } from "@/lib/actions/auth";
import { ToastProvider } from "@/components/ui/toast";

const navItems = [
  { href: "/admin/dashboard", label: "Painel" },
  { href: "/admin/produtos", label: "Produtos" },
  { href: "/admin/funcionarios", label: "Funcionários" },
  { href: "/admin/configuracoes", label: "Configurações" },
];

/**
 * Layout do painel administrativo com navegação e toasts.
 *
 * @param children - Página filha renderizada na área de conteúdo.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <ToastProvider>
      <div className="min-h-screen bg-zinc-100">
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-emerald-700 uppercase">
                PDV Mercado
              </p>
              <h1 className="text-lg font-semibold text-zinc-900">
                Painel Administrativo
              </h1>
              <p className="text-sm text-zinc-500">
                {session?.user?.nome} · Gerente
              </p>
            </div>
            <nav className="flex flex-wrap items-center gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/pdv"
                className="rounded-lg px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50"
              >
                Ir ao PDV
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Sair
                </button>
              </form>
            </nav>
          </div>
        </header>
        <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
      </div>
    </ToastProvider>
  );
}
