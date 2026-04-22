import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { Calendar, GripVertical, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useDraggable } from "@dnd-kit/core";
import { PriorityBadge } from "@/components/StatusBadge";
import { funilLabels } from "@/lib/labels";
import { fmtDate } from "@/lib/format";
import type { Tarefa } from "./types";

function CardBody({ tarefa, role }: { tarefa: Tarefa; role: string | null }) {
  return (
    <>
      <div className="text-xs text-muted-foreground">{tarefa.clientes?.nome ?? "—"}</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {tarefa.tipos_tarefa?.nome && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold uppercase tracking-wider">
            {tarefa.tipos_tarefa.nome}
          </span>
        )}
        {tarefa.funil && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground font-semibold uppercase tracking-wider">
            {funilLabels[tarefa.funil]}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <PriorityBadge priority={tarefa.prioridade} />
        {tarefa.prazo && (
          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Vence {fmtDate(tarefa.prazo)}
          </span>
        )}
      </div>
      {role !== "cliente" && (
        <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t">
          <div>Criada em {fmtDate(tarefa.created_at)}</div>
          <div>Por {tarefa.profiles?.nome ?? "—"}</div>
        </div>
      )}
    </>
  );
}

export const KanbanCardOverlay = memo(function KanbanCardOverlay({
  tarefa,
  role,
}: {
  tarefa: Tarefa;
  role: string | null;
}) {
  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="font-medium text-sm leading-tight">{tarefa.titulo}</div>
        <CardBody tarefa={tarefa} role={role} />
      </CardContent>
    </Card>
  );
});

export const KanbanCard = memo(function KanbanCard({
  tarefa, canDrag, canDelete, role, onDelete,
}: {
  tarefa: Tarefa;
  canDrag: boolean;
  canDelete: boolean;
  role: string | null;
  onDelete: (t: Tarefa) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: tarefa.id,
    disabled: !canDrag,
  });

  return (
    <Card
      ref={setNodeRef}
      className={`hover:shadow-md transition-shadow ${isDragging ? "opacity-30" : ""}`}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          {canDrag && (
            <button
              {...attributes}
              {...listeners}
              className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0 mt-0.5"
              title="Arrastar"
              aria-label="Arrastar tarefa"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          <Link
            to="/app/tarefas/$id"
            params={{ id: tarefa.id }}
            className="font-medium text-sm leading-tight hover:underline flex-1 min-w-0"
          >
            {tarefa.titulo}
          </Link>
          {canDelete && (
            <button
              onClick={(e) => { e.preventDefault(); onDelete(tarefa); }}
              className="text-muted-foreground hover:text-destructive shrink-0"
              title="Excluir tarefa"
              aria-label="Excluir tarefa"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <CardBody tarefa={tarefa} role={role} />
      </CardContent>
    </Card>
  );
});
