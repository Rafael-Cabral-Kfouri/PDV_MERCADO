import { LoginForm } from "./login-form";

/**
 * Tela de login do PDV (e-mail e senha).
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          PDV Mercado
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Entre com seu e-mail e senha para acessar o sistema.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
