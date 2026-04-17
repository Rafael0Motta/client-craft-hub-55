import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/app/clientes/$id")({
  component: ClienteDetailPage,
});

function ClienteDetailPage() {
  const { id } = Route.useParams();

  const { data: cliente } = useQuery({
    queryKey: ["cliente", id],
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  const { data: gestor } = useQuery({
    queryKey: ["cliente-gestor", cliente?.gestor_id],
    enabled: !!cliente?.gestor_id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("nome, email").eq("id", cliente!.gestor_id!).maybeSingle();
      return data;
    },
  });

  const { data: tarefas } = useQuery({
    queryKey: ["cliente-tarefas", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tarefas")
        .select("id, titulo, status, prazo")
        .eq("cliente_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (!cliente) {
    return <div className="text-sm text-muted-foreground">Carregando…</div>;
  }

  return (
    <>
      <Link to="/app/clientes" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Link>
      <PageHeader
        title={cliente.nome}
        description={cliente.segmento ?? undefined}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Campanha</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">
              {cliente.campanha || "Sem informações da campanha."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Detalhes</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Gestor</div>
              <div className="font-medium">{gestor?.nome ?? "Não atribuído"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Segmento</div>
              <div className="font-medium">{cliente.segmento ?? "—"}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Tarefas</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link to="/app/tarefas">Ver todas</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {(tarefas ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma tarefa ainda.</p>
          ) : (
            <div className="space-y-2">
              {(tarefas ?? []).map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-md border">
                  <div>
                    <div className="font-medium">{t.titulo}</div>
                    {t.prazo && <div className="text-xs text-muted-foreground">Prazo: {t.prazo}</div>}
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
