import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Upload, Check, X, MessageSquare, FileIcon, History,
  Link as LinkIcon, ExternalLink, Trash2, User as UserIcon, Calendar,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type SourceMode = "arquivo" | "link";
type UploadMode = "novo" | "versao";

export type CriativoRow = {
  id: string;
  tarefa_id: string;
  cliente_id: string;
  arquivo_path: string | null;
  arquivo_nome: string;
  arquivo_tipo: string | null;
  link_url: string | null;
  descricao: string | null;
  status: string;
  status_operacional: string;
  comentario_revisao: string | null;
  enviado_por: string | null;
  created_at: string;
  clientes?: { nome: string } | null;
  tarefas?: { titulo: string; tipos_tarefa?: { nome: string } | null } | null;
  profiles?: { nome: string } | null;
};

type Versao = {
  id: string;
  criativo_id: string;
  versao: number;
  arquivo_path: string | null;
  arquivo_nome: string;
  arquivo_tipo: string | null;
  link_url: string | null;
  descricao: string | null;
  status: string;
  comentario_revisao: string | null;
  enviado_por: string | null;
  created_at: string;
  profiles?: { nome: string } | null;
};

function isValidUrl(s: string) {
  try { const u = new URL(s); return u.protocol === "http:" || u.protocol === "https:"; }
  catch { return false; }
}

function fmtDateTime(iso: string) {
  try { return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); }
  catch { return iso; }
}

/**
 * Section reutilizável: lista criativos (filtrável por tarefa) + formulário
 * de envio (arquivo/link com descrição).
 *
 * - tarefaId definida → escopo de uma tarefa (usado na tela de detalhe)
 * - tarefaId undefined → comportamento global (usado em /app/criativos)
 */
