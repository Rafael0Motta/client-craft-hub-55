// Dispatches events to the external n8n webhook.
// Called by DB triggers (createTask, addContentTask) and by the cron job
// (taskDueSoon, taskOverdue).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const WEBHOOK_URL = "https://editor.machinedigital.com.br/webhook/6654e78f-a92b-4f1c-96c7-6cd56fb1cd95";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type EventType = "createTask" | "addContentTask" | "taskDueSoon" | "taskOverdue";

async function buildTaskPayload(tarefaId: string) {
  const { data: tarefa } = await supabase
    .from("tarefas")
    .select("id, titulo, descricao, status, prioridade, prazo, funil, created_at, updated_at, criado_por, cliente_id, tipo_tarefa_id")
    .eq("id", tarefaId)
    .maybeSingle();
  if (!tarefa) return null;

  const [{ data: cliente }, { data: criador }, { data: tipo }, { data: cgs }] = await Promise.all([
    supabase.from("clientes").select("id, nome, segmento, campanha, drive_folder_url, user_id").eq("id", tarefa.cliente_id).maybeSingle(),
    tarefa.criado_por
      ? supabase.from("profiles").select("id, nome, email, telefone").eq("id", tarefa.criado_por).maybeSingle()
      : Promise.resolve({ data: null }),
    tarefa.tipo_tarefa_id
      ? supabase.from("tipos_tarefa").select("id, nome").eq("id", tarefa.tipo_tarefa_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("cliente_gestores").select("gestor_id").eq("cliente_id", tarefa.cliente_id),
  ]);

  const gestorIds = (cgs ?? []).map((g: { gestor_id: string }) => g.gestor_id);
  let gestores: Array<{ id: string; nome: string; email: string; telefone: string | null }> = [];
  if (gestorIds.length) {
    const { data: gs } = await supabase.from("profiles").select("id, nome, email, telefone").in("id", gestorIds);
    gestores = gs ?? [];
  }

  let clienteUser: { id: string; nome: string; email: string; telefone: string | null } | null = null;
  if (cliente?.user_id) {
    const { data } = await supabase.from("profiles").select("id, nome, email, telefone").eq("id", cliente.user_id).maybeSingle();
    clienteUser = data;
  }

  return { tarefa, cliente, clienteUsuario: clienteUser, criadoPor: criador, tipo, gestores };
}

async function buildCreativePayload(criativoId: string, versaoId?: string) {
  const { data: criativo } = await supabase
    .from("criativos")
    .select("id, tarefa_id, cliente_id, arquivo_nome, arquivo_path, arquivo_tipo, link_url, descricao, status, status_operacional, enviado_por, created_at")
    .eq("id", criativoId)
    .maybeSingle();
  if (!criativo) return null;

  const taskPayload = await buildTaskPayload(criativo.tarefa_id);

  let versao = null;
  if (versaoId) {
    const { data } = await supabase
      .from("criativo_versoes")
      .select("id, versao, arquivo_nome, arquivo_path, arquivo_tipo, link_url, descricao, status, enviado_por, created_at")
      .eq("id", versaoId)
      .maybeSingle();
    versao = data;
  }

  const enviadoPorId = versao?.enviado_por ?? criativo.enviado_por;
  let enviadoPor = null;
  if (enviadoPorId) {
    const { data } = await supabase.from("profiles").select("id, nome, email, telefone").eq("id", enviadoPorId).maybeSingle();
    enviadoPor = data;
  }

  return { criativo, versao, enviadoPor, ...(taskPayload ?? {}) };
}

async function send(tipoDeGatilho: EventType, payload: Record<string, unknown>) {
  const body = { tipoDeGatilho, timestamp: new Date().toISOString(), ...payload };
  console.log(`[dispatch-webhook] ${tipoDeGatilho}`, JSON.stringify(body).slice(0, 500));
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error(`[dispatch-webhook] webhook failed ${res.status}: ${txt}`);
  }
  return res.ok;
}

async function checkDueTasks() {
  // Tarefas ainda em aberto (não aprovado, não aguardando_aprovacao)
  const { data: tarefas } = await supabase
    .from("tarefas")
    .select("id, prazo, status")
    .not("prazo", "is", null)
    .not("status", "in", "(aprovado,aguardando_aprovacao)");

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const results: Array<{ id: string; trigger: EventType }> = [];

  for (const t of tarefas ?? []) {
    if (!t.prazo) continue;
    const prazo = new Date(t.prazo + "T00:00:00Z");
    const diffDays = Math.floor((prazo.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 2) {
      const payload = await buildTaskPayload(t.id);
      if (payload) {
        await send("taskDueSoon", payload);
        results.push({ id: t.id, trigger: "taskDueSoon" });
      }
    } else if (diffDays < 0 && Math.abs(diffDays) % 2 === 0) {
      // Vencida: a cada 2 dias após o vencimento (dia -2, -4, -6, ...)
      const payload = await buildTaskPayload(t.id);
      if (payload) {
        await send("taskOverdue", { ...payload, diasVencida: Math.abs(diffDays) });
        results.push({ id: t.id, trigger: "taskOverdue" });
      }
    }
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const event = body.event as EventType | "cron";

    if (event === "createTask" && body.tarefa_id) {
      const payload = await buildTaskPayload(body.tarefa_id);
      if (payload) await send("createTask", payload);
    } else if (event === "addContentTask" && body.criativo_id) {
      const payload = await buildCreativePayload(body.criativo_id, body.versao_id);
      if (payload) await send("addContentTask", payload);
    } else if (event === "cron") {
      const results = await checkDueTasks();
      return new Response(JSON.stringify({ ok: true, processed: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      return new Response(JSON.stringify({ error: "unknown event" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[dispatch-webhook] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
