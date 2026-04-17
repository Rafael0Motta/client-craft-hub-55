-- 1. Enum para funil
DO $$ BEGIN
  CREATE TYPE public.funil_classificacao AS ENUM ('topo', 'meio', 'fundo');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Enum para status operacional de criativos
DO $$ BEGIN
  CREATE TYPE public.creative_op_status AS ENUM ('ativo', 'desativado', 'standby');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Tabela de tipos de tarefa
CREATE TABLE IF NOT EXISTS public.tipos_tarefa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tipos_tarefa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos autenticados veem tipos" ON public.tipos_tarefa;
CREATE POLICY "Todos autenticados veem tipos"
  ON public.tipos_tarefa FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin e gestor criam tipos" ON public.tipos_tarefa;
CREATE POLICY "Admin e gestor criam tipos"
  ON public.tipos_tarefa FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
  );

DROP POLICY IF EXISTS "Admin gerencia tipos" ON public.tipos_tarefa;
CREATE POLICY "Admin gerencia tipos"
  ON public.tipos_tarefa FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Seed dos tipos iniciais
INSERT INTO public.tipos_tarefa (nome) VALUES ('Criativo'), ('Acessos')
ON CONFLICT (nome) DO NOTHING;

-- 5. Adicionar colunas em tarefas
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS tipo_tarefa_id uuid REFERENCES public.tipos_tarefa(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS funil public.funil_classificacao;

-- Backfill: tarefas existentes recebem tipo "Criativo"
UPDATE public.tarefas
SET tipo_tarefa_id = (SELECT id FROM public.tipos_tarefa WHERE nome = 'Criativo' LIMIT 1)
WHERE tipo_tarefa_id IS NULL;

-- 6. Adicionar status operacional em criativos
ALTER TABLE public.criativos
  ADD COLUMN IF NOT EXISTS status_operacional public.creative_op_status NOT NULL DEFAULT 'ativo';

-- 7. Adicionar campos em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS grupo_id text;