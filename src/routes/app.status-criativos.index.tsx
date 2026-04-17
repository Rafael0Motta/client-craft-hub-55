import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/RequireAuth";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  creativeOpStatusLabels, creativeOpStatusOrder, opStatusBadgeClass,
} from "@/lib/labels";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { Search, Link as LinkIcon, FileIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/status-criativos/")({
  component: () => (
    <RequireAuth allow={["admin", "gestor"]}>
      <StatusCriativosPage />
    </RequireAuth>
  ),
});

type Row = {
  id: string;
  arquivo_nome: string;
  arquivo_tipo: string | null;
  link_url: string | null;
  status: string;
  status_operacional: string;
  created_at: string;
  clientes: { nome: string } | null;
  tarefas: { titulo: string } | null;
};

function StatusCriativosPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [opFiltro, setOpFiltro] = useState<string>("all");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["status-criativos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("criativos")
        .select("id, arquivo_nome, arquivo_tipo, link_url, status, status_operacional, created_at, clientes(nome), tarefas(titulo)")
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as Row[];
    },
  });

  const updateOp = useMutation({
    mutationFn: async ({ id, status_operacional }: { id: string; status_operacional: string }) => {
      const { error } = await supabase
        .from("criativos")
        .update({ status_operacional: status_operacional as never })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["status-criativos"] });
      qc.invalidateQueries({ queryKey: ["criativos"] });
      toast.success("Status operacional atualizado");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (opFiltro !== "all" && r.status_operacional !== opFiltro) return false;
      if (!q) return true;
      return r.arquivo_nome.toLowerCase().includes(q)
        || r.clientes?.nome.toLowerCase().includes(q)
        || r.tarefas?.titulo.toLowerCase().includes(q);
    });
  }, [rows, search, opFiltro]);

  return (
    <>
      <PageHeader
        title="Status de criativos"
        description="Controle operacional: defina quais criativos estão Ativos, em Standby ou Desativados."
      />

      <Card className="mb-4">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome, cliente ou tarefa…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={opFiltro} onValueChange={setOpFiltro}>
            <SelectTrigger><SelectValue placeholder="Status operacional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {creativeOpStatusOrder.map((s) => (
                <SelectItem key={s} value={s}>{creativeOpStatusLabels[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filtered.map((r) => {
                const isLink = !!r.link_url;
                return (
                  <div key={r.id} className="p-4 flex items-center gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-md bg-muted flex items-center justify-center">
                      {isLink
                        ? <LinkIcon className="h-4 w-4 text-muted-foreground" />
                        : <FileIcon className="h-4 w-4 text-muted-foreground" />
                      }
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link to="/app/tarefas" className="font-medium truncate hover:underline block">
                        {r.arquivo_nome}
                      </Link>
                      <div className="text-xs text-muted-foreground truncate">
                        {r.clientes?.nome ?? "—"}
                        {r.tarefas?.titulo ? ` · ${r.tarefas.titulo}` : ""}
                      </div>
                    </div>
                    <Badge variant="outline" className={cn("font-medium", opStatusBadgeClass(r.status_operacional))}>
                      {creativeOpStatusLabels[r.status_operacional]}
                    </Badge>
                    <StatusBadge status={r.status} kind="creative" />
                    <Select
                      value={r.status_operacional}
                      onValueChange={(v) => updateOp.mutate({ id: r.id, status_operacional: v })}
                    >
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {creativeOpStatusOrder.map((s) => (
                          <SelectItem key={s} value={s}>{creativeOpStatusLabels[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  Nenhum criativo encontrado.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
