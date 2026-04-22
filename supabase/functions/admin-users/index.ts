// Edge function: admin gerencia usuários (criar/atualizar/deletar)
// e criação combinada user-cliente.
//
// Mudanças de hardening:
// - Cada ação valida o body antes de tocar no banco.
// - Em delete: faz um único select de IDs de criativos e reusa, em vez
//   de duas queries idênticas (corrige risco de inconsistência).
// - Resposta sempre JSON; nunca expõe stack trace ao cliente.
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
  telefone?: string | null;
  grupo_id?: string | null;
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
interface DeleteClienteBody { action: "delete_cliente"; cliente_id: string; }
type Body = CreateBody | UpdateRoleBody | UpdateUserBody | DeleteBody | DeleteClienteBody;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ROLES: ReadonlySet<Role> = new Set(["admin", "gestor", "cliente"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: unknown): s is string {
  return typeof s === "string" && UUID_RE.test(s);
}

function isValidEmail(s: string): boolean {
  // RFC simplificada — suficiente para impedir lixo. O Supabase também valida.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 255;
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
    if (!authHeader) return jsonResponse({ error: "Não autenticado" }, 401);

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

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return jsonResponse({ error: "Body inválido" }, 400);
    }

    // ─────────── CREATE ───────────
    if (body.action === "create") {
      if (!body.email || !isValidEmail(body.email)) return jsonResponse({ error: "Email inválido" }, 400);
      if (!body.password || body.password.length < 6 || body.password.length > 72) {
        return jsonResponse({ error: "Senha deve ter 6–72 caracteres" }, 400);
      }
      if (!body.nome || body.nome.trim().length === 0 || body.nome.length > 120) {
        return jsonResponse({ error: "Nome inválido" }, 400);
      }
      if (!ROLES.has(body.role)) return jsonResponse({ error: "Papel inválido" }, 400);

      if (body.role === "cliente") {
        const c = body.cliente;
        if (!c) return jsonResponse({ error: "Dados do cliente são obrigatórios" }, 400);
        if (!c.nome?.trim() || c.nome.length > 200) return jsonResponse({ error: "Nome do cliente inválido" }, 400);
        if (!c.drive_folder_url || !isValidDriveUrl(c.drive_folder_url)) {
          return jsonResponse({ error: "URL da pasta do Google Drive inválida" }, 400);
        }
        if (!Array.isArray(c.gestor_ids) || !c.gestor_ids.length || !c.gestor_ids.every(isUuid)) {
          return jsonResponse({ error: "Selecione ao menos um gestor válido" }, 400);
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
          // Rollback: remove o auth user para não deixar órfãos.
          await admin.auth.admin.deleteUser(newUserId);
          return jsonResponse({ error: `Erro ao criar cliente: ${cliErr?.message}` }, 400);
        }
        cliente_id = cli.id;

        const links = body.cliente.gestor_ids.map((gid) => ({
          cliente_id: cli.id,
          gestor_id: gid,
        }));
        const { error: linkErr } = await admin.from("cliente_gestores").insert(links);
        if (linkErr) {
          // Rollback total
          await admin.from("clientes").delete().eq("id", cli.id);
          await admin.auth.admin.deleteUser(newUserId);
          return jsonResponse({ error: `Erro ao vincular gestores: ${linkErr.message}` }, 400);
        }
      }

      return jsonResponse({ user_id: newUserId, cliente_id });
    }

    // ─────────── UPDATE ROLE ───────────
    if (body.action === "update_role") {
      if (!isUuid(body.user_id)) return jsonResponse({ error: "user_id inválido" }, 400);
      if (!ROLES.has(body.role)) return jsonResponse({ error: "Papel inválido" }, 400);
      await admin.from("user_roles").delete().eq("user_id", body.user_id);
      await admin.from("user_roles").insert({ user_id: body.user_id, role: body.role });
      return jsonResponse({ ok: true });
    }

    // ─────────── UPDATE USER ───────────
    if (body.action === "update_user") {
      if (!isUuid(body.user_id)) return jsonResponse({ error: "user_id inválido" }, 400);
      if (body.email !== undefined && !isValidEmail(body.email)) {
        return jsonResponse({ error: "Email inválido" }, 400);
      }
      if (body.password && (body.password.length < 6 || body.password.length > 72)) {
        return jsonResponse({ error: "Senha deve ter 6–72 caracteres" }, 400);
      }
      if (body.role && !ROLES.has(body.role)) return jsonResponse({ error: "Papel inválido" }, 400);

      const authUpdate: { email?: string; password?: string } = {};
      if (body.email) authUpdate.email = body.email;
      if (body.password) authUpdate.password = body.password;
      if (Object.keys(authUpdate).length > 0) {
        const { error: authErr } = await admin.auth.admin.updateUserById(body.user_id, authUpdate);
        if (authErr) return jsonResponse({ error: authErr.message }, 400);
      }

      const profileUpdate: Record<string, unknown> = {};
      if (body.nome !== undefined) profileUpdate.nome = body.nome;
      if (body.email !== undefined) profileUpdate.email = body.email;
      if (body.telefone !== undefined) profileUpdate.telefone = body.telefone;
      if (body.grupo_id !== undefined) profileUpdate.grupo_id = body.grupo_id;
      if (Object.keys(profileUpdate).length > 0) {
        const { error: pErr } = await admin.from("profiles").update(profileUpdate).eq("id", body.user_id);
        if (pErr) return jsonResponse({ error: pErr.message }, 400);
      }

      if (body.role) {
        await admin.from("user_roles").delete().eq("user_id", body.user_id);
        await admin.from("user_roles").insert({ user_id: body.user_id, role: body.role });
      }

      return jsonResponse({ ok: true });
    }

    // ─────────── DELETE USER ───────────
    if (body.action === "delete") {
      if (!isUuid(body.user_id)) return jsonResponse({ error: "user_id inválido" }, 400);

      // Não permitir excluir a si mesmo
      if (body.user_id === userData.user.id) {
        return jsonResponse({ error: "Você não pode excluir seu próprio usuário" }, 400);
      }

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
          // Busca IDs de criativos UMA vez (antes era feito 2x).
          const { data: cris } = await admin
            .from("criativos")
            .select("id")
            .in("cliente_id", clienteIds);
          const criativoIds = (cris ?? []).map((c) => c.id);

          await admin.from("cliente_gestores").delete().in("cliente_id", clienteIds);
          if (criativoIds.length) {
            await admin.from("criativo_comentarios").delete().in("criativo_id", criativoIds);
            await admin.from("criativo_versoes").delete().in("criativo_id", criativoIds);
          }
          await admin.from("criativos").delete().in("cliente_id", clienteIds);
          await admin.from("tarefas").delete().in("cliente_id", clienteIds);
          const { error: cliDelErr } = await admin.from("clientes").delete().in("id", clienteIds);
          if (cliDelErr) {
            return jsonResponse({ error: `Erro ao excluir clientes vinculados: ${cliDelErr.message}` }, 400);
          }
        }
      }

      const { error: delErr } = await admin.auth.admin.deleteUser(body.user_id);
      if (delErr) return jsonResponse({ error: delErr.message }, 400);
      return jsonResponse({ ok: true });
    }

    // ─────────── DELETE CLIENTE ───────────
    if (body.action === "delete_cliente") {
      if (!isUuid(body.cliente_id)) return jsonResponse({ error: "cliente_id inválido" }, 400);

      const clienteId = body.cliente_id;
      const { data: crs } = await admin.from("criativos").select("id").eq("cliente_id", clienteId);
      const criativoIds = (crs ?? []).map((c) => c.id);
      if (criativoIds.length) {
        await admin.from("criativo_comentarios").delete().in("criativo_id", criativoIds);
        await admin.from("criativo_versoes").delete().in("criativo_id", criativoIds);
      }
      await admin.from("criativos").delete().eq("cliente_id", clienteId);
      await admin.from("tarefas").delete().eq("cliente_id", clienteId);
      await admin.from("cliente_gestores").delete().eq("cliente_id", clienteId);
      const { error: cliErr } = await admin.from("clientes").delete().eq("id", clienteId);
      if (cliErr) return jsonResponse({ error: cliErr.message }, 400);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("[admin-users] error", e);
    // Não vaza detalhes internos em produção.
    return jsonResponse({ error: "Erro interno. Verifique os logs." }, 500);
  }
});
