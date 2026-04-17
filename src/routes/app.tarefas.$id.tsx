import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { CriativosSection } from "@/components/CriativosSection";
import { ArrowLeft, Calendar, User as UserIcon, Building2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/app/tarefas/$id")({
  component: TarefaDetalhePage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Erro: {error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-6">
      <p className="text-sm text-muted-foreground mb-4">Tarefa não encontrada.</p>
      <Link to="/app/tarefas" className="text-primary hover:underline">Voltar para tarefas</Link>
    </div>
  ),
});

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try { return format(new Date(iso), "dd/MM/yyyy", { locale: ptBR }); }
  catch { return iso; }
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  try { return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); }
  catch { return iso; }
}

function TarefaDetalhePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const { data: tarefa, isLoading } = useQuery({
    queryKey: ["tarefa", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select("id, titulo, descricao, status, prioridade, prazo, cliente_id, created_at, criado_por, clientes(nome), profiles!criado_por(nome)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as {
        id: string; titulo: string; descricao: string | null;
        status: string; prioridade: string; prazo: string | null;
        cliente_id: string; created_at: string;
        clientes: { nome: string } | null;
        profiles: { nome: string } | null;
      } | null;
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (!tarefa) return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/tarefas" })}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>
      <p className="mt-4 text-sm text-muted-foreground">Tarefa não encontrada.</p>
    </div>
  );

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate({ to: "/app/tarefas" })}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar para tarefas
      </Button>

      <PageHeader
        title={tarefa.titulo}
        description={tarefa.clientes?.nome ?? "—"}
      />

      <Card className="mb-6">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={tarefa.status} />
            <PriorityBadge priority={tarefa.prioridade} />
          </div>

          {tarefa.descricao && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Descrição</div>
              <p className="text-sm whitespace-pre-wrap">{tarefa.descricao}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Cliente:</span>
              <span className="font-medium">{tarefa.clientes?.nome ?? "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Criada por:</span>
              <span className="font-medium">{tarefa.profiles?.nome ?? "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Criada em:</span>
              <span className="font-medium">{fmtDateTime(tarefa.created_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Vencimento:</span>
              <span className="font-medium">{fmtDate(tarefa.prazo)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-3">
        <h2 className="text-lg font-semibold">Criativos vinculados</h2>
        <p className="text-sm text-muted-foreground">Envie e acompanhe os criativos desta tarefa.</p>
      </div>

      <CriativosSection tarefaId={tarefa.id} clienteId={tarefa.cliente_id} />
    </>
  );
}
