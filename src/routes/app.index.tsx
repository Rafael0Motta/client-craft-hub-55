import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ListTodo, ImageIcon, Clock, CheckCircle2, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/app/")({
  component: DashboardPage,
});

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "brand" | "red" | "green" | "amber";
}) {
  const accentMap = {
    brand: "bg-brand/10 text-brand",
    red: "bg-accent-red/10 text-accent-red",
    green: "bg-[var(--status-approved)]/10 text-[var(--status-approved)]",
    amber: "bg-[var(--status-pending)]/10 text-[var(--status-pending)]",
  };
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`h-11 w-11 rounded-lg flex items-center justify-center ${accentMap[accent ?? "brand"]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  const { profile, role } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", role],
    queryFn: async () => {
      const [clientes, tarefas, criativos] = await Promise.all([
        supabase.from("clientes").select("id, nome, segmento", { count: "exact" }).order("created_at", { ascending: false }),
        supabase.from("tarefas").select("id, titulo, status, prazo, cliente_id, clientes(nome)").order("created_at", { ascending: false }),
        supabase.from("criativos").select("id, arquivo_nome, status, created_at, cliente_id, clientes(nome)").order("created_at", { ascending: false }),
      ]);
      return {
        clientes: clientes.data ?? [],
        tarefas: tarefas.data ?? [],
        criativos: criativos.data ?? [],
      };
    },
  });

  const tarefasPorStatus = (status: string) =>
    (data?.tarefas ?? []).filter((t) => t.status === status).length;
  const criativosPendentes = (data?.criativos ?? []).filter((c) => c.status === "pendente_aprovacao");

  return (
    <>
      <PageHeader
        title={`Olá, ${profile?.nome?.split(" ")[0] ?? ""} 👋`}
        description="Visão geral do que está acontecendo agora."
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {(role === "admin" || role === "gestor") && (
              <StatCard label="Clientes" value={data?.clientes.length ?? 0} icon={Users} accent="brand" />
            )}
            <StatCard label="Tarefas ativas" value={(data?.tarefas.length ?? 0) - tarefasPorStatus("aprovado")} icon={ListTodo} accent="amber" />
            <StatCard label="Aguardando aprovação" value={tarefasPorStatus("aguardando_aprovacao")} icon={Clock} accent="red" />
            <StatCard label="Criativos pendentes" value={criativosPendentes.length} icon={ImageIcon} accent="green" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tarefas recentes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(data?.tarefas ?? []).slice(0, 6).map((t) => (
                  <Link
                    key={t.id}
                    to="/app/tarefas"
                    className="flex items-center justify-between p-3 rounded-md hover:bg-accent transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{t.titulo}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {(t.clientes as { nome: string } | null)?.nome ?? "—"}
                      </div>
                    </div>
                    <StatusBadge status={t.status} />
                  </Link>
                ))}
                {(data?.tarefas ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhuma tarefa ainda.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  Tarefas para revisar
                  {criativosPendentes.length > 0 && (
                    <span className="text-xs font-normal bg-accent-red text-accent-red-foreground px-2 py-0.5 rounded-full">
                      {criativosPendentes.length}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {criativosPendentes.slice(0, 6).map((c) => (
                  <Link
                    key={c.id}
                    to="/app/tarefas"
                    className="flex items-center justify-between p-3 rounded-md hover:bg-accent transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.arquivo_nome}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {(c.clientes as { nome: string } | null)?.nome ?? "—"}
                      </div>
                    </div>
                    <StatusBadge status={c.status} kind="creative" />
                  </Link>
                ))}
                {criativosPendentes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6 flex flex-col items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-[var(--status-approved)]" />
                    Tudo em dia!
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
