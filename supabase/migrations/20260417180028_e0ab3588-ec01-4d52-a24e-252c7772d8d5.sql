-- Drop políticas dependentes
DROP POLICY IF EXISTS "Gestor vê profiles relacionados aos seus clientes" ON public.profiles;
DROP POLICY IF EXISTS "Gestor vê clientes atribuídos" ON public.clientes;
DROP POLICY IF EXISTS "Gestor edita seus clientes" ON public.clientes;

-- 1) cliente_gestores
CREATE TABLE IF NOT EXISTS public.cliente_gestores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  gestor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, gestor_id)
);
ALTER TABLE public.cliente_gestores ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND column_name='gestor_id') THEN
    INSERT INTO public.cliente_gestores (cliente_id, gestor_id)
    SELECT id, gestor_id FROM public.clientes WHERE gestor_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_gestor_of_cliente(_user_id uuid, _cliente_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.cliente_gestores WHERE cliente_id = _cliente_id AND gestor_id = _user_id)
$$;

ALTER TABLE public.clientes DROP COLUMN IF EXISTS gestor_id;

CREATE POLICY "Gestor vê clientes atribuídos" ON public.clientes FOR SELECT TO public
USING (is_gestor_of_cliente(auth.uid(), id));

CREATE POLICY "Gestor edita seus clientes" ON public.clientes FOR UPDATE TO public
USING (is_gestor_of_cliente(auth.uid(), id));

CREATE POLICY "Gestor vê profiles relacionados aos seus clientes" ON public.profiles FOR SELECT TO public
USING (
  has_role(auth.uid(), 'gestor'::app_role) AND (
    EXISTS (SELECT 1 FROM public.clientes c JOIN public.cliente_gestores cg ON cg.cliente_id = c.id WHERE cg.gestor_id = auth.uid() AND c.user_id = profiles.id)
    OR id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admin gerencia cliente_gestores" ON public.cliente_gestores;
DROP POLICY IF EXISTS "Gestor vê seus vínculos" ON public.cliente_gestores;
DROP POLICY IF EXISTS "Cliente vê gestores do seu cadastro" ON public.cliente_gestores;

CREATE POLICY "Admin gerencia cliente_gestores" ON public.cliente_gestores FOR ALL TO public
USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Gestor vê seus vínculos" ON public.cliente_gestores FOR SELECT TO public
USING (gestor_id = auth.uid());
CREATE POLICY "Cliente vê gestores do seu cadastro" ON public.cliente_gestores FOR SELECT TO public
USING (is_user_of_cliente(auth.uid(), cliente_id));

-- 2) drive_folder_url
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS drive_folder_url text;

-- 3) criativo_versoes
CREATE TABLE IF NOT EXISTS public.criativo_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criativo_id uuid NOT NULL REFERENCES public.criativos(id) ON DELETE CASCADE,
  versao integer NOT NULL,
  arquivo_path text NOT NULL,
  arquivo_nome text NOT NULL,
  arquivo_tipo text,
  status public.creative_status NOT NULL DEFAULT 'pendente_aprovacao',
  enviado_por uuid,
  revisado_por uuid,
  revisado_em timestamptz,
  comentario_revisao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (criativo_id, versao)
);
ALTER TABLE public.criativo_versoes ENABLE ROW LEVEL SECURITY;

INSERT INTO public.criativo_versoes (criativo_id, versao, arquivo_path, arquivo_nome, arquivo_tipo, status, enviado_por, revisado_por, revisado_em, comentario_revisao, created_at)
SELECT c.id, 1, c.arquivo_path, c.arquivo_nome, c.arquivo_tipo, c.status, c.enviado_por, c.revisado_por, c.revisado_em, c.comentario_revisao, c.created_at
FROM public.criativos c
WHERE NOT EXISTS (SELECT 1 FROM public.criativo_versoes v WHERE v.criativo_id = c.id);

