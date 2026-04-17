import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/lib/auth-context";

export function RequireAuth({
  children,
  allow,
}: {
  children: ReactNode;
  allow?: AppRole[];
}) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Carregando…</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;
  if (allow && role && !allow.includes(role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-semibold">Sem acesso</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Você não tem permissão para acessar esta área.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
