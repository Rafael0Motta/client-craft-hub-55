import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, RefreshCw, Trash2, Send, Eye, Zap } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Paginacao, usePaginacao } from "@/components/Paginacao";

export const Route = createFileRoute("/app/logs/")({
  component: LogsPage,
});

type WebhookLog = {
  id: string;
  tipo_gatilho: string;
  tarefa_id: string | null;
  criativo_id: string | null;
  payload: Record<string, unknown>;
  response_status: number | null;
  response_body: string | null;
  error: string | null;
  success: boolean;
  created_at: string;
};

const tipoLabels: Record<string, string> = {
  createTask: "Tarefa criada",
  addContentTask: "Conteúdo enviado",
  taskDueSoon: "Vence em 2 dias",
  taskOverdue: "Tarefa vencida",
};

function LogsPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<string>("all");
  const [statusFiltro, setStatusFiltro] = useState<string>("all");
  const [viewing, setViewing] = useState<WebhookLog | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [testOpen, setTestOpen] = useState(false);

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["webhook-logs"],
    enabled: role === "admin",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_logs" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as WebhookLog[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (logs ?? []).filter((l) => {
      if (tipoFiltro !== "all" && l.tipo_gatilho !== tipoFiltro) return false;
      if (statusFiltro === "success" && !l.success) return false;
      if (statusFiltro === "fail" && l.success) return false;
      if (q) {
        const blob = JSON.stringify(l.payload).toLowerCase();
        if (!blob.includes(q) && !l.tipo_gatilho.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [logs, search, tipoFiltro, statusFiltro]);

  const stats = useMemo(() => {
    const all = logs ?? [];
    return {
      total: all.length,
      success: all.filter((l) => l.success).length,
      fail: all.filter((l) => !l.success).length,
    };
  }, [logs]);

  const resend = useMutation({
    mutationFn: async (logId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dispatch-webhook`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ event: "resend", log_id: logId }),
      });
      if (!res.ok) throw new Error(`Falha ao reenviar (${res.status})`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhook-logs"] });
      toast.success("Webhook reenviado");
    },
    onError: (e: Error) => toast.error("Erro ao reenviar", { description: e.message }),
  });

  const deleteLog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("webhook_logs" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhook-logs"] });
      toast.success("Log removido");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("webhook_logs" as never)
        .delete()
        .gte("created_at", "1900-01-01");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhook-logs"] });
      toast.success("Todos os logs foram removidos");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const test = useMutation({
    mutationFn: async (params: { event: string; tarefa_id?: string; criativo_id?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dispatch-webhook`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error(`Falha (${res.status}): ${await res.text()}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhook-logs"] });
      toast.success("Webhook de teste disparado");
      setTestOpen(false);
    },
    onError: (e: Error) => toast.error("Erro no teste", { description: e.message }),
  });

  if (role && role !== "admin") return <Navigate to="/app" />;

  return (
    <div className="p-6">
      <PageHeader
        title="Logs de Webhook"
        description="Histórico de chamadas enviadas ao webhook externo (n8n)."
        actions={
          <>
            <Button onClick={() => setTestOpen(true)}>
              <Zap className="h-4 w-4 mr-2" /> Testar webhook
            </Button>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
            </Button>
            <Button variant="outline" onClick={() => setConfirmClear(true)} disabled={!logs?.length}>
              <Trash2 className="h-4 w-4 mr-2" /> Limpar tudo
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Total</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Sucesso</div>
          <div className="text-2xl font-bold text-primary">{stats.success}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Falhas</div>
          <div className="text-2xl font-bold text-destructive">{stats.fail}</div>
        </CardContent></Card>
      </div>

      <Card className="mb-4">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar no payload…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(tipoLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFiltro} onValueChange={setStatusFiltro}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="success">Sucesso</SelectItem>
              <SelectItem value="fail">Falha</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <LogsLista
        isLoading={isLoading}
        filtered={filtered}
        onView={setViewing}
        onResend={(id) => resend.mutate(id)}
        onDelete={(id) => deleteLog.mutate(id)}
        resending={resend.isPending}
      />

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewing && (tipoLabels[viewing.tipo_gatilho] ?? viewing.tipo_gatilho)}
            </DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Quando</div>
                  <div>{format(new Date(viewing.created_at), "dd/MM/yyyy HH:mm:ss")}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Status</div>
                  <div>
                    {viewing.success ? "✅ Sucesso" : "❌ Falha"}
                    {viewing.response_status ? ` (HTTP ${viewing.response_status})` : ""}
                  </div>
                </div>
              </div>
              {viewing.error && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Erro</div>
                  <div className="text-sm text-destructive bg-destructive/10 rounded p-2">{viewing.error}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Payload enviado</div>
                <pre className="text-xs bg-muted rounded p-3 overflow-x-auto max-h-96">
                  {JSON.stringify(viewing.payload, null, 2)}
                </pre>
              </div>
              {viewing.response_body && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Resposta</div>
                  <pre className="text-xs bg-muted rounded p-3 overflow-x-auto max-h-60">
                    {viewing.response_body}
                  </pre>
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={() => { resend.mutate(viewing.id); }}>
                  <Send className="h-4 w-4 mr-2" /> Reenviar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <TestWebhookDialog
        open={testOpen}
        onOpenChange={setTestOpen}
        onTest={(p) => test.mutate(p)}
        submitting={test.isPending}
      />

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar todos os logs?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso removerá <strong>todos os {logs?.length ?? 0} registros</strong> de webhook. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { clearAll.mutate(); setConfirmClear(false); }}>
              Limpar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type TestParams = { event: string; tarefa_id?: string; criativo_id?: string };

function TestWebhookDialog({
  open, onOpenChange, onTest, submitting,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onTest: (p: TestParams) => void;
  submitting: boolean;
}) {
  const [event, setEvent] = useState<string>("createTask");
  const [tarefaId, setTarefaId] = useState("");
  const [criativoId, setCriativoId] = useState("");

  const { data: tarefas } = useQuery({
    queryKey: ["test-tarefas"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("tarefas")
        .select("id, titulo, clientes(nome)")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as unknown as Array<{ id: string; titulo: string; clientes: { nome: string } | null }>;
    },
  });

  const { data: criativos } = useQuery({
    queryKey: ["test-criativos"],
    enabled: open && event === "addContentTask",
    queryFn: async () => {
      const { data } = await supabase
        .from("criativos")
        .select("id, arquivo_nome, tarefas(titulo)")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as unknown as Array<{ id: string; arquivo_nome: string; tarefas: { titulo: string } | null }>;
    },
  });

  const needsTarefa = event === "createTask" || event === "taskDueSoon" || event === "taskOverdue";
  const needsCriativo = event === "addContentTask";
  const canSubmit =
    !submitting &&
    (event === "cron" ||
      (needsTarefa && !!tarefaId) ||
      (needsCriativo && !!criativoId));

  const submit = () => {
    if (event === "cron") return onTest({ event });
    if (needsTarefa) return onTest({ event, tarefa_id: tarefaId });
    if (needsCriativo) return onTest({ event, criativo_id: criativoId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Disparar webhook de teste</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de evento</label>
            <Select value={event} onValueChange={(v) => { setEvent(v); setTarefaId(""); setCriativoId(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="createTask">Tarefa criada (createTask)</SelectItem>
                <SelectItem value="addContentTask">Conteúdo enviado (addContentTask)</SelectItem>
                <SelectItem value="taskDueSoon">Vence em 2 dias (taskDueSoon)</SelectItem>
                <SelectItem value="taskOverdue">Tarefa vencida (taskOverdue)</SelectItem>
                <SelectItem value="cron">Rodar cron (verificação geral)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {needsTarefa && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Tarefa</label>
              <Select value={tarefaId} onValueChange={setTarefaId}>
                <SelectTrigger><SelectValue placeholder="Selecione uma tarefa" /></SelectTrigger>
                <SelectContent>
                  {(tarefas ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.titulo} {t.clientes?.nome ? `· ${t.clientes.nome}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {needsCriativo && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Criativo</label>
              <Select value={criativoId} onValueChange={setCriativoId}>
                <SelectTrigger><SelectValue placeholder="Selecione um criativo" /></SelectTrigger>
                <SelectContent>
                  {(criativos ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.arquivo_nome} {c.tarefas?.titulo ? `· ${c.tarefas.titulo}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {event === "cron" && (
            <p className="text-xs text-muted-foreground">
              Roda a verificação periódica que envia <code>taskDueSoon</code> (vence em 2 dias) e <code>taskOverdue</code> (vencidas) para todas as tarefas elegíveis.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!canSubmit} onClick={submit}>
            {submitting ? "Enviando…" : "Disparar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
