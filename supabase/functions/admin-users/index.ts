// Edge function: admin gerencia usuários (criar, atualizar role, deletar)
// Apenas usuários com role 'admin' podem chamar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CreateBody {
  action: "create";
  email: string;
  password: string;
  nome: string;
  role: "admin" | "gestor" | "cliente";
}
interface UpdateRoleBody {
  action: "update_role";
  user_id: string;
  role: "admin" | "gestor" | "cliente";
}
interface DeleteBody {
  action: "delete";
  user_id: string;
}
type Body = CreateBody | UpdateRoleBody | DeleteBody;

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
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // checa se o caller é admin
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Apenas admin" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;

    if (body.action === "create") {
      if (!body.email || !body.password || !body.nome || !body.role) {
        return new Response(JSON.stringify({ error: "Campos obrigatórios faltando" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: { nome: body.nome },
      });
      if (createErr || !created.user) {
        return new Response(JSON.stringify({ error: createErr?.message ?? "Erro ao criar" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // garante profile (trigger já cria, mas garante nome)
      await admin.from("profiles").upsert({
        id: created.user.id,
        nome: body.nome,
        email: body.email,
      });
      // role
      await admin.from("user_roles").insert({ user_id: created.user.id, role: body.role });
      return new Response(JSON.stringify({ user_id: created.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "update_role") {
      await admin.from("user_roles").delete().eq("user_id", body.user_id);
      await admin.from("user_roles").insert({ user_id: body.user_id, role: body.role });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "delete") {
      const { error: delErr } = await admin.auth.admin.deleteUser(body.user_id);
      if (delErr) {
        return new Response(JSON.stringify({ error: delErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
