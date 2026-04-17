import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/app" />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      toast.error("Falha no login", { description: error });
    } else {
      navigate({ to: "/app" });
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Painel marca */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-brand text-brand-foreground relative overflow-hidden">
        <div className="relative z-10">
          <div className="text-5xl font-black leading-none tracking-tight">
            OLD<span className="text-[var(--accent-red)]">LAB</span>
          </div>
          <div className="text-xs uppercase tracking-[0.3em] mt-2 opacity-70">Client System</div>
        </div>
        <div className="relative z-10 max-w-md">
          <p className="text-3xl font-semibold leading-tight">
            Gestão de clientes, tarefas e criativos em um só lugar.
          </p>
          <p className="text-sm mt-4 opacity-70">
            Plataforma interna OldLab para times, gestores e clientes.
          </p>
        </div>
        <div
          aria-hidden
          className="absolute -bottom-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-[var(--accent-red)]/30 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute top-1/3 -left-20 w-72 h-72 rounded-full bg-white/10 blur-3xl"
        />
      </div>

      {/* Formulário */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 text-center">
            <div className="text-3xl font-black text-brand">
              OLD<span className="text-accent-red">LAB</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Entrar</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-8">
            Acesse com seu email e senha.
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Entrando…" : "Entrar"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground mt-8 text-center">
            Acesso restrito. Contas são criadas pelo administrador.
          </p>
        </div>
      </div>
    </div>
  );
}
