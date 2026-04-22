-- =========================================================
-- 1. COMENTÁRIOS EM TAREFAS
-- =========================================================
CREATE TABLE public.tarefa_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  autor_id UUID,
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tarefa_comentarios ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tarefa_comentarios_tarefa ON public.tarefa_comentarios(tarefa_id, created_at DESC);

CREATE POLICY "Ver comentários se vê a tarefa"
ON public.tarefa_comentarios FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.tarefas t WHERE t.id = tarefa_comentarios.tarefa_id AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_gestor_of_cliente(auth.uid(), t.cliente_id)
    OR public.is_user_of_cliente(auth.uid(), t.cliente_id)
  ))
);

CREATE POLICY "Comentar se vê a tarefa"
ON public.tarefa_comentarios FOR INSERT
WITH CHECK (
  autor_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.tarefas t WHERE t.id = tarefa_comentarios.tarefa_id AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_gestor_of_cliente(auth.uid(), t.cliente_id)
      OR public.is_user_of_cliente(auth.uid(), t.cliente_id)
    )
  )
);

CREATE POLICY "Autor edita seu comentário"
ON public.tarefa_comentarios FOR UPDATE USING (autor_id = auth.uid());

CREATE POLICY "Autor ou admin exclui comentário"
ON public.tarefa_comentarios FOR DELETE
USING (autor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_tarefa_comentarios_updated_at
BEFORE UPDATE ON public.tarefa_comentarios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 2. TIMELINE DE ATIVIDADES
-- =========================================================
CREATE TYPE public.activity_type AS ENUM (
  'tarefa_criada','tarefa_status_alterado','criativo_enviado',
  'criativo_aprovado','criativo_reprovado','comentario_adicionado'
);

CREATE TABLE public.tarefa_atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  ator_id UUID,
  tipo public.activity_type NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tarefa_atividades ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tarefa_atividades_tarefa ON public.tarefa_atividades(tarefa_id, created_at DESC);

CREATE POLICY "Ver atividades se vê a tarefa"
ON public.tarefa_atividades FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.tarefas t WHERE t.id = tarefa_atividades.tarefa_id AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_gestor_of_cliente(auth.uid(), t.cliente_id)
    OR public.is_user_of_cliente(auth.uid(), t.cliente_id)
  ))
);

-- =========================================================
-- 3. NOTIFICAÇÕES
-- =========================================================
CREATE TYPE public.notification_type AS ENUM (
  'tarefa_atribuida','tarefa_status_alterado','criativo_pendente',
  'criativo_aprovado','criativo_reprovado','comentario_tarefa','comentario_criativo'
);

CREATE TABLE public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tipo public.notification_type NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT,
  link TEXT,
  tarefa_id UUID REFERENCES public.tarefas(id) ON DELETE CASCADE,
  criativo_id UUID REFERENCES public.criativos(id) ON DELETE CASCADE,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notificacoes_user_lida ON public.notificacoes(user_id, lida, created_at DESC);

CREATE POLICY "Usuário vê suas notificações"
ON public.notificacoes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Usuário marca suas notificações"
ON public.notificacoes FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Usuário deleta suas notificações"
ON public.notificacoes FOR DELETE USING (user_id = auth.uid());