export function CriativosSection({
  tarefaId,
  clienteId: clienteIdProp,
  showSenderForm = true,
  tipoTarefaNome = null,
}: {
  tarefaId?: string;
  clienteId?: string;
  showSenderForm?: boolean;
  /** Quando o tipo da tarefa for "Criativo", o envio aceita apenas link (sem upload). */
  tipoTarefaNome?: string | null;
}) {
  const { role, user, clienteId: clienteIdCtx } = useAuth();
  const qc = useQueryClient();
  const clienteId = clienteIdProp ?? clienteIdCtx;

  const queryKey = tarefaId ? ["criativos", "tarefa", tarefaId] : ["criativos"];

  const { data: criativos } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase
        .from("criativos")
        .select(
          "id, tarefa_id, cliente_id, arquivo_path, arquivo_nome, arquivo_tipo, link_url, descricao, status, status_operacional, comentario_revisao, enviado_por, created_at, clientes(nome), tarefas(titulo, tipos_tarefa(nome))"
        )
        .order("created_at", { ascending: false });
      if (tarefaId) q = q.eq("tarefa_id", tarefaId);
      const { data } = await q;
      return (data ?? []) as unknown as CriativoRow[];
    },
  });

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
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["criativos"] });
      toast.success("Revisão registrada");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const deleteCriativo = useMutation({
    mutationFn: async (criativoId: string) => {
      const { error } = await supabase.from("criativos").delete().eq("id", criativoId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["criativos"] });
      toast.success("Criativo excluído");
    },
    onError: (e: Error) => toast.error("Erro ao excluir", { description: e.message }),
  });

  const canEnviar =
    showSenderForm && role === "cliente" && !!clienteId && !!user;

  return (
    <div className="space-y-4">
      {canEnviar && (
        <EnvioCriativoForm
          tarefaIdFixo={tarefaId}
          clienteId={clienteId!}
          tipoTarefaNome={tipoTarefaNome}
          onSent={() => {
            qc.invalidateQueries({ queryKey });
            qc.invalidateQueries({ queryKey: ["criativos"] });
          }}
        />
      )}

      <div className="space-y-3">
        {(criativos ?? []).map((c) => {
          const canDelete =
            role === "admin" ||
            role === "gestor" ||
            (role === "cliente" && c.status === "pendente_aprovacao");
          return (
            <CriativoCard
              key={c.id}
              criativo={c}
              showTarefaName={!tarefaId}
              canReview={role === "admin" || role === "gestor"}
              canDelete={canDelete}
              onApprove={(versaoId) => review.mutate({ versaoId, status: "aprovado" })}
              onReject={(versaoId, comentario) => review.mutate({ versaoId, status: "reprovado", comentario })}
              onDelete={(id) => deleteCriativo.mutate(id)}
            />
          );
        })}
        {(criativos ?? []).length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum criativo ainda.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ───────────────────── Envio ───────────────────── */

function EnvioCriativoForm({
  tarefaIdFixo,
  clienteId,
  onSent,
  tipoTarefaNome = null,
}: {
  tarefaIdFixo?: string;
  clienteId: string;
  onSent: () => void;
  tipoTarefaNome?: string | null;
}) {
  const { user, role } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadMode, setUploadMode] = useState<UploadMode>("novo");
  // Quando a tarefa é do tipo Criativo, força o modo "link" (sem upload).
  const isCriativoTipo = (tipoTarefaNome ?? "").toLowerCase() === "criativo";
  const [sourceMode, setSourceMode] = useState<SourceMode>(isCriativoTipo ? "link" : "arquivo");
  const [tarefaId, setTarefaId] = useState(tarefaIdFixo ?? "");
  const [criativoAlvoId, setCriativoAlvoId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkNome, setLinkNome] = useState("");
  const [uploading, setUploading] = useState(false);
  const arquivoState = useState<File | null>(null);

  // Para tarefa global (sem tarefaIdFixo), busca tipo da tarefa selecionada
  const { data: tarefasCliente } = useQuery({
    queryKey: ["tarefas-cliente-form", clienteId],
    enabled: !tarefaIdFixo && role === "cliente",
    queryFn: async () => {
      const { data } = await supabase
        .from("tarefas")
        .select("id, titulo, tipos_tarefa(nome)")
        .eq("cliente_id", clienteId);
      return (data ?? []) as unknown as Array<{ id: string; titulo: string; tipos_tarefa: { nome: string } | null }>;
    },
  });

  const tarefaAtiva = tarefaIdFixo ?? tarefaId;

  // Determina se a tarefa selecionada (no modo global) é do tipo Criativo
  const tarefaSelecionada = tarefasCliente?.find((t) => t.id === tarefaId);
  const isCriativoEffective =
    isCriativoTipo || (tarefaSelecionada?.tipos_tarefa?.nome ?? "").toLowerCase() === "criativo";

  const { data: criativosDaTarefa } = useQuery({
    queryKey: ["criativos-tarefa-form", tarefaAtiva],
    enabled: !!tarefaAtiva && uploadMode === "versao",
    queryFn: async () => {
      const { data } = await supabase
        .from("criativos")
        .select("id, arquivo_nome")
        .eq("tarefa_id", tarefaAtiva)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const reset = () => {
    setDescricao(""); setCriativoAlvoId(""); setLinkUrl(""); setLinkNome("");
    if (fileInput.current) fileInput.current.value = "";
  };

  const persistir = async (payload: {
    arquivo_path: string | null;
    arquivo_nome: string;
    arquivo_tipo: string | null;
    link_url: string | null;
  }) => {
    if (uploadMode === "novo") {
      const { data: cri, error: insErr } = await supabase.from("criativos").insert({
        tarefa_id: tarefaAtiva, cliente_id: clienteId, enviado_por: user!.id,
        arquivo_path: payload.arquivo_path, arquivo_nome: payload.arquivo_nome,
        arquivo_tipo: payload.arquivo_tipo, link_url: payload.link_url,
        descricao: descricao || null,
      } as never).select("id").single();
      if (insErr) throw insErr;
      const { error: vErr } = await supabase.from("criativo_versoes").insert({
        criativo_id: (cri as { id: string }).id, versao: 1,
        arquivo_path: payload.arquivo_path, arquivo_nome: payload.arquivo_nome,
        arquivo_tipo: payload.arquivo_tipo, link_url: payload.link_url,
        descricao: descricao || null,
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
        descricao: descricao || null,
        enviado_por: user!.id, status: "pendente_aprovacao",
        comentario_revisao: null,
      } as never);
      if (vErr) throw vErr;
      toast.success(`Versão v${proxima} enviada!`);
    }
  };

  const handleArquivo = async (file: File) => {
    if (!user || !tarefaAtiva) { toast.error("Selecione uma tarefa"); return; }
    if (uploadMode === "versao" && !criativoAlvoId) { toast.error("Selecione o criativo alvo"); return; }
    setUploading(true);
    try {
      const path = `${clienteId}/${crypto.randomUUID()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("criativos").upload(path, file);
      if (upErr) throw upErr;
      await persistir({ arquivo_path: path, arquivo_nome: file.name, arquivo_tipo: file.type, link_url: null });
      onSent(); reset();
    } catch (e) {
      toast.error("Erro no upload", { description: (e as Error).message });
    } finally { setUploading(false); }
  };

  const handleLink = async () => {
    if (!user || !tarefaAtiva) { toast.error("Selecione uma tarefa"); return; }
    if (uploadMode === "versao" && !criativoAlvoId) { toast.error("Selecione o criativo alvo"); return; }
    const url = linkUrl.trim();
    if (!isValidUrl(url)) { toast.error("Informe uma URL válida (https://…)"); return; }
    const nome = (linkNome.trim() || (() => {
      try { const u = new URL(url); return `${u.hostname}${u.pathname}`.slice(0, 200); }
      catch { return url; }
    })()).slice(0, 200);
    setUploading(true);
    try {
      await persistir({ arquivo_path: null, arquivo_nome: nome, arquivo_tipo: "link", link_url: url });
      onSent(); reset();
    } catch (e) {
      toast.error("Erro ao enviar link", { description: (e as Error).message });
    } finally { setUploading(false); }
  };

  // ─────────── MODO SIMPLES (cliente em uma tarefa) ───────────
  // Para clientes dentro de uma tarefa, mostra interface enxuta e visual:
  // sem dropdowns "Tipo/Origem", uma única CTA grande.
  const isClienteSimples = role === "cliente" && !!tarefaIdFixo;

  if (isClienteSimples) {
    // Para tarefas do tipo Criativo: apenas link.
    // Para outros tipos: cliente pode enviar link, arquivo e/ou texto livremente.
    const apenasLink = isCriativoEffective;
    const tituloEnvio = apenasLink ? "Enviar criativo por link" : "Enviar sua resposta";
    const subtitulo = apenasLink
      ? "Cole abaixo o link do seu criativo (Google Drive, Dropbox, WeTransfer, YouTube etc.) e clique em Enviar."
      : "Você pode enviar um arquivo, um link ou apenas uma mensagem de texto. Use o que for mais fácil para você.";

    const podeEnviarSoTexto = !apenasLink;
    const handleEnviarTexto = async () => {
      if (!user || !tarefaAtiva) return;
      const texto = descricao.trim();
      if (!texto) { toast.error("Escreva uma mensagem"); return; }
      setUploading(true);
      try {
        await persistir({
          arquivo_path: null,
          arquivo_nome: texto.slice(0, 80),
          arquivo_tipo: "texto",
          link_url: null,
        });
        onSent(); reset();
      } catch (e) {
        toast.error("Erro ao enviar", { description: (e as Error).message });
      } finally { setUploading(false); }
    };

    // Envio unificado: cliente pode anexar arquivo, colar link e/ou escrever
    // mensagem — tudo na mesma tela. Um único botão "Enviar" se adapta.
    const [arquivoSelecionado, setArquivoSelecionado] = arquivoState;
    const temArquivo = !!arquivoSelecionado;
    const temLink = !!linkUrl.trim();
    const temTexto = !!descricao.trim();
    const podeEnviar = temArquivo || temLink || (podeEnviarSoTexto && temTexto);

    const labelBotao = temArquivo
      ? "Enviar arquivo"
      : temLink
        ? "Enviar link"
        : "Enviar mensagem";

    const handleEnviarUnificado = async () => {
      if (!user || !tarefaAtiva) return;
      if (temArquivo) {
        await handleArquivo(arquivoSelecionado!);
        setArquivoSelecionado(null);
        return;
      }
      if (temLink) {
        await handleLink();
        return;
      }
      if (podeEnviarSoTexto && temTexto) {
        await handleEnviarTexto();
      }
    };

    return (
      <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-6 space-y-5">
          <div className="text-center space-y-2">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-bold">{tituloEnvio}</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">{subtitulo}</p>
          </div>

          <div className="space-y-4 max-w-xl mx-auto">
            {/* Mensagem — sempre visível e em destaque */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-primary" />
                Mensagem {podeEnviarSoTexto && <span className="text-xs font-normal text-muted-foreground">(você pode enviar só a mensagem se quiser)</span>}
              </label>
              <Textarea
                rows={4}
                placeholder={podeEnviarSoTexto
                  ? "Escreva aqui sua resposta, observação ou comentário…"
                  : "Mensagem ou observação (opcional)"}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="text-base"
              />
            </div>

            {/* Link */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold flex items-center gap-1.5">
                <LinkIcon className="h-4 w-4 text-primary" />
                Link {!apenasLink && <span className="text-xs font-normal text-muted-foreground">(opcional)</span>}
              </label>
              <Input
                placeholder="https://drive.google.com/..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="h-11 text-base"
              />
              <p className="text-[11px] text-muted-foreground">
                💡 Verifique se o link está com permissão de visualização aberta.
              </p>
            </div>

            {/* Arquivo */}
            {!apenasLink && (
              <div className="space-y-1.5">
                <label className="text-sm font-semibold flex items-center gap-1.5">
                  <Upload className="h-4 w-4 text-primary" />
                  Arquivo <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                </label>
                <input
                  ref={fileInput}
                  type="file"
                  className="hidden"
                  onChange={(e) => setArquivoSelecionado(e.target.files?.[0] ?? null)}
                />
                {temArquivo ? (
                  <div className="flex items-center gap-2 rounded-lg border bg-background p-3">
                    <FileIcon className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-sm truncate flex-1">{arquivoSelecionado!.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => { setArquivoSelecionado(null); if (fileInput.current) fileInput.current.value = ""; }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading}
                    className="w-full border-2 border-dashed border-primary/40 rounded-xl py-6 px-4 hover:bg-primary/5 transition flex flex-col items-center gap-1.5 disabled:opacity-60"
                  >
                    <Upload className="h-7 w-7 text-primary" />
                    <span className="font-semibold text-sm">Clique para escolher um arquivo</span>
                    <span className="text-xs text-muted-foreground">Imagem, vídeo, PDF, documento…</span>
                  </button>
                )}
              </div>
            )}

            <Button
              size="lg"
              className="w-full h-12 text-base font-semibold"
              disabled={!podeEnviar || uploading}
              onClick={handleEnviarUnificado}
            >
              {uploading ? "Enviando…" : labelBotao}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─────────── MODO COMPLETO (admin/gestor ou tarefa global) ───────────
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium mb-2 block">Tipo</label>
            <Select value={uploadMode} onValueChange={(v) => setUploadMode(v as UploadMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="novo">Novo criativo</SelectItem>
                <SelectItem value="versao">Nova versão de existente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!tarefaIdFixo && (
            <div>
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
          )}
          {!isCriativoEffective && (
            <div>
              <label className="text-sm font-medium mb-2 block">Origem</label>
              <Select
                value={sourceMode}
                onValueChange={(v) => setSourceMode(v as SourceMode)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="arquivo">Upload de arquivo</SelectItem>
                  <SelectItem value="link">Link (Drive, Dropbox, etc.)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {uploadMode === "versao" && tarefaAtiva && (
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
        )}

        <div>
          <label className="text-sm font-medium mb-2 block">Mensagem / descrição (opcional)</label>
          <Textarea
            rows={2}
            placeholder="Contexto do envio, instruções, observações…"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>

        {(sourceMode === "link" || isCriativoEffective) ? (
          <div className="space-y-3">
            <Input placeholder="Cole o link (https://drive.google.com/...)" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
            <Input placeholder="Nome de exibição (opcional)" value={linkNome} onChange={(e) => setLinkNome(e.target.value)} />
            <div className="flex justify-end">
              <Button
                disabled={!tarefaAtiva || uploading || !linkUrl || (uploadMode === "versao" && !criativoAlvoId)}
                onClick={handleLink}
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
              onChange={(e) => e.target.files?.[0] && handleArquivo(e.target.files[0])}
            />
            <Button
              disabled={!tarefaAtiva || uploading || (uploadMode === "versao" && !criativoAlvoId)}
              onClick={() => fileInput.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Enviando…" : uploadMode === "novo" ? "Enviar criativo" : "Enviar nova versão"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ───────────────────── Card de criativo ───────────────────── */

function CriativoCard({
  criativo, showTarefaName, canReview, canDelete, onApprove, onReject, onDelete,
}: {
  criativo: CriativoRow;
  showTarefaName: boolean;
  canReview: boolean;
  canDelete: boolean;
  onApprove: (versaoId: string) => void;
  onReject: (versaoId: string, comentario: string) => void;
  onDelete: (criativoId: string) => void;
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
        .select("id, criativo_id, versao, arquivo_path, arquivo_nome, arquivo_tipo, link_url, descricao, status, comentario_revisao, created_at, enviado_por")
        .eq("criativo_id", criativo.id)
        .order("versao", { ascending: false });
      return (data ?? []) as unknown as Versao[];
    },
  });

  const versaoAtual = versoes?.[0];
  const versoesAntigas = versoes?.slice(1) ?? [];
  const linkAtual = versaoAtual?.link_url ?? criativo.link_url;
  const pathAtual = versaoAtual?.arquivo_path ?? criativo.arquivo_path;
  const descAtual = versaoAtual?.descricao ?? criativo.descricao;

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
      return (data ?? []) as unknown as Array<{
        id: string; texto: string; created_at: string;
        autor_id: string | null; profiles: { nome: string } | null;
      }>;
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

  const enviadoPorNome =
    versaoAtual?.profiles?.nome ?? criativo.profiles?.nome ?? "Usuário";
  const enviadoEm = versaoAtual?.created_at ?? criativo.created_at;

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
                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {showTarefaName && (
                    <span>{criativo.clientes?.nome} · {criativo.tarefas?.titulo}</span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <UserIcon className="h-3 w-3" /> {enviadoPorNome}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {fmtDateTime(enviadoEm)}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <StatusBadge status={status} kind="creative" />
              </div>
            </div>

            {descAtual && (
              <div className="mt-2 text-sm p-2 rounded bg-muted/50 border">
                {descAtual}
              </div>
            )}

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
              {canDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4 mr-1" /> Excluir
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir criativo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação removerá o criativo <strong>{arquivoNome}</strong> e <strong>todas as suas versões e comentários</strong>. A tarefa permanece intacta. Não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(criativo.id)}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
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
              <div className="mt-4 space-y-3 border-t pt-3">
                <div className="space-y-3">
                  {(comentarios ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhum comentário ainda.</p>
                  )}
                  {(comentarios ?? []).map((c) => (
                    <div key={c.id} className="flex gap-3">
                      <div className="h-8 w-8 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">
                        {(c.profiles?.nome ?? "U").slice(0, 1).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-sm font-semibold">{c.profiles?.nome ?? "Usuário"}</span>
                          <span className="text-[11px] text-muted-foreground">📅 {fmtDateTime(c.created_at)}</span>
                        </div>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{c.texto}</p>
                      </div>
                    </div>
                  ))}
                </div>
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
  const enviadoPor = versao.profiles?.nome ?? "Usuário";
  return (
    <div className="p-2 rounded border text-sm space-y-1">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs px-1.5 py-0.5 rounded bg-muted font-bold shrink-0">v{versao.versao}</span>
          <a href={href} target="_blank" rel="noreferrer" className="truncate hover:underline inline-flex items-center gap-1">
            {versao.arquivo_nome}
            {isLink && <ExternalLink className="h-3 w-3 opacity-70" />}
          </a>
        </div>
        <StatusBadge status={versao.status} kind="creative" />
      </div>
      <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3">
        <span>👤 {enviadoPor}</span>
        <span>📅 {fmtDateTime(versao.created_at)}</span>
      </div>
      {versao.descricao && <p className="text-xs text-muted-foreground italic">"{versao.descricao}"</p>}
      {versao.comentario_revisao && versao.status === "reprovado" && (
        <p className="text-xs text-accent-red">Reprovado: {versao.comentario_revisao}</p>
      )}
    </div>
  );
}
