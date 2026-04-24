import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { CriativosSection } from "@/components/CriativosSection";
import { TarefaComentarios } from "@/components/TarefaComentarios";
import { taskStatusOrder, taskStatusLabels, taskPriorityLabels, funilLabels, funilOrder } from "@/lib/labels";
import { ArrowLeft, Calendar, User as UserIcon, Building2, Pencil } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

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

type TarefaDetalhe = {
  id: string; titulo: string; descricao: string | null;
  status: string; prioridade: string; prazo: string | null;
  cliente_id: string; created_at: string;
  tipo_tarefa_id: string | null; funil: string | null;
  clientes: { nome: string } | null;
  tipos_tarefa: { nome: string } | null;
  profiles: { nome: string } | null;
};

function TarefaDetalhePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data: tarefa, isLoading } = useQuery({
    queryKey: ["tarefa", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select("id, titulo, descricao, status, prioridade, prazo, cliente_id, created_at, criado_por, tipo_tarefa_id, funil, clientes(nome), tipos_tarefa(nome)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      let criador: { nome: string } | null = null;
      if (data.criado_por) {
        // Usa RPC SECURITY DEFINER porque o RLS de profiles impede que gestores
        // vejam profiles de admins (e vice-versa). A RPC retorna apenas o nome.
        const { data: rows } = await supabase.rpc("get_profile_names", {
          _ids: [data.criado_por],
        });
        const first = (rows ?? [])[0] as { nome: string } | undefined;
        criador = first ? { nome: first.nome } : null;
      }
      return { ...data, profiles: criador } as unknown as TarefaDetalhe;
    },
  });

  const update = useMutation({
    mutationFn: async (p: {
      titulo: string; descricao: string | null;
      status: string; prioridade: string;
      prazo: string | null; funil: string | null;
    }) => {
      const { error } = await supabase
        .from("tarefas")
        .update({
          titulo: p.titulo,
          descricao: p.descricao,
          status: p.status as never,
          prioridade: p.prioridade as never,
          prazo: p.prazo,
          funil: p.funil as never,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tarefa", id] });
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      setEditOpen(false);
      toast.success("Tarefa atualizada");
    },
    onError: (e: Error) => toast.error("Erro ao atualizar", { description: e.message }),
  });

  // Permite que o cliente alterne o status da própria tarefa entre Pendente e Em andamento.
  const toggleAndamento = useMutation({
    mutationFn: async (novoStatus: "pendente" | "em_andamento") => {
      const { error } = await supabase
        .from("tarefas")
        .update({ status: novoStatus as never })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tarefa", id] });
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      toast.success("Status atualizado");
    },
    onError: (e: Error) => toast.error("Erro ao atualizar status", { description: e.message }),
  });

  const canEdit = role === "admin" || role === "gestor";

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (!tarefa) return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/tarefas" })}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>
      <p className="mt-4 text-sm text-muted-foreground">Tarefa não encontrada.</p>
    </div>
  );

  const isCliente = role === "cliente";
  const isCriativo = tarefa.tipos_tarefa?.nome?.toLowerCase() === "criativo";

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate({ to: "/app/tarefas" })}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar para tarefas
      </Button>

      <PageHeader
        title={tarefa.titulo}
        description={tarefa.clientes?.nome ?? "—"}
        actions={
          canEdit ? (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </Button>
          ) : null
        }
      />

      {isCliente && (
        <Card className="mb-4 border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-primary font-bold mb-2">Como proceder</div>
            <ol className="text-sm space-y-1 list-decimal list-inside">
              <li>Leia atentamente a <strong>descrição</strong> abaixo.</li>
              {isCriativo ? (
                <li>Cole o <strong>link do criativo</strong> (Drive, Dropbox, etc.) na seção abaixo e clique em <strong>Enviar link</strong>.</li>
              ) : (
                <li>Envie o(s) <strong>arquivo(s) ou link(s)</strong> na seção abaixo.</li>
              )}
              <li>Aguarde a <strong>aprovação</strong> do gestor. Se reprovado, envie uma <strong>nova versão</strong>.</li>
            </ol>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={tarefa.status} />
            {!isCliente && <PriorityBadge priority={tarefa.prioridade} />}
            {tarefa.tipos_tarefa?.nome && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold uppercase tracking-wider">
                {tarefa.tipos_tarefa.nome}
              </span>
            )}
            {tarefa.funil && !isCliente && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-accent text-accent-foreground font-semibold uppercase tracking-wider">
                Funil: {tarefa.funil}
              </span>
            )}
          </div>

          {tarefa.descricao && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Descrição</div>
              <p className="text-sm whitespace-pre-wrap">{tarefa.descricao}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {!isCliente && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Cliente:</span>
                <span className="font-medium">{tarefa.clientes?.nome ?? "—"}</span>
              </div>
            )}
            {!isCliente && (
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Criada por:</span>
                <span className="font-medium">{tarefa.profiles?.nome ?? "—"}</span>
              </div>
            )}
            {!isCliente && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Criada em:</span>
                <span className="font-medium">{fmtDateTime(tarefa.created_at)}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Vencimento:</span>
              <span className="font-medium">{fmtDate(tarefa.prazo)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-3">
        <h2 className="text-lg font-semibold">{isCliente ? "Envie seu criativo" : "Criativos vinculados"}</h2>
        {!isCliente && (
          <p className="text-sm text-muted-foreground">
            {isCriativo
              ? "Tarefas do tipo Criativo aceitam apenas links (URLs)."
              : "Envie e acompanhe os criativos desta tarefa."}
          </p>
        )}
      </div>

      <CriativosSection
        tarefaId={tarefa.id}
        clienteId={tarefa.cliente_id}
        tipoTarefaNome={tarefa.tipos_tarefa?.nome ?? null}
      />

      <TarefaComentarios tarefaId={tarefa.id} />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <EditTarefaDialog
          key={tarefa.id + (editOpen ? "-open" : "-closed")}
          tarefa={tarefa}
          onSubmit={(p) => update.mutate(p)}
          submitting={update.isPending}
        />
      </Dialog>
    </>
  );
}

function EditTarefaDialog({
  tarefa, onSubmit, submitting,
}: {
  tarefa: TarefaDetalhe;
  onSubmit: (p: {
    titulo: string; descricao: string | null;
    status: string; prioridade: string;
    prazo: string | null; funil: string | null;
  }) => void;
  submitting: boolean;
}) {
  const [titulo, setTitulo] = useState(tarefa.titulo);
  const [descricao, setDescricao] = useState(tarefa.descricao ?? "");
  const [status, setStatus] = useState(tarefa.status);
  const [prioridade, setPrioridade] = useState(tarefa.prioridade);
  const [prazo, setPrazo] = useState(tarefa.prazo ?? "");
  const [funil, setFunil] = useState<string>(tarefa.funil ?? "");

  useEffect(() => {
    setTitulo(tarefa.titulo);
    setDescricao(tarefa.descricao ?? "");
    setStatus(tarefa.status);
    setPrioridade(tarefa.prioridade);
    setPrazo(tarefa.prazo ?? "");
    setFunil(tarefa.funil ?? "");
  }, [tarefa]);

  const isCriativo = tarefa.tipos_tarefa?.nome?.toLowerCase() === "criativo";
  const canSubmit = !!titulo && (!isCriativo || !!funil) && !submitting;

  return (
    <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Editar tarefa</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Título *</Label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Descrição</Label>
          <Textarea rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {taskStatusOrder.map((s) => (
                  <SelectItem key={s} value={s}>{taskStatusLabels[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select value={prioridade} onValueChange={setPrioridade}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(taskPriorityLabels).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Prazo</Label>
            <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>
          {isCriativo && (
            <div className="space-y-2">
              <Label>Classificação de funil *</Label>
              <Select value={funil} onValueChange={setFunil}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {funilOrder.map((f) => <SelectItem key={f} value={f}>{funilLabels[f]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={!canSubmit}
          onClick={() => onSubmit({
            titulo,
            descricao: descricao.trim() ? descricao : null,
            status,
            prioridade,
            prazo: prazo || null,
            funil: isCriativo ? funil : null,
          })}
        >
          {submitting ? "Salvando…" : "Salvar alterações"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
