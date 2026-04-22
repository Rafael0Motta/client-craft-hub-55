import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ListTodo, ImageIcon, Clock, CheckCircle2 } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

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
  } as const;
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
  const isManager = role === "admin" || role === "gestor";

  // Counts via head:true (não baixa dados, usa COUNT(*) — muito mais leve)
  const { data: counts, isLoading: loadingCounts } = useQuery({
    queryKey: ["dashboard-counts", role],
    queryFn: async () => {
      const [clientes, totalTarefas, aguardando, aprovadas, criativosPend] = await Promise.all([
        isManager
          ? supabase.from("clientes").select("*", { count: "exact", head: true })
          : Promise.resolve({ count: 0 }),
        supabase.from("tarefas").select("*", { count: "exact", head: true }),
        supabase.from("tarefas").select("*", { count: "exact", head: true }).eq("status", "aguardando_aprovacao"),
        supabase.from("tarefas").select("*", { count: "exact", head: true }).eq("status", "aprovado"),
        supabase.from("criativos").select("*", { count: "exact", head: true }).eq("status", "pendente_aprovacao"),
      ]);
      return {
        clientes: clientes.count ?? 0,
        totalTarefas: totalTarefas.count ?? 0,
        aguardando: aguardando.count ?? 0,
        aprovadas: aprovadas.count ?? 0,
        criativosPend: criativosPend.count ?? 0,
      };
    },
  });

  // Listagens enxutas (limit 6) – payload pequeno
  const { data: lists, isLoading: loadingLists } = useQuery({
    queryKey: ["dashboard-lists", role],
    queryFn: async () => {
      const tarefasPromise = supabase
        .from("tarefas")
        .select("id, titulo, status, cliente_id, clientes(nome)")
        .order("created_at", { ascending: false })
        .limit(6);

      const criativosPromise = isManager
        ? supabase
            .from("criativos")
            .select("id, arquivo_nome, status, cliente_id, tarefa_id, clientes(nome), tarefas(titulo)")
            .eq("status", "pendente_aprovacao")
            .order("created_at", { ascending: false })
            .limit(6)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> });

      const [tarefas, criativos] = await Promise.all([tarefasPromise, criativosPromise]);
      return {
        tarefas: tarefas.data ?? [],
        criativosPend: (criativos.data ?? []) as Array<{
          id: string; arquivo_nome: string; status: string;
          tarefa_id: string;
          clientes: { nome: string } | null;
          tarefas: { titulo: string } | null;
        }>,
      };
    },
  });

  const isLoading = loadingCounts || loadingLists;
  const tarefasAtivas = (counts?.totalTarefas ?? 0) - (counts?.aprovadas ?? 0);

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
            {isManager && (
              <StatCard label="Clientes" value={counts?.clientes ?? 0} icon={Users} accent="brand" />
            )}
            <StatCard label="Tarefas ativas" value={tarefasAtivas} icon={ListTodo} accent="amber" />
            <StatCard label="Aguardando aprovação" value={counts?.aguardando ?? 0} icon={Clock} accent="red" />
            <StatCard label="Criativos pendentes" value={counts?.criativosPend ?? 0} icon={ImageIcon} accent="green" />
          </div>

          <div className={`grid grid-cols-1 ${role === "cliente" ? "" : "lg:grid-cols-2"} gap-6`}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tarefas recentes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(lists?.tarefas ?? []).map((t) => (
                  <Link
                    key={t.id}
                    to="/app/tarefas/$id"
                    params={{ id: t.id }}
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
                {(lists?.tarefas ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhuma tarefa ainda.</p>
                )}
              </CardContent>
            </Card>

            {isManager && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    Tarefas para revisar
                    {(counts?.criativosPend ?? 0) > 0 && (
                      <span className="text-xs font-normal bg-accent-red text-accent-red-foreground px-2 py-0.5 rounded-full">
                        {counts?.criativosPend}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(lists?.criativosPend ?? []).map((c) => (
                    <Link
                      key={c.id}
                      to="/app/tarefas/$id"
                      params={{ id: c.tarefa_id }}
                      className="flex items-center justify-between p-3 rounded-md hover:bg-accent transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {c.tarefas?.titulo ?? c.arquivo_nome}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {c.clientes?.nome ?? "—"}
                        </div>
                      </div>
                      <StatusBadge status={c.status} kind="creative" />
                    </Link>
                  ))}
                  {(lists?.criativosPend ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6 flex flex-col items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-[var(--status-approved)]" />
                      Tudo em dia!
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </>
  );
}
