import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/RequireAuth";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { roleLabels } from "@/lib/labels";

export const Route = createFileRoute("/app/usuarios/")({
  component: () => (
    <RequireAuth allow={["admin"]}>
      <UsuariosPage />
    </RequireAuth>
  ),
});

type RoleFilter = "all" | "admin" | "gestor" | "cliente";

function UsuariosPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [search, setSearch] = useState("");

  const { data: users } = useQuery({
    queryKey: ["users-list"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, nome, email, created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
      return (profiles ?? []).map((p) => ({ ...p, role: roleMap.get(p.id) ?? null }));
    },
  });

  const { data: gestores } = useQuery({
    queryKey: ["gestores-options"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "gestor");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id, nome").in("id", ids);
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users ?? []).filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!q) return true;
      return u.nome?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    });
  }, [users, roleFilter, search]);

  const callAdmin = async (body: object) => {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Erro");
    return json;
  };

  const create = useMutation({
    mutationFn: (p: object) => callAdmin({ action: "create", ...p }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-list"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setOpen(false);
      toast.success("Usuário criado");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const updateRole = useMutation({
    mutationFn: (p: { user_id: string; role: string }) => callAdmin({ action: "update_role", ...p }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-list"] });
      toast.success("Role atualizada");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: (user_id: string) => callAdmin({ action: "delete", user_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-list"] });
      toast.success("Usuário removido");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Gerencie admins, gestores e clientes do sistema."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Novo usuário</Button>
            </DialogTrigger>
            <NewUserDialog
              gestores={gestores ?? []}
              onSubmit={(p) => create.mutate(p)}
              submitting={create.isPending}
            />
          </Dialog>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Tabs value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="admin">Admins</TabsTrigger>
            <TabsTrigger value="gestor">Gestores</TabsTrigger>
            <TabsTrigger value="cliente">Clientes</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {filtered.map((u) => (
              <div key={u.id} className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium truncate">{u.nome}</div>
                  <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={u.role ?? ""}
                    onValueChange={(v) => updateRole.mutate({ user_id: u.id, role: v })}
                  >
                    <SelectTrigger className="w-32"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleLabels).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" onClick={() => {
                    if (confirm(`Remover ${u.nome}?`)) remove.mutate(u.id);
                  }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="p-10 text-center text-sm text-muted-foreground">
                {(users ?? []).length === 0
                  ? "Nenhum usuário ainda. Crie o primeiro!"
                  : "Nenhum usuário corresponde aos filtros."}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function NewUserDialog({
  gestores, onSubmit, submitting,
}: {
  gestores: Array<{ id: string; nome: string }>;
  onSubmit: (p: object) => void;
  submitting: boolean;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "gestor" | "cliente">("cliente");
  const [telefone, setTelefone] = useState("");
  const [grupoId, setGrupoId] = useState("");

  // Campos extras p/ cliente
  const [clienteNome, setClienteNome] = useState("");
  const [segmento, setSegmento] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [gestorIds, setGestorIds] = useState<string[]>([]);

  const isCliente = role === "cliente";
  const driveValid = !driveUrl || (() => {
    try { const u = new URL(driveUrl); return u.hostname.endsWith("google.com") && u.pathname.includes("/drive/"); }
    catch { return false; }
  })();

  const baseValid = nome && email && password;
  const roleSpecificValid = isCliente ? !!grupoId.trim() : !!telefone.trim();
  const clienteValid = !isCliente || (clienteNome && driveUrl && driveValid && gestorIds.length > 0);
  const canSubmit = baseValid && roleSpecificValid && clienteValid && !submitting;

  const toggleGestor = (id: string) => {
    setGestorIds((prev) => prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]);
  };

  const submit = () => {
    const payload: Record<string, unknown> = {
      nome, email, password, role,
      telefone: isCliente ? null : telefone.trim(),
      grupo_id: isCliente ? grupoId.trim() : null,
    };
    if (isCliente) {
      payload.cliente = {
        nome: clienteNome,
        segmento: segmento || null,
        drive_folder_url: driveUrl,
        gestor_ids: gestorIds,
      };
    }
    onSubmit(payload);
  };

  return (
    <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Nome *</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Senha temporária *</Label>
            <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Papel *</Label>
          <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(roleLabels).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isCliente && (
          <div className="border-t pt-4 space-y-4">
            <div className="text-sm font-semibold">Dados do cliente</div>
            <div className="space-y-2">
              <Label>Nome do cliente *</Label>
              <Input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} placeholder="Ex: Acme Corp" />
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
              <Label>Gestores responsáveis * (selecione um ou mais)</Label>
              {gestores.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum gestor cadastrado. Crie um gestor primeiro.</p>
              ) : (
                <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                  {gestores.map((g) => (
                    <label key={g.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-accent text-sm">
                      <input
                        type="checkbox"
                        checked={gestorIds.includes(g.id)}
                        onChange={() => toggleGestor(g.id)}
                      />
                      {g.nome}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button disabled={!canSubmit} onClick={submit}>
          {submitting ? "Criando…" : "Criar usuário"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
