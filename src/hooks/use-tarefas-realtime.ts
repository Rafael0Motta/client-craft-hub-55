import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to realtime changes on the `tarefas` table and invalidates
 * the related React Query caches. Uses a small debounce window so a burst
 * of updates only triggers a single refetch cycle.
 */
export function useTarefasRealtime() {
  const qc = useQueryClient();
  const pendingIds = useRef<Set<string>>(new Set());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const flush = () => {
      flushTimer.current = null;
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      const ids = Array.from(pendingIds.current);
      pendingIds.current.clear();
      for (const id of ids) {
        qc.invalidateQueries({ queryKey: ["tarefa", id] });
      }
    };

    const channel = supabase
      .channel(`tarefas-realtime-${Math.random().toString(36).slice(2, 10)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tarefas" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { id?: string } | null;
          if (row?.id) pendingIds.current.add(row.id);
          if (flushTimer.current === null) {
            flushTimer.current = setTimeout(flush, 250);
          }
        },
      )
      .subscribe();

    return () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