DROP POLICY IF EXISTS "Admin gerencia versoes" ON public.criativo_versoes;
DROP POLICY IF EXISTS "Ver versoes se vê o criativo" ON public.criativo_versoes;
DROP POLICY IF EXISTS "Cliente envia nova versao" ON public.criativo_versoes;
DROP POLICY IF EXISTS "Gestor revisa versao" ON public.criativo_versoes;

CREATE POLICY "Admin gerencia versoes" ON public.criativo_versoes FOR ALL TO public
USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Ver versoes se vê o criativo" ON public.criativo_versoes FOR SELECT TO public
USING (EXISTS (SELECT 1 FROM public.criativos c WHERE c.id = criativo_versoes.criativo_id
  AND (has_role(auth.uid(), 'admin'::app_role) OR is_gestor_of_cliente(auth.uid(), c.cliente_id) OR is_user_of_cliente(auth.uid(), c.cliente_id))));

CREATE POLICY "Cliente envia nova versao" ON public.criativo_versoes FOR INSERT TO public
WITH CHECK (enviado_por = auth.uid() AND EXISTS (SELECT 1 FROM public.criativos c WHERE c.id = criativo_versoes.criativo_id AND is_user_of_cliente(auth.uid(), c.cliente_id)));

CREATE POLICY "Gestor revisa versao" ON public.criativo_versoes FOR UPDATE TO public
USING (EXISTS (SELECT 1 FROM public.criativos c WHERE c.id = criativo_versoes.criativo_id AND is_gestor_of_cliente(auth.uid(), c.cliente_id)));

-- 4) Trigger sync
CREATE OR REPLACE FUNCTION public.sync_tarefa_status_from_versao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _tarefa_id uuid;
BEGIN
  SELECT tarefa_id INTO _tarefa_id FROM public.criativos WHERE id = NEW.criativo_id;
  IF _tarefa_id IS NULL THEN RETURN NEW; END IF;

  UPDATE public.criativos
    SET status = NEW.status, comentario_revisao = NEW.comentario_revisao,
        revisado_por = NEW.revisado_por, revisado_em = NEW.revisado_em,
        arquivo_path = NEW.arquivo_path, arquivo_nome = NEW.arquivo_nome, arquivo_tipo = NEW.arquivo_tipo,
        updated_at = now()
  WHERE id = NEW.criativo_id;

  IF NEW.status = 'aprovado' THEN
    UPDATE public.tarefas SET status = 'aprovado', updated_at = now() WHERE id = _tarefa_id;
  ELSIF NEW.status = 'reprovado' THEN
    UPDATE public.tarefas SET status = 'em_andamento', updated_at = now() WHERE id = _tarefa_id;
  ELSE
    UPDATE public.tarefas SET status = 'aguardando_aprovacao', updated_at = now() WHERE id = _tarefa_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tarefa_status_from_versao ON public.criativo_versoes;
CREATE TRIGGER trg_sync_tarefa_status_from_versao
AFTER INSERT OR UPDATE OF status ON public.criativo_versoes
FOR EACH ROW EXECUTE FUNCTION public.sync_tarefa_status_from_versao();

-- updated_at triggers (idempotente)
DROP TRIGGER IF EXISTS trg_clientes_updated ON public.clientes;
CREATE TRIGGER trg_clientes_updated BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_criativos_updated ON public.criativos;
CREATE TRIGGER trg_criativos_updated BEFORE UPDATE ON public.criativos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_tarefas_updated ON public.tarefas;
CREATE TRIGGER trg_tarefas_updated BEFORE UPDATE ON public.tarefas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_cliente_gestores_gestor ON public.cliente_gestores(gestor_id);
CREATE INDEX IF NOT EXISTS idx_cliente_gestores_cliente ON public.cliente_gestores(cliente_id);
CREATE INDEX IF NOT EXISTS idx_criativo_versoes_criativo ON public.criativo_versoes(criativo_id);