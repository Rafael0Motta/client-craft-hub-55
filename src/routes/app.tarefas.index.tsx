import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { taskStatusLabels, taskStatusOrder, taskPriorityLabels, funilLabels, funilOrder } from "@/lib/labels";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { Plus, Calendar, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/app/tarefas/")({
  component: TarefasPage,
});

type TipoTarefa = { id: string; nome: string };

type Tarefa = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  prioridade: string;
  prazo: string | null;
  created_at: string;
  criado_por: string | null;
  cliente_id: string;
  tipo_tarefa_id: string | null;
  funil: string | null;
  clientes: { nome: string } | null;
  tipos_tarefa: { nome: string } | null;
  profiles?: { nome: string } | null;
};

function TarefasPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>("all");
  const [prioridadeFiltro, setPrioridadeFiltro] = useState<string>("all");
  const [clienteFiltro, setClienteFiltro] = useState<string>("all");
  const [confirmDelete, setConfirmDelete] = useState<Tarefa | null>(null);

  const { data: tarefas, isLoading } = useQuery({
    queryKey: ["tarefas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tarefas")
        .select("id, titulo, descricao, status, prioridade, prazo, created_at, criado_por, cliente_id, tipo_tarefa_id, funil, clientes(nome), tipos_tarefa(nome)")
        .order("created_at", { ascending: false });
      const list = (data ?? []) as unknown as Tarefa[];
      const ids = Array.from(new Set(list.map((t) => t.criado_por).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", ids);
        const map = new Map((profs ?? []).map((p) => [p.id, p.nome]));
        list.forEach((t) => { t.profiles = t.criado_por ? { nome: map.get(t.criado_por) ?? "—" } : null; });
      }
      return list;
    },
  });

  const { data: clientes } = useQuery({
    queryKey: ["clientes-mini"],
    enabled: role === "admin" || role === "gestor",
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("id, nome").order("nome");
      return data ?? [];
    },
  });

  const { data: tipos } = useQuery({
    queryKey: ["tipos-tarefa"],
    queryFn: async () => {
      const { data } = await supabase.from("tipos_tarefa").select("id, nome").order("nome");
      return (data ?? []) as TipoTarefa[];
    },
  });

  const clientesParaFiltro = useMemo(() => {
    if (clientes && clientes.length) return clientes;
    const map = new Map<string, string>();
    (tarefas ?? []).forEach((t) => t.clientes && map.set(t.cliente_id, t.clientes.nome));
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  }, [clientes, tarefas]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tarefas ?? []).filter((t) => {
      if (q && !t.titulo.toLowerCase().includes(q)) return false;
      if (statusFiltro !== "all" && t.status !== statusFiltro) return false;
      if (prioridadeFiltro !== "all" && t.prioridade !== prioridadeFiltro) return false;
      if (clienteFiltro !== "all" && t.cliente_id !== clienteFiltro) return false;
      return true;
    });
  }, [tarefas, search, statusFiltro, prioridadeFiltro, clienteFiltro]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("tarefas").update({ status: status as never }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tarefas"] }),
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const deleteTarefa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tarefas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      qc.invalidateQueries({ queryKey: ["criativos"] });
      toast.success("Tarefa excluída (criativos vinculados também removidos)");
    },
    onError: (e: Error) => toast.error("Erro ao excluir", { description: e.message }),
  });

  const create = useMutation({
    mutationFn: async (p: {
      cliente_id: string; titulo: string; descricao: string;
      prioridade: string; prazo: string | null;
      tipo_tarefa_id: string; funil: string | null;
    }) => {
      const { error } = await supabase.from("tarefas").insert({
        cliente_id: p.cliente_id,
        titulo: p.titulo,
        descricao: p.descricao,
        prioridade: p.prioridade as never,
        prazo: p.prazo,
        tipo_tarefa_id: p.tipo_tarefa_id,
        funil: p.funil as never,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      setOpen(false);
      toast.success("Tarefa criada");
    },
    onError: (e: Error) => toast.error("Erro ao criar", { description: e.message }),
  });

  const canCreate = role === "admin" || role === "gestor";
  const canDelete = role === "admin" || role === "gestor";

  return (
    <>
      <PageHeader
        title="Tarefas"
        description="Acompanhe o que está em andamento e o que precisa de atenção."
        actions={
          canCreate ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Nova tarefa</Button>
              </DialogTrigger>
              <NewTarefaDialog
                clientes={clientes ?? []}
                tipos={tipos ?? []}
                onSubmit={(p) => create.mutate(p)}
                submitting={create.isPending}
              />
            </Dialog>
          ) : null
        }
      />

      <Card className="mb-4">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar título…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFiltro} onValueChange={setStatusFiltro}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {taskStatusOrder.map((s) => <SelectItem key={s} value={s}>{taskStatusLabels[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={prioridadeFiltro} onValueChange={setPrioridadeFiltro}>
            <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as prioridades</SelectItem>
              {Object.entries(taskPriorityLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={clienteFiltro} onValueChange={setClienteFiltro}>
            <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clientesParaFiltro.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="lista">Lista</TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {taskStatusOrder.map((status) => {
                const items = filtered.filter((t) => t.status === status);
                return (
                  <div key={status} className="bg-muted/40 rounded-lg p-3 min-h-[200px]">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <h3 className="text-sm font-semibold">{taskStatusLabels[status]}</h3>
                      <span className="text-xs text-muted-foreground">{items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {items.map((t) => (
                        <Card key={t.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <Link
                                to="/app/tarefas/$id"
                                params={{ id: t.id }}
                                className="font-medium text-sm leading-tight hover:underline flex-1 min-w-0"
                              >
                                {t.titulo}
                              </Link>
                              {canDelete && (
                                <button
                                  onClick={(e) => { e.preventDefault(); setConfirmDelete(t); }}
                                  className="text-muted-foreground hover:text-destructive shrink-0"
                                  title="Excluir tarefa"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{t.clientes?.nome ?? "—"}</div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {t.tipos_tarefa?.nome && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold uppercase tracking-wider">
                                  {t.tipos_tarefa.nome}
                                </span>
                              )}
                              {t.funil && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground font-semibold uppercase tracking-wider">
                                  {funilLabels[t.funil]}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <PriorityBadge priority={t.prioridade} />
                              {t.prazo && (
                                <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Vence {format(new Date(t.prazo), "dd/MM/yyyy")}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t">
                              <div>Criada em {format(new Date(t.created_at), "dd/MM/yyyy")}</div>
                              <div>Por {t.profiles?.nome ?? "—"}</div>
                            </div>
                            {(role === "admin" || role === "gestor") && (
                              <Select value={t.status} onValueChange={(v) => updateStatus.mutate({ id: t.id, status: v })}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {taskStatusOrder.map((s) => (
                                    <SelectItem key={s} value={s}>{taskStatusLabels[s]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="lista" className="mt-6">
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filtered.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-4 gap-4 hover:bg-muted/40 transition-colors">
                      <Link to="/app/tarefas/$id" params={{ id: t.id }} className="min-w-0 flex-1">
                        <div className="font-medium truncate hover:underline">{t.titulo}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {t.clientes?.nome ?? "—"}
                          {t.tipos_tarefa?.nome ? ` · ${t.tipos_tarefa.nome}` : ""}
                          {t.funil ? ` · ${funilLabels[t.funil]}` : ""}
                          {` · criada ${format(new Date(t.created_at), "dd/MM/yyyy")}`}
                          {t.prazo ? ` · vence ${format(new Date(t.prazo), "dd/MM/yyyy")}` : ""}
                          {t.profiles?.nome ? ` · por ${t.profiles.nome}` : ""}
                        </div>
                      </Link>
                      <PriorityBadge priority={t.prioridade} />
                      <StatusBadge status={t.status} />
                      {canDelete && (
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(t)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {filtered.length === 0 && (
                    <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma tarefa.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá a tarefa <strong>{confirmDelete?.titulo}</strong> e <strong>todos os criativos vinculados</strong> (incluindo versões e comentários). Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) deleteTarefa.mutate(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function NewTarefaDialog({
  clientes, tipos, onSubmit, submitting,
}: {
  clientes: Array<{ id: string; nome: string }>;
  tipos: TipoTarefa[];
  onSubmit: (p: {
    cliente_id: string; titulo: string; descricao: string;
    prioridade: string; prazo: string | null;
    tipo_tarefa_id: string; funil: string | null;
  }) => void;
  submitting: boolean;
}) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [prioridade, setPrioridade] = useState("media");
  const [prazo, setPrazo] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [funil, setFunil] = useState<string>("");
  const [showNovoTipo, setShowNovoTipo] = useState(false);
  const [novoTipoNome, setNovoTipoNome] = useState("");

  const tipoSelecionado = tipos.find((t) => t.id === tipoId);
  const isCriativo = tipoSelecionado?.nome.toLowerCase() === "criativo";

  const criarTipo = useMutation({
    mutationFn: async (nome: string) => {
      const { data, error } = await supabase
        .from("tipos_tarefa")
        .insert({ nome } as never)
        .select("id, nome")
        .single();
      if (error) throw error;
      return data as TipoTarefa;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tipos-tarefa"] });
      setTipoId(data.id);
      setShowNovoTipo(false);
      setNovoTipoNome("");
      toast.success(`Tipo "${data.nome}" criado`);
    },
    onError: (e: Error) => toast.error("Erro ao criar tipo", { description: e.message }),
  });

  const canSubmit =
    !!titulo && !!clienteId && !!tipoId && (!isCriativo || !!funil) && !submitting;

  return (
    <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Nova tarefa</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Cliente *</Label>
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Tipo de tarefa *</Label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowNovoTipo((s) => !s)}>
              <Plus className="h-3 w-3 mr-1" /> Novo tipo
            </Button>
          </div>
          <Select value={tipoId} onValueChange={(v) => { setTipoId(v); setFunil(""); }}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {tipos.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          {showNovoTipo && (
            <div className="flex gap-2">
              <Input
                placeholder="Nome do novo tipo"
                value={novoTipoNome}
                onChange={(e) => setNovoTipoNome(e.target.value)}
              />
              <Button
                type="button"
                disabled={!novoTipoNome.trim() || criarTipo.isPending}
                onClick={() => criarTipo.mutate(novoTipoNome.trim())}
              >
                Salvar
              </Button>
            </div>
          )}
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

        <div className="space-y-2">
          <Label>Título *</Label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Descrição</Label>
          <Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
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
          <div className="space-y-2">
            <Label>Prazo</Label>
            <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={!canSubmit}
          onClick={() => onSubmit({
            cliente_id: clienteId, titulo, descricao, prioridade,
            prazo: prazo || null,
            tipo_tarefa_id: tipoId,
            funil: isCriativo ? funil : null,
          })}
        >
          {submitting ? "Salvando…" : "Criar tarefa"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