-- =========================================================
-- 4. TRIGGERS
-- =========================================================
CREATE OR REPLACE FUNCTION public._notif_recipients(_tarefa_id UUID, _ator_id UUID)
RETURNS TABLE(user_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT u FROM (
    SELECT cg.gestor_id AS u FROM public.tarefas t
    JOIN public.cliente_gestores cg ON cg.cliente_id = t.cliente_id
    WHERE t.id = _tarefa_id
    UNION
    SELECT c.user_id AS u FROM public.tarefas t
    JOIN public.clientes c ON c.id = t.cliente_id
    WHERE t.id = _tarefa_id AND c.user_id IS NOT NULL
  ) s
  WHERE u IS NOT NULL AND u <> COALESCE(_ator_id, '00000000-0000-0000-0000-000000000000'::uuid);
$$;

CREATE OR REPLACE FUNCTION public.trg_tarefa_atividade_criada()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.tarefa_atividades(tarefa_id, ator_id, tipo, metadata)
  VALUES (NEW.id, NEW.criado_por, 'tarefa_criada',
    jsonb_build_object('titulo', NEW.titulo, 'cliente_id', NEW.cliente_id));
  INSERT INTO public.notificacoes(user_id, tipo, titulo, mensagem, link, tarefa_id)
  SELECT r.user_id, 'tarefa_atribuida', 'Nova tarefa: ' || NEW.titulo,
    'Uma nova tarefa foi criada.', '/app/tarefas/' || NEW.id::text, NEW.id
  FROM public._notif_recipients(NEW.id, NEW.criado_por) r;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_tarefa_after_insert
AFTER INSERT ON public.tarefas
FOR EACH ROW EXECUTE FUNCTION public.trg_tarefa_atividade_criada();

CREATE OR REPLACE FUNCTION public.trg_tarefa_atividade_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.tarefa_atividades(tarefa_id, ator_id, tipo, metadata)
    VALUES (NEW.id, auth.uid(), 'tarefa_status_alterado',
      jsonb_build_object('de', OLD.status, 'para', NEW.status));
    INSERT INTO public.notificacoes(user_id, tipo, titulo, mensagem, link, tarefa_id)
    SELECT r.user_id, 'tarefa_status_alterado', 'Status alterado: ' || NEW.titulo,
      'Status mudou de ' || OLD.status::text || ' para ' || NEW.status::text,
      '/app/tarefas/' || NEW.id::text, NEW.id
    FROM public._notif_recipients(NEW.id, auth.uid()) r;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_tarefa_after_update_status
AFTER UPDATE OF status ON public.tarefas
FOR EACH ROW EXECUTE FUNCTION public.trg_tarefa_atividade_status();

CREATE OR REPLACE FUNCTION public.trg_criativo_atividade_enviado()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.tarefa_atividades(tarefa_id, ator_id, tipo, metadata)
  VALUES (NEW.tarefa_id, NEW.enviado_por, 'criativo_enviado',
    jsonb_build_object('criativo_id', NEW.id, 'arquivo_nome', NEW.arquivo_nome));
  INSERT INTO public.notificacoes(user_id, tipo, titulo, mensagem, link, tarefa_id, criativo_id)
  SELECT r.user_id, 'criativo_pendente', 'Novo criativo aguardando aprovação',
    NEW.arquivo_nome, '/app/tarefas/' || NEW.tarefa_id::text, NEW.tarefa_id, NEW.id
  FROM public._notif_recipients(NEW.tarefa_id, NEW.enviado_por) r;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_criativo_after_insert
AFTER INSERT ON public.criativos
FOR EACH ROW EXECUTE FUNCTION public.trg_criativo_atividade_enviado();

CREATE OR REPLACE FUNCTION public.trg_criativo_atividade_revisao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tipo public.activity_type; _ntipo public.notification_type; _label TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('aprovado','reprovado') THEN
    IF NEW.status = 'aprovado' THEN
      _tipo := 'criativo_aprovado'; _ntipo := 'criativo_aprovado'; _label := 'Criativo aprovado';
    ELSE
      _tipo := 'criativo_reprovado'; _ntipo := 'criativo_reprovado'; _label := 'Criativo reprovado';
    END IF;
    INSERT INTO public.tarefa_atividades(tarefa_id, ator_id, tipo, metadata)
    VALUES (NEW.tarefa_id, NEW.revisado_por, _tipo,
      jsonb_build_object('criativo_id', NEW.id, 'arquivo_nome', NEW.arquivo_nome,
                         'comentario', NEW.comentario_revisao));
    INSERT INTO public.notificacoes(user_id, tipo, titulo, mensagem, link, tarefa_id, criativo_id)
    SELECT r.user_id, _ntipo, _label, NEW.arquivo_nome,
      '/app/tarefas/' || NEW.tarefa_id::text, NEW.tarefa_id, NEW.id
    FROM public._notif_recipients(NEW.tarefa_id, NEW.revisado_por) r;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_criativo_after_update_status
AFTER UPDATE OF status ON public.criativos
FOR EACH ROW EXECUTE FUNCTION public.trg_criativo_atividade_revisao();

CREATE OR REPLACE FUNCTION public.trg_tarefa_comentario_atividade()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _titulo TEXT;
BEGIN
  SELECT titulo INTO _titulo FROM public.tarefas WHERE id = NEW.tarefa_id;
  INSERT INTO public.tarefa_atividades(tarefa_id, ator_id, tipo, metadata)
  VALUES (NEW.tarefa_id, NEW.autor_id, 'comentario_adicionado',
    jsonb_build_object('comentario_id', NEW.id, 'preview', LEFT(NEW.texto, 140)));
  INSERT INTO public.notificacoes(user_id, tipo, titulo, mensagem, link, tarefa_id)
  SELECT r.user_id, 'comentario_tarefa',
    'Novo comentário em: ' || COALESCE(_titulo, 'tarefa'),
    LEFT(NEW.texto, 200), '/app/tarefas/' || NEW.tarefa_id::text, NEW.tarefa_id
  FROM public._notif_recipients(NEW.tarefa_id, NEW.autor_id) r;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_tarefa_comentario_after_insert
AFTER INSERT ON public.tarefa_comentarios
FOR EACH ROW EXECUTE FUNCTION public.trg_tarefa_comentario_atividade();

-- =========================================================
-- 5. REALTIME (apenas as novas tabelas)
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.tarefa_comentarios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tarefa_atividades;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;

ALTER TABLE public.tarefa_comentarios REPLICA IDENTITY FULL;
ALTER TABLE public.tarefa_atividades REPLICA IDENTITY FULL;
ALTER TABLE public.notificacoes REPLICA IDENTITY FULL;