import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ExternalLink, FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { taskPriorityLabels, funilLabels, funilOrder } from "@/lib/labels";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useNavigate } from "@tanstack/react-router";
import { adminApi } from "@/lib/admin-api";

export const Route = createFileRoute("/app/clientes/$id")({
  component: ClienteDetailPage,
});

type TipoTarefa = { id: string; nome: string };

function ClienteDetailPage() {
  const { id } = Route.useParams();
  const { role } = useAuth();
  const qc = useQueryClient();

  const navigate = useNavigate();
  const canEditCampanha = role === "admin" || role === "gestor";
  const canEditDetalhes = role === "admin";
  const canCreateTarefa = role === "admin" || role === "gestor";
  const canDelete = role === "admin";

  const [editCampanhaOpen, setEditCampanhaOpen] = useState(false);
  const [editDetalhesOpen, setEditDetalhesOpen] = useState(false);
  const [editGestoresOpen, setEditGestoresOpen] = useState(false);
  const [newTarefaOpen, setNewTarefaOpen] = useState(false);

  // Lista de gestores disponíveis (apenas admin pode editar vínculos)
  const { data: gestoresOptions } = useQuery({
    queryKey: ["gestores-options"],
    enabled: role === "admin",
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "gestor");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [] as Array<{ id: string; nome: string }>;
      const { data } = await supabase.from("profiles").select("id, nome").in("id", ids);
      return (data ?? []) as Array<{ id: string; nome: string }>;
    },
  });

  const updateGestores = useMutation({
    mutationFn: async (gestor_ids: string[]) => {
      await adminApi.call({
        action: "update_cliente_gestores",
        cliente_id: id,
        gestor_ids,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-gestores", id] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setEditGestoresOpen(false);
      toast.success("Gestores atualizados");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const deleteCliente = useMutation({
    mutationFn: async () => {
      await adminApi.call({ action: "delete_cliente", cliente_id: id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Cliente excluído");
      navigate({ to: "/app/clientes" });
    },
    onError: (e: Error) => toast.error("Erro ao excluir", { description: e.message }),
  });

  const { data: cliente } = useQuery({
    queryKey: ["cliente", id],
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  const { data: gestores } = useQuery({
    queryKey: ["cliente-gestores", id],
    queryFn: async () => {
      const { data: links } = await supabase
        .from("cliente_gestores")
        .select("gestor_id")
        .eq("cliente_id", id);
      const ids = (links ?? []).map((l) => l.gestor_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", ids);
      return profs ?? [];
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

  const { data: tipos } = useQuery({
    queryKey: ["tipos-tarefa"],
    enabled: canCreateTarefa,
    queryFn: async () => {
      const { data } = await supabase.from("tipos_tarefa").select("id, nome").order("nome");
      return (data ?? []) as TipoTarefa[];
    },
  });

  const updateCampanha = useMutation({
    mutationFn: async (campanha: string) => {
      const { error } = await supabase.from("clientes").update({ campanha }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente", id] });
      setEditCampanhaOpen(false);
      toast.success("Campanha atualizada");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const updateDetalhes = useMutation({
    mutationFn: async (p: { nome: string; segmento: string | null; drive_folder_url: string | null }) => {
      const { error } = await supabase.from("clientes").update(p).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente", id] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setEditDetalhesOpen(false);
      toast.success("Detalhes atualizados");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const createTarefa = useMutation({
    mutationFn: async (p: {
      titulo: string; descricao: string; prioridade: string; prazo: string | null;
      tipo_tarefa_id: string; funil: string | null;
    }) => {
      const { error } = await supabase.from("tarefas").insert({
        cliente_id: id,
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
      qc.invalidateQueries({ queryKey: ["cliente-tarefas", id] });
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      setNewTarefaOpen(false);
      toast.success("Tarefa criada");
    },
    onError: (e: Error) => toast.error("Erro ao criar", { description: e.message }),
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
        actions={
          <div className="flex items-center gap-2">
            {canCreateTarefa && (
              <Dialog open={newTarefaOpen} onOpenChange={setNewTarefaOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" /> Nova tarefa</Button>
                </DialogTrigger>
                <NewTarefaDialog
                  tipos={tipos ?? []}
                  onSubmit={(p) => createTarefa.mutate(p)}
                  submitting={createTarefa.isPending}
                />
              </Dialog>
            )}
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon" title="Excluir cliente">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação remove o cliente <strong>{cliente.nome}</strong> e todas as tarefas,
                      criativos, versões e comentários vinculados. Não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={deleteCliente.isPending}
                      onClick={() => deleteCliente.mutate()}
                    >
                      {deleteCliente.isPending ? "Excluindo…" : "Excluir"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Campanha</CardTitle>
            {canEditCampanha && (
              <Dialog open={editCampanhaOpen} onOpenChange={setEditCampanhaOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                  </Button>
                </DialogTrigger>
                <EditCampanhaDialog
                  initial={cliente.campanha ?? ""}
                  onSubmit={(v) => updateCampanha.mutate(v)}
                  submitting={updateCampanha.isPending}
                />
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">
              {cliente.campanha || "Sem informações da campanha."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Detalhes</CardTitle>
            {canEditDetalhes && (
              <Dialog open={editDetalhesOpen} onOpenChange={setEditDetalhesOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                  </Button>
                </DialogTrigger>
                <EditDetalhesDialog
                  initial={{
                    nome: cliente.nome,
                    segmento: cliente.segmento ?? "",
                    drive_folder_url: cliente.drive_folder_url ?? "",
                  }}
                  onSubmit={(p) => updateDetalhes.mutate({
                    nome: p.nome,
                    segmento: p.segmento || null,
                    drive_folder_url: p.drive_folder_url || null,
                  })}
                  submitting={updateDetalhes.isPending}
                />
              </Dialog>
            )}
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Gestores</div>
                {role === "admin" && (
                  <Dialog open={editGestoresOpen} onOpenChange={setEditGestoresOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
                        <Pencil className="h-3 w-3 mr-1" /> Editar
                      </Button>
                    </DialogTrigger>
                    <EditGestoresDialog
                      options={gestoresOptions ?? []}
                      initialIds={(gestores ?? []).map((g) => g.id)}
                      onSubmit={(ids) => updateGestores.mutate(ids)}
                      submitting={updateGestores.isPending}
                    />
                  </Dialog>
                )}
              </div>
              {(gestores ?? []).length === 0 ? (
                <div className="font-medium">Não atribuído</div>
              ) : (
                <ul className="font-medium space-y-0.5">
                  {(gestores ?? []).map((g) => (
                    <li key={g.id}>{g.nome}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Segmento</div>
              <div className="font-medium">{cliente.segmento ?? "—"}</div>
            </div>
            {cliente.drive_folder_url && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Pasta Drive</div>
                <a
                  href={cliente.drive_folder_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium break-all"
                >
                  <FolderOpen className="h-4 w-4 shrink-0" /> Abrir pasta
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
            )}
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
                <Link
                  key={t.id}
                  to="/app/tarefas/$id"
                  params={{ id: t.id }}
                  className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/40 transition-colors"
                >
                  <div>
                    <div className="font-medium">{t.titulo}</div>
                    {t.prazo && <div className="text-xs text-muted-foreground">Prazo: {t.prazo}</div>}
                  </div>
                  <StatusBadge status={t.status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function EditCampanhaDialog({
  initial, onSubmit, submitting,
}: {
  initial: string;
  onSubmit: (v: string) => void;
  submitting: boolean;
}) {
  const [campanha, setCampanha] = useState(initial);
  useEffect(() => { setCampanha(initial); }, [initial]);
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Editar campanha</DialogTitle></DialogHeader>
      <div className="space-y-2">
        <Label>Informações da campanha</Label>
        <Textarea
          rows={10}
          value={campanha}
          onChange={(e) => setCampanha(e.target.value)}
          placeholder="Descreva os objetivos, estratégia, públicos, observações…"
        />
      </div>
      <DialogFooter>
        <Button disabled={submitting} onClick={() => onSubmit(campanha)}>
          {submitting ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function EditDetalhesDialog({
  initial, onSubmit, submitting,
}: {
  initial: { nome: string; segmento: string; drive_folder_url: string };
  onSubmit: (p: { nome: string; segmento: string; drive_folder_url: string }) => void;
  submitting: boolean;
}) {
  const [nome, setNome] = useState(initial.nome);
  const [segmento, setSegmento] = useState(initial.segmento);
  const [drive, setDrive] = useState(initial.drive_folder_url);

  useEffect(() => {
    setNome(initial.nome);
    setSegmento(initial.segmento);
    setDrive(initial.drive_folder_url);
  }, [initial.nome, initial.segmento, initial.drive_folder_url]);

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Editar detalhes</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Nome *</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Segmento</Label>
          <Input value={segmento} onChange={(e) => setSegmento(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>URL da pasta no Google Drive</Label>
          <Input
            value={drive}
            onChange={(e) => setDrive(e.target.value)}
            placeholder="https://drive.google.com/drive/..."
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={!nome.trim() || submitting}
          onClick={() => onSubmit({ nome: nome.trim(), segmento: segmento.trim(), drive_folder_url: drive.trim() })}
        >
          {submitting ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function NewTarefaDialog({
  tipos, onSubmit, submitting,
}: {
  tipos: TipoTarefa[];
  onSubmit: (p: {
    titulo: string; descricao: string; prioridade: string; prazo: string | null;
    tipo_tarefa_id: string; funil: string | null;
  }) => void;
  submitting: boolean;
}) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
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

  const canSubmit = !!titulo && !!tipoId && (!isCriativo || !!funil) && !submitting;

  return (
    <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Nova tarefa</DialogTitle></DialogHeader>
      <div className="space-y-4">
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
            titulo, descricao, prioridade,
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

function EditGestoresDialog({
  options, initialIds, onSubmit, submitting,
}: {
  options: Array<{ id: string; nome: string }>;
  initialIds: string[];
  onSubmit: (ids: string[]) => void;
  submitting: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(initialIds);
  useEffect(() => { setSelected(initialIds); }, [initialIds.join(",")]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Editar gestores responsáveis</DialogTitle></DialogHeader>
      <div className="space-y-2">
        <Label>Selecione um ou mais gestores</Label>
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum gestor cadastrado.</p>
        ) : (
          <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
            {options.map((g) => (
              <label key={g.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-accent text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(g.id)}
                  onChange={() => toggle(g.id)}
                />
                <span>{g.nome}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button disabled={submitting} onClick={() => onSubmit(selected)}>
          {submitting ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

