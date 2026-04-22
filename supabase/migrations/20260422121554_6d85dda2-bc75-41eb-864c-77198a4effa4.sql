-- ============================================================
-- Performance indexes (CONCURRENTLY não pode em migration; usar CREATE INDEX IF NOT EXISTS)
-- ============================================================

-- Tarefas: filtros por cliente+status, prazo
CREATE INDEX IF NOT EXISTS idx_tarefas_cliente_id ON public.tarefas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_status ON public.tarefas (status);
CREATE INDEX IF NOT EXISTS idx_tarefas_cliente_status ON public.tarefas (cliente_id, status);
CREATE INDEX IF NOT EXISTS idx_tarefas_created_at ON public.tarefas (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tarefas_prazo ON public.tarefas (prazo) WHERE prazo IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tarefas_criado_por ON public.tarefas (criado_por);

-- Criativos
CREATE INDEX IF NOT EXISTS idx_criativos_tarefa_id ON public.criativos (tarefa_id);
CREATE INDEX IF NOT EXISTS idx_criativos_cliente_id ON public.criativos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_criativos_status ON public.criativos (status);
CREATE INDEX IF NOT EXISTS idx_criativos_created_at ON public.criativos (created_at DESC);

-- Versões / comentários de criativo
CREATE INDEX IF NOT EXISTS idx_criativo_versoes_criativo_id ON public.criativo_versoes (criativo_id, versao DESC);
CREATE INDEX IF NOT EXISTS idx_criativo_comentarios_criativo_id ON public.criativo_comentarios (criativo_id, created_at);

-- Tarefa colaborativa: comentários e atividades
CREATE INDEX IF NOT EXISTS idx_tarefa_comentarios_tarefa_id ON public.tarefa_comentarios (tarefa_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tarefa_atividades_tarefa_id ON public.tarefa_atividades (tarefa_id, created_at);

-- Notificações: quase toda query é por user_id, lida e created_at
CREATE INDEX IF NOT EXISTS idx_notificacoes_user_created ON public.notificacoes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_user_unread ON public.notificacoes (user_id, lida) WHERE lida = false;

-- Cliente / vínculos
CREATE INDEX IF NOT EXISTS idx_clientes_user_id ON public.clientes (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cliente_gestores_cliente_id ON public.cliente_gestores (cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_gestores_gestor_id ON public.cliente_gestores (gestor_id);

-- Roles / profiles
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);

-- Webhook logs (usado em listagem com order desc)
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON public.webhook_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_tipo ON public.webhook_logs (tipo_gatilho);

-- ============================================================
-- Hardening: comentários só do autor podem ser editados (idempotente — policy já existe, mas garantimos texto não vazio)
-- ============================================================
ALTER TABLE public.tarefa_comentarios
  DROP CONSTRAINT IF EXISTS tarefa_comentarios_texto_nao_vazio;
ALTER TABLE public.tarefa_comentarios
  ADD CONSTRAINT tarefa_comentarios_texto_nao_vazio
  CHECK (length(btrim(texto)) > 0 AND length(texto) <= 5000);

-- Limites para títulos e descrições de tarefa (evita DoS por payload gigante)
ALTER TABLE public.tarefas
  DROP CONSTRAINT IF EXISTS tarefas_titulo_check;
ALTER TABLE public.tarefas
  ADD CONSTRAINT tarefas_titulo_check
  CHECK (length(btrim(titulo)) BETWEEN 1 AND 200);

ALTER TABLE public.tarefas
  DROP CONSTRAINT IF EXISTS tarefas_descricao_check;
ALTER TABLE public.tarefas
  ADD CONSTRAINT tarefas_descricao_check
  CHECK (descricao IS NULL OR length(descricao) <= 10000);

-- Limite para nome de cliente
ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_nome_check;
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_nome_check
  CHECK (length(btrim(nome)) BETWEEN 1 AND 200);

-- Trigger de updated_at em tarefa_comentarios (estava faltando)
DROP TRIGGER IF EXISTS update_tarefa_comentarios_updated_at ON public.tarefa_comentarios;
CREATE TRIGGER update_tarefa_comentarios_updated_at
  BEFORE UPDATE ON public.tarefa_comentarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();