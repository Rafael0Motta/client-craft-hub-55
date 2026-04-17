import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { taskStatusLabels, taskStatusOrder, taskPriorityLabels } from "@/lib/labels";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { Plus, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/app/tarefas/")({
  component: TarefasPage,
});

type Tarefa = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  prioridade: string;
  prazo: string | null;
  cliente_id: string;
  clientes: { nome: string } | null;
};

function TarefasPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: tarefas, isLoading } = useQuery({
    queryKey: ["tarefas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tarefas")
        .select("id, titulo, descricao, status, prioridade, prazo, cliente_id, clientes(nome)")
        .order("created_at", { ascending: false });
      return (data ?? []) as Tarefa[];
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

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("tarefas").update({ status: status as never }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tarefas"] }),
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const create = useMutation({
    mutationFn: async (p: {
      cliente_id: string; titulo: string; descricao: string;
      prioridade: string; prazo: string | null;
    }) => {
      const { error } = await supabase.from("tarefas").insert({
        cliente_id: p.cliente_id,
        titulo: p.titulo,
        descricao: p.descricao,
        prioridade: p.prioridade as never,
        prazo: p.prazo,
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
                onSubmit={(p) => create.mutate(p)}
                submitting={create.isPending}
              />
            </Dialog>
          ) : null
        }
      />

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
                const items = (tarefas ?? []).filter((t) => t.status === status);
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
                            <div className="font-medium text-sm leading-tight">{t.titulo}</div>
                            <div className="text-xs text-muted-foreground">{t.clientes?.nome ?? "—"}</div>
                            <div className="flex items-center justify-between">
                              <PriorityBadge priority={t.prioridade} />
                              {t.prazo && (
                                <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(t.prazo), "dd/MM")}
                                </span>
                              )}
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
                  {(tarefas ?? []).map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-4 gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{t.titulo}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {t.clientes?.nome ?? "—"} {t.prazo ? `· prazo ${t.prazo}` : ""}
                        </div>
                      </div>
                      <PriorityBadge priority={t.prioridade} />
                      <StatusBadge status={t.status} />
                    </div>
                  ))}
                  {(tarefas ?? []).length === 0 && (
                    <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma tarefa.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}

function NewTarefaDialog({
  clientes, onSubmit, submitting,
}: {
  clientes: Array<{ id: string; nome: string }>;
  onSubmit: (p: { cliente_id: string; titulo: string; descricao: string; prioridade: string; prazo: string | null }) => void;
  submitting: boolean;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [prioridade, setPrioridade] = useState("media");
  const [prazo, setPrazo] = useState("");

  return (
    <DialogContent>
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
          disabled={!titulo || !clienteId || submitting}
          onClick={() => onSubmit({
            cliente_id: clienteId, titulo, descricao, prioridade,
            prazo: prazo || null,
          })}
        >
          {submitting ? "Salvando…" : "Criar tarefa"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
