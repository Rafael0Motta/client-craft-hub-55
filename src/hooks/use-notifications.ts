import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type Notificacao = {
  id: string;
  user_id: string;
  tipo: string;
  titulo: string;
  mensagem: string | null;
  link: string | null;
  tarefa_id: string | null;
  criativo_id: string | null;
  lida: boolean;
  created_at: string;
};

export function useNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userId = user?.id;
  const queryKey = ["notificacoes", userId] as const;

  const query = useQuery({
    queryKey,
    enabled: !!userId,
    // Limita a 50 por query e usa o índice (user_id, created_at DESC).
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacoes")
        .select("id, user_id, tipo, titulo, mensagem, link, tarefa_id, criativo_id, lida, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Notificacao[];
    },
    staleTime: 30_000,
  });

  // Realtime com debounce — bursts de eventos só causam um refetch.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notif-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificacoes", filter: `user_id=eq.${userId}` },
        () => {
          if (flushTimer.current) return;
          flushTimer.current = setTimeout(() => {
            flushTimer.current = null;
            qc.invalidateQueries({ queryKey });
          }, 500);
        },
      )
      .subscribe();
    return () => {
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
      supabase.removeChannel(channel);
    };
    // queryKey é estável por userId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, qc]);

  const marcarLida = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const marcarTodasLidas = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { error } = await supabase
        .from("notificacoes")
        .update({ lida: true })
        .eq("user_id", userId)
        .eq("lida", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notificacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  // Calcula localmente sem .filter() em todo render — usa for-loop.
  const all = query.data ?? [];
  let naoLidas = 0;
  for (const n of all) if (!n.lida) naoLidas++;

  return {
    notificacoes: all,
    naoLidas,
    isLoading: query.isLoading,
    marcarLida: marcarLida.mutate,
    marcarTodasLidas: marcarTodasLidas.mutate,
    excluir: excluir.mutate,
  };
}
