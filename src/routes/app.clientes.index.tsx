import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, ArrowRight, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/clientes/")({
  component: ClientesPage,
});

function isValidDriveUrl(url: string) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.hostname.endsWith("google.com") && u.pathname.includes("/drive/");
  } catch { return false; }
}

function ClientesPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: clientes, isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, segmento, campanha, user_id, drive_folder_url")
        .order("nome");
      return data ?? [];
    },
  });

  const { data: gestores } = useQuery({
    queryKey: ["profiles", "gestores"],
    enabled: role === "admin",
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "gestor");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id, nome, email").in("id", ids);
      return data ?? [];
    },
  });

  const { data: clientesUsers } = useQuery({
    queryKey: ["profiles", "clientes-users-unbound"],
    enabled: role === "admin",
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "cliente");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id, nome, email").in("id", ids);
      return data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: {
      nome: string; segmento: string; campanha: string;
      drive_folder_url: string;
      user_id: string | null;
      gestor_ids: string[];
    }) => {
      const { data: cli, error } = await supabase
        .from("clientes")
        .insert({
          nome: payload.nome,
          segmento: payload.segmento || null,
          campanha: payload.campanha || null,
          drive_folder_url: payload.drive_folder_url,
          user_id: payload.user_id,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (payload.gestor_ids.length && cli) {
        const links = payload.gestor_ids.map((gid) => ({ cliente_id: cli.id, gestor_id: gid }));
        const { error: linkErr } = await supabase.from("cliente_gestores").insert(links);
        if (linkErr) throw linkErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setOpen(false);
      toast.success("Cliente criado");
    },
    onError: (e: Error) => toast.error("Erro ao criar", { description: e.message }),
  });

  return (
    <>
      <PageHeader
        title="Clientes"
        description={role === "admin" ? "Todos os clientes do sistema." : "Clientes sob sua responsabilidade."}
        actions={
          role === "admin" ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Novo cliente</Button>
              </DialogTrigger>
              <NewClienteDialog
                gestores={gestores ?? []}
                clientesUsers={clientesUsers ?? []}
                onSubmit={(p) => createMutation.mutate(p)}
                submitting={createMutation.isPending}
              />
            </Dialog>
          ) : null
        }
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (clientes ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Nenhum cliente {role === "admin" ? "cadastrado" : "atribuído"} ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(clientes ?? []).map((c) => (
            <Link key={c.id} to="/app/clientes/$id" params={{ id: c.id }}>
              <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-lg leading-tight">{c.nome}</h3>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  {c.segmento && (
                    <div className="text-xs uppercase tracking-wider text-brand font-semibold">
                      {c.segmento}
                    </div>
                  )}
                  {c.campanha && (
                    <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{c.campanha}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function NewClienteDialog({
  gestores, clientesUsers, onSubmit, submitting,
}: {
  gestores: Array<{ id: string; nome: string; email: string }>;
  clientesUsers: Array<{ id: string; nome: string; email: string }>;
  onSubmit: (p: { nome: string; segmento: string; campanha: string; drive_folder_url: string; user_id: string | null; gestor_ids: string[] }) => void;
  submitting: boolean;
}) {
  const [nome, setNome] = useState("");
  const [segmento, setSegmento] = useState("");
  const [campanha, setCampanha] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [userId, setUserId] = useState<string>("none");
  const [gestorIds, setGestorIds] = useState<string[]>([]);

  const driveValid = !driveUrl || isValidDriveUrl(driveUrl);
  const canSubmit = !!nome && !!driveUrl && driveValid && gestorIds.length > 0 && !submitting;

  const toggleGestor = (id: string) => {
    setGestorIds((p) => p.includes(id) ? p.filter((g) => g !== id) : [...p, id]);
  };

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Novo cliente</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Nome do cliente *</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Segmento</Label>
          <Input value={segmento} onChange={(e) => setSegmento(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Pasta do Cliente (Google Drive) *</Label>
          <Input
            value={driveUrl}
            onChange={(e) => setDriveUrl(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
          />
          {driveUrl && !driveValid && (
            <p className="text-xs text-destructive">URL do Google Drive inválida.</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Informações da campanha</Label>
          <Textarea rows={3} value={campanha} onChange={(e) => setCampanha(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Gestores responsáveis * (um ou mais)</Label>
          {gestores.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum gestor cadastrado.</p>
          ) : (
            <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
              {gestores.map((g) => (
                <label key={g.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-accent text-sm">
                  <input type="checkbox" checked={gestorIds.includes(g.id)} onChange={() => toggleGestor(g.id)} />
                  {g.nome}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>Usuário-cliente (login)</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Nenhum —</SelectItem>
              {clientesUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={!canSubmit}
          onClick={() =>
            onSubmit({
              nome, segmento, campanha,
              drive_folder_url: driveUrl,
              user_id: userId === "none" ? null : userId,
              gestor_ids: gestorIds,
            })
          }
        >
          {submitting ? "Salvando…" : "Criar cliente"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
