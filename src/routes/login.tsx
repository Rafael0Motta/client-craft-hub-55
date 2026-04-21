import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  if (!loading && user) return <Navigate to="/app" />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password.trim());
    setSubmitting(false);
    if (error) {
      toast.error("Falha no login", { description: error });
    } else {
      navigate({ to: "/app" });
    }
  };

  const onForgot = async (e: FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (error) {
      toast.error("Erro ao enviar email", { description: error.message });
    } else {
      toast.success("Email enviado", { description: "Verifique sua caixa de entrada." });
      setForgotOpen(false);
      setForgotEmail("");
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
      <div className="flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 text-center">
            <div className="text-3xl font-black text-brand">
              OLD<span className="text-accent-red">LAB</span>
            </div>
          </div>

          {!forgotOpen ? (
            <>
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
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Entrando…" : "Entrar"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotOpen(true);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center"
                >
                  Esqueci minha senha
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight">Recuperar senha</h1>
              <p className="text-sm text-muted-foreground mt-1 mb-8">
                Informe seu email para receber o link de redefinição.
              </p>
              <form onSubmit={onForgot} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={forgotLoading}>
                  {forgotLoading ? "Enviando…" : "Enviar link"}
                </Button>
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center"
                >
                  Voltar para o login
                </button>
              </form>
            </>
          )}

          <p className="text-xs text-muted-foreground mt-8 text-center">
            Acesso restrito. Contas são criadas pelo administrador.
          </p>
        </div>
      </div>
    </div>
  );
}
