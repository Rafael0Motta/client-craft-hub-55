import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to realtime changes on the `tarefas` table and invalidates
 * all related React Query caches so any open screen reflects the change
 * immediately (lista, dashboard, detalhe, criativos).
 */
export function useTarefasRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("tarefas-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tarefas" },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["tarefas"] });
          qc.invalidateQueries({ queryKey: ["dashboard"] });
          qc.invalidateQueries({ queryKey: ["criativos"] });
          const row = (payload.new ?? payload.old) as { id?: string } | null;
          if (row?.id) {
            qc.invalidateQueries({ queryKey: ["tarefa", row.id] });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
