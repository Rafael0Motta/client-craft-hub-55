import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { Upload, Check, X, MessageSquare, FileIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/criativos/")({
  component: CriativosPage,
});

type Criativo = {
  id: string; tarefa_id: string; cliente_id: string;
  arquivo_path: string; arquivo_nome: string; arquivo_tipo: string | null;
  status: string; comentario_revisao: string | null;
  clientes: { nome: string } | null;
  tarefas: { titulo: string } | null;
};

function CriativosPage() {
  const { role, user, clienteId } = useAuth();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [tarefaId, setTarefaId] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: criativos } = useQuery({
    queryKey: ["criativos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("criativos")
        .select("id, tarefa_id, cliente_id, arquivo_path, arquivo_nome, arquivo_tipo, status, comentario_revisao, clientes(nome), tarefas(titulo)")
        .order("created_at", { ascending: false });
      return (data ?? []) as Criativo[];
    },
  });

  const { data: tarefasCliente } = useQuery({
    queryKey: ["tarefas-cliente", clienteId],
    enabled: role === "cliente" && !!clienteId,
    queryFn: async () => {
      const { data } = await supabase.from("tarefas").select("id, titulo").eq("cliente_id", clienteId!);
      return data ?? [];
    },
  });

  const handleUpload = async (file: File) => {
    if (!user || !clienteId || !tarefaId) {
      toast.error("Selecione uma tarefa antes");
      return;
    }
    setUploading(true);
    try {
      const path = `${clienteId}/${crypto.randomUUID()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("criativos").upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("criativos").insert({
        tarefa_id: tarefaId, cliente_id: clienteId, enviado_por: user.id,
        arquivo_path: path, arquivo_nome: file.name, arquivo_tipo: file.type,
      } as never);
      if (insErr) throw insErr;
      toast.success("Criativo enviado!");
      qc.invalidateQueries({ queryKey: ["criativos"] });
    } catch (e) {
      toast.error("Erro no upload", { description: (e as Error).message });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const review = useMutation({
    mutationFn: async ({ id, status, comentario }: { id: string; status: "aprovado" | "reprovado"; comentario?: string }) => {
      const { error } = await supabase.from("criativos").update({
        status: status as never,
        comentario_revisao: comentario ?? null,
        revisado_por: user!.id,
        revisado_em: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["criativos"] });
      toast.success("Revisão registrada");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <>
      <PageHeader
        title="Criativos"
        description={
          role === "cliente"
            ? "Envie seus criativos para aprovação."
            : "Aprove ou reprove os criativos enviados pelos clientes."
        }
      />

      {role === "cliente" && (
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <div className="flex-1 w-full">
                <label className="text-sm font-medium mb-2 block">Vincular à tarefa</label>
                <Select value={tarefaId} onValueChange={setTarefaId}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma tarefa" /></SelectTrigger>
                  <SelectContent>
                    {(tarefasCliente ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.titulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <input
                ref={fileInput}
                type="file"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              />
              <Button disabled={!tarefaId || uploading} onClick={() => fileInput.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? "Enviando…" : "Enviar criativo"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {(criativos ?? []).map((c) => (
          <CriativoCard
            key={c.id}
            criativo={c}
            canReview={role === "admin" || role === "gestor"}
            onApprove={() => review.mutate({ id: c.id, status: "aprovado" })}
            onReject={(comentario) => review.mutate({ id: c.id, status: "reprovado", comentario })}
          />
        ))}
        {(criativos ?? []).length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum criativo ainda.
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

function CriativoCard({
  criativo, canReview, onApprove, onReject,
}: {
  criativo: Criativo;
  canReview: boolean;
  onApprove: () => void;
  onReject: (comentario: string) => void;
}) {
  const { user } = useAuth();
  const [showReject, setShowReject] = useState(false);
  const [comentario, setComentario] = useState("");
  const [novoComentario, setNovoComentario] = useState("");
  const [showComments, setShowComments] = useState(false);
  const qc = useQueryClient();

  const { data: signedUrl } = useQuery({
    queryKey: ["signed", criativo.arquivo_path],
    queryFn: async () => {
      const { data } = await supabase.storage.from("criativos").createSignedUrl(criativo.arquivo_path, 3600);
      return data?.signedUrl ?? null;
    },
  });

  const { data: comentarios } = useQuery({
    queryKey: ["comentarios", criativo.id],
    enabled: showComments,
    queryFn: async () => {
      const { data } = await supabase
        .from("criativo_comentarios")
        .select("id, texto, created_at, autor_id")
        .eq("criativo_id", criativo.id)
        .order("created_at");
      return data ?? [];
    },
  });

  const addComment = useMutation({
    mutationFn: async (texto: string) => {
      const { error } = await supabase.from("criativo_comentarios").insert({
        criativo_id: criativo.id, autor_id: user!.id, texto,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      setNovoComentario("");
      qc.invalidateQueries({ queryKey: ["comentarios", criativo.id] });
    },
  });

  const isImage = criativo.arquivo_tipo?.startsWith("image/");

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex gap-4">
          <div className="w-24 h-24 shrink-0 rounded-md bg-muted overflow-hidden flex items-center justify-center">
            {isImage && signedUrl ? (
              <img src={signedUrl} alt={criativo.arquivo_nome} className="w-full h-full object-cover" />
            ) : (
              <FileIcon className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <a href={signedUrl ?? "#"} target="_blank" rel="noreferrer" className="font-semibold hover:underline truncate block">
                  {criativo.arquivo_nome}
                </a>
                <div className="text-xs text-muted-foreground mt-1">
                  {criativo.clientes?.nome} · {criativo.tarefas?.titulo}
                </div>
              </div>
              <StatusBadge status={criativo.status} kind="creative" />
            </div>

            {criativo.comentario_revisao && (
              <div className="mt-2 text-sm p-2 rounded bg-accent-red/10 text-accent-red border border-accent-red/30">
                <strong>Reprovado:</strong> {criativo.comentario_revisao}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {canReview && criativo.status === "pendente_aprovacao" && (
                <>
                  <Button size="sm" onClick={onApprove}>
                    <Check className="h-4 w-4 mr-1" /> Aprovar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setShowReject((s) => !s)}>
                    <X className="h-4 w-4 mr-1" /> Reprovar
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" onClick={() => setShowComments((s) => !s)}>
                <MessageSquare className="h-4 w-4 mr-1" /> Comentários
              </Button>
            </div>

            {showReject && (
              <div className="mt-3 space-y-2">
                <Textarea
                  placeholder="Motivo da reprovação..."
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                />
                <Button size="sm" variant="destructive" disabled={!comentario} onClick={() => { onReject(comentario); setShowReject(false); setComentario(""); }}>
                  Confirmar reprovação
                </Button>
              </div>
            )}

            {showComments && (
              <div className="mt-4 space-y-2 border-t pt-3">
                {(comentarios ?? []).map((c) => (
                  <div key={c.id} className="text-sm p-2 rounded bg-muted">
                    {c.texto}
                  </div>
                ))}
                <div className="flex gap-2">
                  <Textarea
                    rows={2}
                    placeholder="Adicionar comentário..."
                    value={novoComentario}
                    onChange={(e) => setNovoComentario(e.target.value)}
                  />
                  <Button size="sm" disabled={!novoComentario} onClick={() => addComment.mutate(novoComentario)}>
                    Enviar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
