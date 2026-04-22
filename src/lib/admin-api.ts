// Wrapper único para chamadas ao edge function `admin-users`.
// Antes esse fetch estava duplicado em app.usuarios.index.tsx e
// app.clientes.$id.tsx — qualquer mudança de URL/headers implicava editar
// ambos os arquivos. Centralizar aqui também simplifica adicionar
// retry/timeout/observabilidade no futuro.
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? (typeof window !== "undefined" ? window.__ENV?.SUPABASE_URL : undefined);
const SUPABASE_ANON =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  (typeof window !== "undefined" ? window.__ENV?.SUPABASE_PUBLISHABLE_KEY : undefined);

async function callEdge(fn: string, body: unknown): Promise<unknown> {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    throw new Error("Configuração do Supabase ausente.");
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  // Tenta JSON; cai para texto se vier vazio.
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    const msg =
      (parsed as { error?: string } | null)?.error ?? `Erro HTTP ${res.status}`;
    throw new Error(msg);
  }
  return parsed;
}

export const adminApi = {
  call: (body: object) => callEdge("admin-users", { ...body }),
  dispatchWebhook: (body: object) => callEdge("dispatch-webhook", body),
};
