import { useMemo, useState, memo, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { taskStatusLabels, taskStatusOrder, taskPriorityLabels } from "@/lib/labels";
import type { Tarefa, ClienteMini } from "./types";

export type TarefaFilters = {
  search: string;
  status: string;
  prioridade: string;
  cliente: string;
};

const DEFAULT: TarefaFilters = { search: "", status: "all", prioridade: "all", cliente: "all" };

/**
 * Aplica os filtros sem alocar arrays intermediários quando nenhum filtro
 * está ativo (caso comum na primeira renderização).
 */
export function useFilteredTarefas(tarefas: Tarefa[] | undefined, f: TarefaFilters): Tarefa[] {
  return useMemo(() => {
    if (!tarefas?.length) return [];
    const q = f.search.trim().toLowerCase();
    const noFilters =
      !q && f.status === "all" && f.prioridade === "all" && f.cliente === "all";
    if (noFilters) return tarefas;
    return tarefas.filter((t) => {
      if (q && !t.titulo.toLowerCase().includes(q)) return false;
      if (f.status !== "all" && t.status !== f.status) return false;
      if (f.prioridade !== "all" && t.prioridade !== f.prioridade) return false;
      if (f.cliente !== "all" && t.cliente_id !== f.cliente) return false;
      return true;
    });
  }, [tarefas, f.search, f.status, f.prioridade, f.cliente]);
}

export function useTarefaFilters() {
  const [filters, setFilters] = useState<TarefaFilters>(DEFAULT);
  const set = <K extends keyof TarefaFilters>(key: K, value: TarefaFilters[K]) =>
    setFilters((p) => ({ ...p, [key]: value }));
  return { filters, set };
}

export const TarefaFiltersBar = memo(function TarefaFiltersBar({
  filters,
  setFilter,
  clientes,
}: {
  filters: TarefaFilters;
  setFilter: <K extends keyof TarefaFilters>(key: K, value: TarefaFilters[K]) => void;
  clientes: ClienteMini[];
}): ReactNode {
  return (
    <Card className="mb-4">
      <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar título…"
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
          />
        </div>
        <Select value={filters.status} onValueChange={(v) => setFilter("status", v)}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {taskStatusOrder.map((s) => (
              <SelectItem key={s} value={s}>{taskStatusLabels[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.prioridade} onValueChange={(v) => setFilter("prioridade", v)}>
          <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as prioridades</SelectItem>
            {Object.entries(taskPriorityLabels).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.cliente} onValueChange={(v) => setFilter("cliente", v)}>
          <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clientes.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
});
