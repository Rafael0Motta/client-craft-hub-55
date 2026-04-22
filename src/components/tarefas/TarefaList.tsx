import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { funilLabels } from "@/lib/labels";
import { fmtDate } from "@/lib/format";
import { Paginacao, usePaginacao } from "@/components/Paginacao";
import type { Tarefa } from "./types";

export const TarefaList = memo(function TarefaList({
  tarefas, canDelete, role, onDelete,
}: {
  tarefas: Tarefa[];
  canDelete: boolean;
  role: string | null;
  onDelete: (t: Tarefa) => void;
}) {
  const { page, setPage, total, totalPages, pageItems, pageSize } = usePaginacao(tarefas);

  if (tarefas.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          Nenhuma tarefa.
        </CardContent>
      </Card>
    );
  }
  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {pageItems.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-4 gap-4 hover:bg-muted/40 transition-colors"
              >
                <Link to="/app/tarefas/$id" params={{ id: t.id }} className="min-w-0 flex-1">
                  <div className="font-medium truncate hover:underline">{t.titulo}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {t.clientes?.nome ?? "—"}
                    {t.tipos_tarefa?.nome ? ` · ${t.tipos_tarefa.nome}` : ""}
                    {t.funil ? ` · ${funilLabels[t.funil]}` : ""}
                    {role !== "cliente" && ` · criada ${fmtDate(t.created_at)}`}
                    {t.prazo ? ` · vence ${fmtDate(t.prazo)}` : ""}
                    {role !== "cliente" && t.profiles?.nome ? ` · por ${t.profiles.nome}` : ""}
                  </div>
                </Link>
                <PriorityBadge priority={t.prioridade} />
                <StatusBadge status={t.status} />
                {canDelete && (
                  <Button size="sm" variant="ghost" onClick={() => onDelete(t)} aria-label="Excluir tarefa">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Paginacao page={page} totalPages={totalPages} total={total} pageSize={pageSize} onChange={setPage} />
    </>
  );
});
