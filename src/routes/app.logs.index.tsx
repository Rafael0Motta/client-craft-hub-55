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
import { Search, RefreshCw, Trash2, Send, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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

  if (role && role !== "admin") return <Navigate to="/app" />;

  return (
    <div className="p-6">
      <PageHeader
        title="Logs de Webhook"
        description="Histórico de chamadas enviadas ao webhook externo (n8n)."
        actions={
          <>
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

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filtered.map((log) => (
                <div key={log.id} className="flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${log.success ? "bg-green-500" : "bg-destructive"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{tipoLabels[log.tipo_gatilho] ?? log.tipo_gatilho}</span>
                      <Badge variant="outline" className="text-[10px]">{log.tipo_gatilho}</Badge>
                      {log.response_status && (
                        <Badge variant={log.success ? "default" : "destructive"} className="text-[10px]">
                          HTTP {log.response_status}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss")}
                      {log.error && <span className="text-destructive"> · {log.error}</span>}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setViewing(log)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => resend.mutate(log.id)} disabled={resend.isPending}>
                    <Send className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteLog.mutate(log.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="p-10 text-center text-sm text-muted-foreground">Nenhum log encontrado.</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
