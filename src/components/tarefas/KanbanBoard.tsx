import { useMemo, useState, type ReactNode } from "react";
import {
  DndContext, type DragEndEvent, type DragStartEvent, DragOverlay,
  PointerSensor, useSensor, useSensors, useDroppable,
} from "@dnd-kit/core";
import { taskStatusLabels, taskStatusOrder } from "@/lib/labels";
import { KanbanCard, KanbanCardOverlay } from "./KanbanCard";
import type { Tarefa } from "./types";

function KanbanColumn({
  status, count, children,
}: { status: string; count: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`bg-muted/40 rounded-lg p-3 min-h-[200px] transition-colors ${
        isOver ? "bg-primary/10 ring-2 ring-primary/40" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-semibold">{taskStatusLabels[status]}</h3>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function KanbanBoard({
  tarefas, canDrag, canDelete, role, onMove, onDelete,
}: {
  tarefas: Tarefa[];
  canDrag: boolean;
  canDelete: boolean;
  role: string | null;
  onMove: (id: string, status: string) => void;
  onDelete: (t: Tarefa) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  // PointerSensor com distance:5 evita iniciar drag em cliques de link.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Agrupa em uma única passada (O(n)) em vez de filter por coluna (O(n*m)).
  const groups = useMemo(() => {
    const map: Record<string, Tarefa[]> = {};
    for (const s of taskStatusOrder) map[s] = [];
    for (const t of tarefas) {
      if (map[t.status]) map[t.status].push(t);
    }
    return map;
  }, [tarefas]);

  const activeTarefa = activeId ? tarefas.find((t) => t.id === activeId) ?? null : null;

  const onStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const id = String(active.id);
    const newStatus = String(over.id);
    const t = tarefas.find((x) => x.id === id);
    if (t && t.status !== newStatus) onMove(id, newStatus);
  };

  return (
    <DndContext sensors={sensors} onDragStart={onStart} onDragEnd={onEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {taskStatusOrder.map((status) => {
          const items = groups[status];
          return (
            <KanbanColumn key={status} status={status} count={items.length}>
              {items.map((t) => (
                <KanbanCard
                  key={t.id}
                  tarefa={t}
                  canDrag={canDrag}
                  canDelete={canDelete}
                  role={role}
                  onDelete={onDelete}
                />
              ))}
              {items.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded">
                  Solte aqui
                </div>
              )}
            </KanbanColumn>
          );
        })}
      </div>
      <DragOverlay>
        {activeTarefa ? (
          <div className="opacity-90 rotate-2">
            <KanbanCardOverlay tarefa={activeTarefa} role={role} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
