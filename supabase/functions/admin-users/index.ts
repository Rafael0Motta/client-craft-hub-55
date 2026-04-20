// Edge function: admin gerencia usuários (criar/atualizar/deletar)
// e criação combinada user-cliente (user + profile + role + clientes + cliente_gestores)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Role = "admin" | "gestor" | "cliente";

interface CreateBody {
  action: "create";
  email: string;
  password: string;
  nome: string;
  role: Role;
  // Campo opcional para admin/gestor
  telefone?: string | null;
  // Campo opcional para cliente
  grupo_id?: string | null;
  // Quando role = "cliente", obrigatório:
  cliente?: {
    nome: string;
    segmento?: string | null;
    drive_folder_url: string;
    gestor_ids: string[];
  };
}
interface UpdateRoleBody { action: "update_role"; user_id: string; role: Role; }
interface UpdateUserBody {
  action: "update_user";
  user_id: string;
  nome?: string;
  email?: string;
  password?: string | null;
  role?: Role;
  telefone?: string | null;
  grupo_id?: string | null;
}
interface DeleteBody { action: "delete"; user_id: string; }
type Body = CreateBody | UpdateRoleBody | UpdateUserBody | DeleteBody;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidDriveUrl(url: string) {
  try {
    const u = new URL(url);
    return u.hostname.endsWith("google.com") && u.pathname.includes("/drive/");
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return jsonResponse({ error: "Não autenticado" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return jsonResponse({ error: "Apenas admin" }, 403);

    const body = (await req.json()) as Body;

    if (body.action === "create") {
      if (!body.email || !body.password || !body.nome || !body.role) {
        return jsonResponse({ error: "Campos obrigatórios faltando" }, 400);
      }

      // Validação extra para cliente
      if (body.role === "cliente") {
        if (!body.cliente) return jsonResponse({ error: "Dados do cliente são obrigatórios" }, 400);
        if (!body.cliente.nome) return jsonResponse({ error: "Nome do cliente obrigatório" }, 400);
        if (!body.cliente.drive_folder_url || !isValidDriveUrl(body.cliente.drive_folder_url)) {
          return jsonResponse({ error: "URL da pasta do Google Drive inválida" }, 400);
        }
        if (!body.cliente.gestor_ids?.length) {
          return jsonResponse({ error: "Selecione ao menos um gestor responsável" }, 400);
        }
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: { nome: body.nome },
      });
      if (createErr || !created.user) {
        return jsonResponse({ error: createErr?.message ?? "Erro ao criar" }, 400);
      }

      const newUserId = created.user.id;

      await admin.from("profiles").upsert({
        id: newUserId,
        nome: body.nome,
        email: body.email,
        telefone: body.role === "cliente" ? null : (body.telefone ?? null),
        grupo_id: body.role === "cliente" ? (body.grupo_id ?? null) : null,
      });
      await admin.from("user_roles").insert({ user_id: newUserId, role: body.role });

      let cliente_id: string | null = null;
      if (body.role === "cliente" && body.cliente) {
        const { data: cli, error: cliErr } = await admin
          .from("clientes")
          .insert({
            nome: body.cliente.nome,
            segmento: body.cliente.segmento ?? null,
            drive_folder_url: body.cliente.drive_folder_url,
            user_id: newUserId,
          })
          .select("id")
          .single();
        if (cliErr || !cli) {
          // Rollback parcial: remove user
          await admin.auth.admin.deleteUser(newUserId);
          return jsonResponse({ error: `Erro ao criar cliente: ${cliErr?.message}` }, 400);
        }
        cliente_id = cli.id;

        const links = body.cliente.gestor_ids.map((gid) => ({
          cliente_id: cli.id,
          gestor_id: gid,
        }));
        await admin.from("cliente_gestores").insert(links);
      }

      return jsonResponse({ user_id: newUserId, cliente_id });
    }

    if (body.action === "update_role") {
      await admin.from("user_roles").delete().eq("user_id", body.user_id);
      await admin.from("user_roles").insert({ user_id: body.user_id, role: body.role });
      return jsonResponse({ ok: true });
    }

    if (body.action === "update_user") {
      // Atualiza auth (email/senha) se fornecidos
      const authUpdate: { email?: string; password?: string } = {};
      if (body.email) authUpdate.email = body.email;
      if (body.password) authUpdate.password = body.password;
      if (Object.keys(authUpdate).length > 0) {
        const { error: authErr } = await admin.auth.admin.updateUserById(body.user_id, authUpdate);
        if (authErr) return jsonResponse({ error: authErr.message }, 400);
      }

      // Atualiza profile
      const profileUpdate: Record<string, unknown> = {};
      if (body.nome !== undefined) profileUpdate.nome = body.nome;
      if (body.email !== undefined) profileUpdate.email = body.email;
      if (body.telefone !== undefined) profileUpdate.telefone = body.telefone;
      if (body.grupo_id !== undefined) profileUpdate.grupo_id = body.grupo_id;
      if (Object.keys(profileUpdate).length > 0) {
        const { error: pErr } = await admin.from("profiles").update(profileUpdate).eq("id", body.user_id);
        if (pErr) return jsonResponse({ error: pErr.message }, 400);
      }

      // Atualiza role se fornecida
      if (body.role) {
        await admin.from("user_roles").delete().eq("user_id", body.user_id);
        await admin.from("user_roles").insert({ user_id: body.user_id, role: body.role });
      }

      return jsonResponse({ ok: true });
    }

    if (body.action === "delete") {
      // Verifica se é cliente; se sim, remove os clientes vinculados (e cascata: cliente_gestores, tarefas, criativos via FKs)
      const { data: roleRows } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", body.user_id);
      const isCliente = (roleRows ?? []).some((r) => r.role === "cliente");

      if (isCliente) {
        const { data: clis } = await admin
          .from("clientes")
          .select("id")
          .eq("user_id", body.user_id);
        const clienteIds = (clis ?? []).map((c) => c.id);
        if (clienteIds.length) {
          // Remove dependências que podem não ter ON DELETE CASCADE
          await admin.from("cliente_gestores").delete().in("cliente_id", clienteIds);
          await admin.from("criativo_comentarios").delete().in("criativo_id",
            ((await admin.from("criativos").select("id").in("cliente_id", clienteIds)).data ?? []).map((c) => c.id),
          );
          await admin.from("criativo_versoes").delete().in("criativo_id",
            ((await admin.from("criativos").select("id").in("cliente_id", clienteIds)).data ?? []).map((c) => c.id),
          );
          await admin.from("criativos").delete().in("cliente_id", clienteIds);
          await admin.from("tarefas").delete().in("cliente_id", clienteIds);
          const { error: cliDelErr } = await admin.from("clientes").delete().in("id", clienteIds);
          if (cliDelErr) return jsonResponse({ error: `Erro ao excluir clientes vinculados: ${cliDelErr.message}` }, 400);
        }
      }

      const { error: delErr } = await admin.auth.admin.deleteUser(body.user_id);
      if (delErr) return jsonResponse({ error: delErr.message }, 400);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Ação inválida" }, 400);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
