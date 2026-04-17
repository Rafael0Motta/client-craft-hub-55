import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { Plus, ArrowRight, Users, Search, UserCog } from "lucide-react";
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

type ClienteRow = {
  id: string; nome: string; segmento: string | null;
  campanha: string | null; user_id: string | null; drive_folder_url: string | null;
};

function ClientesPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [segmentoFiltro, setSegmentoFiltro] = useState<string>("all");
  const [gestorFiltro, setGestorFiltro] = useState<string>("all");

  const { data: clientes, isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, segmento, campanha, user_id, drive_folder_url")
        .order("nome");
      return (data ?? []) as ClienteRow[];
    },
  });

  // Vínculos cliente↔gestor + nomes dos gestores p/ exibir nos cards e filtrar
  const { data: vinculos } = useQuery({
    queryKey: ["cliente-gestores-com-nome"],
    queryFn: async () => {
      const { data: links } = await supabase.from("cliente_gestores").select("cliente_id, gestor_id");
      const ids = Array.from(new Set((links ?? []).map((l) => l.gestor_id)));
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, nome").in("id", ids)
        : { data: [] as Array<{ id: string; nome: string }> };
      const nomeById = new Map((profs ?? []).map((p) => [p.id, p.nome]));
      const byCliente = new Map<string, Array<{ id: string; nome: string }>>();
      (links ?? []).forEach((l) => {
        const arr = byCliente.get(l.cliente_id) ?? [];
        arr.push({ id: l.gestor_id, nome: nomeById.get(l.gestor_id) ?? "—" });
        byCliente.set(l.cliente_id, arr);
      });
      return { byCliente, all: profs ?? [] };
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

  const segmentos = useMemo(() => {
    const s = new Set<string>();
    (clientes ?? []).forEach((c) => c.segmento && s.add(c.segmento));
    return Array.from(s).sort();
  }, [clientes]);

  const gestoresFiltro = useMemo(() => {
    // Gestores que aparecem em algum vínculo
    const map = new Map<string, string>();
    vinculos?.byCliente.forEach((arr) => arr.forEach((g) => map.set(g.id, g.nome)));
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [vinculos]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (clientes ?? []).filter((c) => {
      if (q && !c.nome.toLowerCase().includes(q)) return false;
      if (segmentoFiltro !== "all" && c.segmento !== segmentoFiltro) return false;
      if (gestorFiltro !== "all") {
        const gs = vinculos?.byCliente.get(c.id) ?? [];
        if (!gs.some((g) => g.id === gestorFiltro)) return false;
      }
      return true;
    });
  }, [clientes, vinculos, search, segmentoFiltro, gestorFiltro]);

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
      qc.invalidateQueries({ queryKey: ["cliente-gestores-com-nome"] });
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

      <Card className="mb-4">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={segmentoFiltro} onValueChange={setSegmentoFiltro}>
            <SelectTrigger><SelectValue placeholder="Segmento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os segmentos</SelectItem>
              {segmentos.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={gestorFiltro} onValueChange={setGestorFiltro}>
            <SelectTrigger><SelectValue placeholder="Gestor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os gestores</SelectItem>
              {gestoresFiltro.map((g) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Nenhum cliente encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const gs = vinculos?.byCliente.get(c.id) ?? [];
            const principal = gs[0];
            const extras = gs.length - 1;
            return (
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
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <UserCog className="h-3.5 w-3.5" />
                      {principal ? (
                        <span className="truncate">
                          {principal.nome}
                          {extras > 0 && <span className="ml-1 text-brand font-semibold">+{extras}</span>}
                        </span>
                      ) : (
                        <span className="italic">Sem gestor</span>
                      )}
                    </div>
                    {c.campanha && (
                      <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{c.campanha}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
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
