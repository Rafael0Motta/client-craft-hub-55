import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { roleLabels } from "@/lib/labels";

export const Route = createFileRoute("/app/usuarios/")({
  component: () => (
    <RequireAuth allow={["admin"]}>
      <UsuariosPage />
    </RequireAuth>
  ),
});

function UsuariosPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

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
    mutationFn: (p: { email: string; password: string; nome: string; role: string }) =>
      callAdmin({ action: "create", ...p }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-list"] });
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
            <NewUserDialog onSubmit={(p) => create.mutate(p)} submitting={create.isPending} />
          </Dialog>
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {(users ?? []).map((u) => (
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
            {(users ?? []).length === 0 && (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Nenhum usuário ainda. Crie o primeiro!
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function NewUserDialog({
  onSubmit, submitting,
}: {
  onSubmit: (p: { email: string; password: string; nome: string; role: string }) => void;
  submitting: boolean;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("cliente");

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Nome *</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Email *</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Senha temporária *</Label>
          <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Papel *</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(roleLabels).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={!nome || !email || !password || submitting}
          onClick={() => onSubmit({ nome, email, password, role })}
        >
          {submitting ? "Criando…" : "Criar usuário"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
