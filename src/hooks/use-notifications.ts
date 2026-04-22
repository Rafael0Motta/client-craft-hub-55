import { useEffect } from "react";
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

  const query = useQuery({
    queryKey: ["notificacoes", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacoes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Notificacao[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificacoes", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["notificacoes", user.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  const marcarLida = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes", user?.id] }),
  });

  const marcarTodasLidas = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase
        .from("notificacoes")
        .update({ lida: true })
        .eq("user_id", user.id)
        .eq("lida", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes", user?.id] }),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notificacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes", user?.id] }),
  });

  const naoLidas = (query.data ?? []).filter((n) => !n.lida).length;

  return {
    notificacoes: query.data ?? [],
    naoLidas,
    isLoading: query.isLoading,
    marcarLida: marcarLida.mutate,
    marcarTodasLidas: marcarTodasLidas.mutate,
    excluir: excluir.mutate,
  };
}
