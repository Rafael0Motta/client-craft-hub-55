import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Trash2, Send, X, Check } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { taskStatusLabels } from "@/lib/labels";

type Comentario = {
  id: string;
  tarefa_id: string;
  autor_id: string | null;
  texto: string;
  created_at: string;
  updated_at: string;
};

type Atividade = {
  id: string;
  tarefa_id: string;
  ator_id: string | null;
  tipo: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

type ProfileMap = Record<string, string>;

function fmtDateTime(iso: string) {
  return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

function describeActivity(a: Atividade, profileMap: ProfileMap): string {
  const ator = a.ator_id ? profileMap[a.ator_id] ?? "Alguém" : "Sistema";
  const m = a.metadata || {};
  switch (a.tipo) {
    case "tarefa_criada":
      return `${ator} criou esta tarefa`;
    case "tarefa_status_alterado": {
      const de = taskStatusLabels[String(m.de)] ?? String(m.de);
      const para = taskStatusLabels[String(m.para)] ?? String(m.para);
      return `${ator} alterou o status: ${de} → ${para}`;
    }
    case "criativo_enviado":
      return `${ator} enviou um criativo${m.arquivo_nome ? `: ${m.arquivo_nome}` : ""}`;
    case "criativo_aprovado":
      return `${ator} aprovou o criativo${m.arquivo_nome ? `: ${m.arquivo_nome}` : ""}`;
    case "criativo_reprovado":
      return `${ator} reprovou o criativo${m.arquivo_nome ? `: ${m.arquivo_nome}` : ""}`;
    case "comentario_adicionado":
      return `${ator} comentou`;
    default:
      return `${ator} — ${a.tipo}`;
  }
}

export function TarefaComentarios({ tarefaId }: { tarefaId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [novo, setNovo] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [textoEdit, setTextoEdit] = useState("");

  const { data: comentarios = [] } = useQuery({
    queryKey: ["tarefa-comentarios", tarefaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefa_comentarios")
        .select("*")
        .eq("tarefa_id", tarefaId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Comentario[];
    },
  });

  const { data: atividades = [] } = useQuery({
    queryKey: ["tarefa-atividades", tarefaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefa_atividades")
        .select("*")
        .eq("tarefa_id", tarefaId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Atividade[];
    },
  });

  // Profiles map (autores e atores)
  const userIds = Array.from(
    new Set([
      ...comentarios.map((c) => c.autor_id).filter(Boolean) as string[],
      ...atividades.map((a) => a.ator_id).filter(Boolean) as string[],
    ]),
  );

  const { data: profileMap = {} } = useQuery({
    queryKey: ["profiles-map", userIds.sort().join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome").in("id", userIds);
      const map: ProfileMap = {};
      (data ?? []).forEach((p) => { map[p.id] = p.nome; });
      return map;
    },
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`tarefa-collab-${tarefaId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tarefa_comentarios", filter: `tarefa_id=eq.${tarefaId}` },
        () => qc.invalidateQueries({ queryKey: ["tarefa-comentarios", tarefaId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tarefa_atividades", filter: `tarefa_id=eq.${tarefaId}` },
        () => qc.invalidateQueries({ queryKey: ["tarefa-atividades", tarefaId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tarefaId, qc]);

  const addComment = useMutation({
    mutationFn: async (texto: string) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("tarefa_comentarios").insert({
        tarefa_id: tarefaId,
        autor_id: user.id,
        texto,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNovo("");
      qc.invalidateQueries({ queryKey: ["tarefa-comentarios", tarefaId] });
      qc.invalidateQueries({ queryKey: ["tarefa-atividades", tarefaId] });
    },
    onError: (e: Error) => toast.error("Erro ao comentar", { description: e.message }),
  });

  const editComment = useMutation({
    mutationFn: async (p: { id: string; texto: string }) => {
      const { error } = await supabase
        .from("tarefa_comentarios")
        .update({ texto: p.texto })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditandoId(null);
      qc.invalidateQueries({ queryKey: ["tarefa-comentarios", tarefaId] });
    },
    onError: (e: Error) => toast.error("Erro ao editar", { description: e.message }),
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tarefa_comentarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tarefa-comentarios", tarefaId] });
      toast.success("Comentário excluído");
    },
    onError: (e: Error) => toast.error("Erro ao excluir", { description: e.message }),
  });

  // Combine comments + activities into a single timeline
  type FeedItem =
    | { kind: "comment"; date: string; data: Comentario }
    | { kind: "activity"; date: string; data: Atividade };

  const feed: FeedItem[] = [
    ...comentarios.map((c) => ({ kind: "comment" as const, date: c.created_at, data: c })),
    ...atividades
      .filter((a) => a.tipo !== "comentario_adicionado") // já temos o comentário em si
      .map((a) => ({ kind: "activity" as const, date: a.created_at, data: a })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Card className="mt-6">
      <CardContent className="p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Comentários e atividades</h2>
          <p className="text-xs text-muted-foreground">
            Histórico em tempo real desta tarefa.
          </p>
        </div>

        <div className="space-y-3">
          {feed.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6">
              Nenhuma atividade ainda. Seja o primeiro a comentar.
            </div>
          )}

          {feed.map((item) => {
            if (item.kind === "activity") {
              const a = item.data;
              return (
                <div key={"a-" + a.id} className="flex gap-3 text-xs text-muted-foreground items-start">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/40 mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <span>{describeActivity(a, profileMap)}</span>
                    <span className="ml-2 text-[10px] opacity-70">{fmtDateTime(a.created_at)}</span>
                  </div>
                </div>
              );
            }

            const c = item.data;
            const isAuthor = user?.id === c.autor_id;
            const isEditando = editandoId === c.id;
            const autorNome = c.autor_id ? profileMap[c.autor_id] ?? "—" : "—";

            return (
              <div key={"c-" + c.id} className="flex gap-3 group">
                <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {autorNome.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold">{autorNome}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {fmtDateTime(c.created_at)}
                      {c.updated_at !== c.created_at && " · editado"}
                    </span>
                  </div>

                  {isEditando ? (
                    <div className="space-y-2">
                      <Textarea
                        rows={2}
                        value={textoEdit}
                        onChange={(e) => setTextoEdit(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => editComment.mutate({ id: c.id, texto: textoEdit })}
                          disabled={!textoEdit.trim() || editComment.isPending}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" /> Salvar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditandoId(null)}>
                          <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm whitespace-pre-wrap break-words flex-1">{c.texto}</p>
                      {isAuthor && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => { setEditandoId(c.id); setTextoEdit(c.texto); }}
                            className="text-muted-foreground hover:text-primary"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Excluir este comentário?")) deleteComment.mutate(c.id);
                            }}
                            className="text-muted-foreground hover:text-destructive"
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t pt-4 space-y-2">
          <Textarea
            rows={2}
            placeholder="Escreva um comentário…"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && novo.trim()) {
                addComment.mutate(novo.trim());
              }
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Ctrl/⌘ + Enter para enviar</span>
            <Button
              size="sm"
              disabled={!novo.trim() || addComment.isPending}
              onClick={() => addComment.mutate(novo.trim())}
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              {addComment.isPending ? "Enviando…" : "Comentar"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
