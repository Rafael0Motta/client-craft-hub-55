import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { KanbanBoard } from "@/components/tarefas/KanbanBoard";
import { TarefaList } from "@/components/tarefas/TarefaList";
import { NewTarefaDialog } from "@/components/tarefas/NewTarefaDialog";
import {
  TarefaFiltersBar, useFilteredTarefas, useTarefaFilters,
} from "@/components/tarefas/TarefaFilters";
import type { Tarefa, TipoTarefa } from "@/components/tarefas/types";

export const Route = createFileRoute("/app/tarefas/")({
  component: TarefasPage,
});

function TarefasPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Tarefa | null>(null);
  const { filters, set: setFilter } = useTarefaFilters();

  // Lista principal: faz select específico (sem `*`) e enriquece com profiles em
  // uma única query separada (evita N+1).
  const { data: tarefas, isLoading } = useQuery({
    queryKey: ["tarefas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select(
          "id, titulo, descricao, status, prioridade, prazo, created_at, criado_por, cliente_id, tipo_tarefa_id, funil, clientes(nome), tipos_tarefa(nome)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = (data ?? []) as unknown as Tarefa[];
      const ids = Array.from(
        new Set(list.map((t) => t.criado_por).filter((v): v is string => !!v)),
      );
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", ids);
        const map = new Map((profs ?? []).map((p) => [p.id, p.nome]));
        for (const t of list) {
          t.profiles = t.criado_por ? { nome: map.get(t.criado_por) ?? "—" } : null;
        }
      }
      return list;
    },
  });

  const isManager = role === "admin" || role === "gestor";

  const { data: clientes } = useQuery({
    queryKey: ["clientes-mini"],
    enabled: isManager,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tipos } = useQuery({
    queryKey: ["tipos-tarefa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_tarefa")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as TipoTarefa[];
    },
  });

  // Para clientes/role=cliente o select acima vem vazio; deriva da própria
  // listagem para popular o dropdown do filtro.
  const clientesParaFiltro = clientes?.length
    ? clientes
    : Array.from(
        new Map(
          (tarefas ?? [])
            .filter((t) => t.clientes)
            .map((t) => [t.cliente_id, t.clientes!.nome]),
        ).entries(),
      ).map(([id, nome]) => ({ id, nome }));

  const filtered = useFilteredTarefas(tarefas, filters);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("tarefas")
        .update({ status: status as never })
        .eq("id", id);
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
      toast.success("Tarefa excluída");
    },
    onError: (e: Error) => toast.error("Erro ao excluir", { description: e.message }),
  });

  const create = useMutation({
    mutationFn: async (p: import("@/lib/validators").TarefaCreateInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("tarefas").insert({
        cliente_id: p.cliente_id,
        titulo: p.titulo,
        descricao: p.descricao ?? null,
        prioridade: p.prioridade as never,
        prazo: p.prazo ?? null,
        tipo_tarefa_id: p.tipo_tarefa_id,
        funil: (p.funil ?? null) as never,
        criado_por: user?.id ?? null,
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

  const onMove = useCallback(
    (id: string, status: string) => updateStatus.mutate({ id, status }),
    [updateStatus],
  );
  const onDeleteRequest = useCallback((t: Tarefa) => setConfirmDelete(t), []);

  return (
    <>
      <PageHeader
        title="Tarefas"
        description="Acompanhe o que está em andamento e o que precisa de atenção."
        actions={
          isManager ? (
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

      <TarefaFiltersBar filters={filters} setFilter={setFilter} clientes={clientesParaFiltro} showClienteFilter={role !== "cliente"} />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="lista">Lista</TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="mt-6">
            <KanbanBoard
              tarefas={filtered}
              canDrag={isManager}
              canDelete={isManager}
              role={role}
              onMove={onMove}
              onDelete={onDeleteRequest}
            />
          </TabsContent>

          <TabsContent value="lista" className="mt-6">
            <TarefaList
              tarefas={filtered}
              canDelete={isManager}
              role={role}
              onDelete={onDeleteRequest}
            />
          </TabsContent>
        </Tabs>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá a tarefa <strong>{confirmDelete?.titulo}</strong> e
              <strong> todos os criativos vinculados</strong> (incluindo versões e comentários).
              Não pode ser desfeita.
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
