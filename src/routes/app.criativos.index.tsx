import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { Upload, Check, X, MessageSquare, FileIcon, History, Link as LinkIcon, ExternalLink, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/app/criativos/")({
  component: CriativosPage,
});

type Criativo = {
  id: string; tarefa_id: string; cliente_id: string;
  arquivo_path: string | null; arquivo_nome: string; arquivo_tipo: string | null;
  link_url: string | null;
  status: string; comentario_revisao: string | null;
  clientes: { nome: string } | null;
  tarefas: { titulo: string } | null;
};

type Versao = {
  id: string; criativo_id: string; versao: number;
  arquivo_path: string | null; arquivo_nome: string; arquivo_tipo: string | null;
  link_url: string | null;
  status: string; comentario_revisao: string | null;
  created_at: string;
};

type UploadMode = "novo" | "versao";
type SourceMode = "arquivo" | "link";

function isValidUrl(s: string) {
  try { const u = new URL(s); return u.protocol === "http:" || u.protocol === "https:"; }
  catch { return false; }
}

function CriativosPage() {
  const { role, user, clienteId } = useAuth();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadMode, setUploadMode] = useState<UploadMode>("novo");
  const [sourceMode, setSourceMode] = useState<SourceMode>("arquivo");
  const [tarefaId, setTarefaId] = useState("");
  const [criativoAlvoId, setCriativoAlvoId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkNome, setLinkNome] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: criativos } = useQuery({
    queryKey: ["criativos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("criativos")
        .select("id, tarefa_id, cliente_id, arquivo_path, arquivo_nome, arquivo_tipo, link_url, status, comentario_revisao, clientes(nome), tarefas(titulo)")
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

  const { data: criativosDaTarefa } = useQuery({
    queryKey: ["criativos-tarefa", tarefaId],
    enabled: role === "cliente" && !!tarefaId && uploadMode === "versao",
    queryFn: async () => {
      const { data } = await supabase
        .from("criativos")
        .select("id, arquivo_nome")
        .eq("tarefa_id", tarefaId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const resetForm = () => {
    setTitulo(""); setCriativoAlvoId(""); setLinkUrl(""); setLinkNome("");
    if (fileInput.current) fileInput.current.value = "";
  };

  const persistirCriativo = async (payload: {
    arquivo_path: string | null;
    arquivo_nome: string;
    arquivo_tipo: string | null;
    link_url: string | null;
  }) => {
    if (uploadMode === "novo") {
      const { data: cri, error: insErr } = await supabase.from("criativos").insert({
        tarefa_id: tarefaId, cliente_id: clienteId!, enviado_por: user!.id,
        arquivo_path: payload.arquivo_path, arquivo_nome: payload.arquivo_nome,
        arquivo_tipo: payload.arquivo_tipo, link_url: payload.link_url,
      } as never).select("id").single();
      if (insErr) throw insErr;
      const { error: vErr } = await supabase.from("criativo_versoes").insert({
        criativo_id: (cri as { id: string }).id, versao: 1,
        arquivo_path: payload.arquivo_path, arquivo_nome: payload.arquivo_nome,
        arquivo_tipo: payload.arquivo_tipo, link_url: payload.link_url,
        enviado_por: user!.id, status: "pendente_aprovacao",
      } as never);
      if (vErr) throw vErr;
      toast.success("Criativo enviado!");
    } else {
      const { data: ultima } = await supabase
        .from("criativo_versoes").select("versao")
        .eq("criativo_id", criativoAlvoId)
        .order("versao", { ascending: false }).limit(1).maybeSingle();
      const proxima = ((ultima?.versao as number | undefined) ?? 0) + 1;
      const { error: vErr } = await supabase.from("criativo_versoes").insert({
        criativo_id: criativoAlvoId, versao: proxima,
        arquivo_path: payload.arquivo_path, arquivo_nome: payload.arquivo_nome,
        arquivo_tipo: payload.arquivo_tipo, link_url: payload.link_url,
        enviado_por: user!.id, status: "pendente_aprovacao",
        comentario_revisao: titulo || null,
      } as never);
      if (vErr) throw vErr;
      toast.success(`Versão v${proxima} enviada!`);
    }
  };

  const handleUploadArquivo = async (file: File) => {
    if (!user || !clienteId || !tarefaId) { toast.error("Selecione uma tarefa antes"); return; }
    if (uploadMode === "versao" && !criativoAlvoId) { toast.error("Selecione o criativo para nova versão"); return; }
    setUploading(true);
    try {
      const path = `${clienteId}/${crypto.randomUUID()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("criativos").upload(path, file);
      if (upErr) throw upErr;
      await persistirCriativo({
        arquivo_path: path, arquivo_nome: file.name,
        arquivo_tipo: file.type, link_url: null,
      });
      qc.invalidateQueries({ queryKey: ["criativos"] });
      qc.invalidateQueries({ queryKey: ["criativos-tarefa", tarefaId] });
      resetForm();
    } catch (e) {
      toast.error("Erro no upload", { description: (e as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitLink = async () => {
    if (!user || !clienteId || !tarefaId) { toast.error("Selecione uma tarefa antes"); return; }
    if (uploadMode === "versao" && !criativoAlvoId) { toast.error("Selecione o criativo para nova versão"); return; }
    const url = linkUrl.trim();
    if (!isValidUrl(url)) { toast.error("Informe uma URL válida (https://…)"); return; }
    const nome = (linkNome.trim() || (() => {
      try { const u = new URL(url); return u.hostname + u.pathname.split("/").filter(Boolean).slice(-1)[0] ? `${u.hostname}${u.pathname}` : u.hostname; }
      catch { return url; }
    })()).slice(0, 200);
    setUploading(true);
    try {
      await persistirCriativo({
        arquivo_path: null, arquivo_nome: nome,
        arquivo_tipo: "link", link_url: url,
      });
      qc.invalidateQueries({ queryKey: ["criativos"] });
      qc.invalidateQueries({ queryKey: ["criativos-tarefa", tarefaId] });
      resetForm();
    } catch (e) {
      toast.error("Erro ao enviar link", { description: (e as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const review = useMutation({
    mutationFn: async ({ versaoId, status, comentario }: { versaoId: string; status: "aprovado" | "reprovado"; comentario?: string }) => {
      const { error } = await supabase.from("criativo_versoes").update({
        status: status as never,
        comentario_revisao: comentario ?? null,
        revisado_por: user!.id,
        revisado_em: new Date().toISOString(),
      }).eq("id", versaoId);
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
            ? "Envie criativos como arquivo ou cole o link (Google Drive, Dropbox, etc.)."
            : "Aprove ou reprove os criativos enviados pelos clientes."
        }
      />

      {role === "cliente" && (
        <Card className="mb-6">
          <CardContent className="p-5 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Tipo</label>
                <Select value={uploadMode} onValueChange={(v) => setUploadMode(v as UploadMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="novo">Novo criativo</SelectItem>
                    <SelectItem value="versao">Nova versão de existente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Tarefa</label>
                <Select value={tarefaId} onValueChange={(v) => { setTarefaId(v); setCriativoAlvoId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {(tarefasCliente ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.titulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Origem</label>
                <Select value={sourceMode} onValueChange={(v) => setSourceMode(v as SourceMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="arquivo">Upload de arquivo</SelectItem>
                    <SelectItem value="link">Link (Drive, Dropbox, etc.)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {uploadMode === "versao" && tarefaId && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-2 block">Criativo alvo</label>
                  <Select value={criativoAlvoId} onValueChange={setCriativoAlvoId}>
                    <SelectTrigger><SelectValue placeholder="Escolha o criativo" /></SelectTrigger>
                    <SelectContent>
                      {(criativosDaTarefa ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.arquivo_nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  placeholder="Comentário desta versão (opcional)"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                />
              </div>
            )}

            {sourceMode === "link" ? (
              <div className="space-y-3">
                <Input
                  placeholder="Cole o link (https://drive.google.com/...)"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
                <Input
                  placeholder="Nome de exibição (opcional)"
                  value={linkNome}
                  onChange={(e) => setLinkNome(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button
                    disabled={!tarefaId || uploading || !linkUrl || (uploadMode === "versao" && !criativoAlvoId)}
                    onClick={handleSubmitLink}
                  >
                    <LinkIcon className="h-4 w-4 mr-2" />
                    {uploading ? "Enviando…" : uploadMode === "novo" ? "Enviar link" : "Enviar nova versão (link)"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <input
                  ref={fileInput}
                  type="file"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUploadArquivo(e.target.files[0])}
                />
                <Button
                  disabled={!tarefaId || uploading || (uploadMode === "versao" && !criativoAlvoId)}
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Enviando…" : uploadMode === "novo" ? "Enviar criativo" : "Enviar nova versão"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {(criativos ?? []).map((c) => (
          <CriativoCard
            key={c.id}
            criativo={c}
            canReview={role === "admin" || role === "gestor"}
            onApprove={(versaoId) => review.mutate({ versaoId, status: "aprovado" })}
            onReject={(versaoId, comentario) => review.mutate({ versaoId, status: "reprovado", comentario })}
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
  onApprove: (versaoId: string) => void;
  onReject: (versaoId: string, comentario: string) => void;
}) {
  const { user } = useAuth();
  const [showReject, setShowReject] = useState(false);
  const [comentario, setComentario] = useState("");
  const [novoComentario, setNovoComentario] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const qc = useQueryClient();

  const { data: versoes } = useQuery({
    queryKey: ["versoes", criativo.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("criativo_versoes")
        .select("id, criativo_id, versao, arquivo_path, arquivo_nome, arquivo_tipo, link_url, status, comentario_revisao, created_at")
        .eq("criativo_id", criativo.id)
        .order("versao", { ascending: false });
      return (data ?? []) as Versao[];
    },
  });

  const versaoAtual = versoes?.[0];
  const versoesAntigas = versoes?.slice(1) ?? [];
  const linkAtual = versaoAtual?.link_url ?? criativo.link_url;
  const pathAtual = versaoAtual?.arquivo_path ?? criativo.arquivo_path;

  const { data: signedUrl } = useQuery({
    queryKey: ["signed", pathAtual],
    enabled: !!pathAtual,
    queryFn: async () => {
      const { data } = await supabase.storage.from("criativos").createSignedUrl(pathAtual!, 3600);
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

  const tipo = versaoAtual?.arquivo_tipo ?? criativo.arquivo_tipo;
  const isImage = tipo?.startsWith("image/");
  const isLink = !!linkAtual;
  const arquivoNome = versaoAtual?.arquivo_nome ?? criativo.arquivo_nome;
  const status = versaoAtual?.status ?? criativo.status;
  const href = linkAtual ?? signedUrl ?? "#";

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex gap-4">
          <div className="w-24 h-24 shrink-0 rounded-md bg-muted overflow-hidden flex items-center justify-center">
            {isImage && signedUrl ? (
              <img src={signedUrl} alt={arquivoNome} className="w-full h-full object-cover" />
            ) : isLink ? (
              <LinkIcon className="h-8 w-8 text-muted-foreground" />
            ) : (
              <FileIcon className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <a href={href} target="_blank" rel="noreferrer" className="font-semibold hover:underline truncate inline-flex items-center gap-1">
                    {arquivoNome}
                    {isLink && <ExternalLink className="h-3.5 w-3.5 opacity-70" />}
                  </a>
                  {versaoAtual && (
                    <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                      v{versaoAtual.versao}
                    </span>
                  )}
                  {isLink && (
                    <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">link externo</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {criativo.clientes?.nome} · {criativo.tarefas?.titulo}
                </div>
              </div>
              <StatusBadge status={status} kind="creative" />
            </div>

            {versaoAtual?.comentario_revisao && status === "reprovado" && (
              <div className="mt-2 text-sm p-2 rounded bg-accent-red/10 text-accent-red border border-accent-red/30">
                <strong>Reprovado:</strong> {versaoAtual.comentario_revisao}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {canReview && versaoAtual && versaoAtual.status === "pendente_aprovacao" && (
                <>
                  <Button size="sm" onClick={() => onApprove(versaoAtual.id)}>
                    <Check className="h-4 w-4 mr-1" /> Aprovar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setShowReject((s) => !s)}>
                    <X className="h-4 w-4 mr-1" /> Reprovar
                  </Button>
                </>
              )}
              {versoesAntigas.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setShowHistory((s) => !s)}>
                  <History className="h-4 w-4 mr-1" /> Histórico ({versoesAntigas.length})
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setShowComments((s) => !s)}>
                <MessageSquare className="h-4 w-4 mr-1" /> Comentários
              </Button>
            </div>

            {showReject && versaoAtual && (
              <div className="mt-3 space-y-2">
                <Textarea
                  placeholder="Motivo da reprovação..."
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                />
                <Button size="sm" variant="destructive" disabled={!comentario}
                  onClick={() => { onReject(versaoAtual.id, comentario); setShowReject(false); setComentario(""); }}>
                  Confirmar reprovação
                </Button>
              </div>
            )}

            {showHistory && (
              <div className="mt-4 border-t pt-3 space-y-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Versões anteriores</div>
                {versoesAntigas.map((v) => (
                  <VersaoItem key={v.id} versao={v} />
                ))}
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

function VersaoItem({ versao }: { versao: Versao }) {
  const { data: url } = useQuery({
    queryKey: ["signed-versao", versao.arquivo_path],
    enabled: !!versao.arquivo_path,
    queryFn: async () => {
      const { data } = await supabase.storage.from("criativos").createSignedUrl(versao.arquivo_path!, 3600);
      return data?.signedUrl ?? null;
    },
  });
  const href = versao.link_url ?? url ?? "#";
  const isLink = !!versao.link_url;
  return (
    <div className="flex items-center justify-between gap-3 p-2 rounded border text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs px-1.5 py-0.5 rounded bg-muted font-bold shrink-0">v{versao.versao}</span>
        <a href={href} target="_blank" rel="noreferrer" className="truncate hover:underline inline-flex items-center gap-1">
          {versao.arquivo_nome}
          {isLink && <ExternalLink className="h-3 w-3 opacity-70" />}
        </a>
      </div>
      <StatusBadge status={versao.status} kind="creative" />
    </div>
  );
}
