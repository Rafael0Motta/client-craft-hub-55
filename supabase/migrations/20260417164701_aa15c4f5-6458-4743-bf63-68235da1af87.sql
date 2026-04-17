
-- ============================================
-- OldLab Client System - Schema inicial
-- ============================================

-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'cliente');
CREATE TYPE public.task_status AS ENUM ('pendente', 'em_andamento', 'aguardando_aprovacao', 'aprovado');
CREATE TYPE public.task_priority AS ENUM ('baixa', 'media', 'alta', 'urgente');
CREATE TYPE public.creative_status AS ENUM ('pendente_aprovacao', 'aprovado', 'reprovado');

-- ============================================
-- profiles (1:1 com auth.users)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- user_roles (separada por segurança)
-- ============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função security definer para checar role (evita recursão em RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Função utilitária: pega a role "principal" do usuário (prioridade admin > gestor > cliente)
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'admin' THEN 1
    WHEN 'gestor' THEN 2
    WHEN 'cliente' THEN 3
  END
  LIMIT 1
$$;

-- ============================================
-- clientes
-- ============================================
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  segmento TEXT,
  campanha TEXT,
  gestor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- usuário-cliente (login do cliente)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_clientes_gestor ON public.clientes(gestor_id);
CREATE INDEX idx_clientes_user ON public.clientes(user_id);

-- ============================================
-- tarefas
-- ============================================
CREATE TABLE public.tarefas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status public.task_status NOT NULL DEFAULT 'pendente',
  prioridade public.task_priority NOT NULL DEFAULT 'media',
  prazo DATE,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tarefas_cliente ON public.tarefas(cliente_id);
CREATE INDEX idx_tarefas_status ON public.tarefas(status);

-- ============================================
-- criativos
-- ============================================
CREATE TABLE public.criativos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  enviado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  arquivo_path TEXT NOT NULL,
  arquivo_nome TEXT NOT NULL,
  arquivo_tipo TEXT,
  status public.creative_status NOT NULL DEFAULT 'pendente_aprovacao',
  revisado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revisado_em TIMESTAMPTZ,
  comentario_revisao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.criativos ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_criativos_tarefa ON public.criativos(tarefa_id);
CREATE INDEX idx_criativos_cliente ON public.criativos(cliente_id);
CREATE INDEX idx_criativos_status ON public.criativos(status);

-- ============================================
-- comentarios em criativos
-- ============================================
CREATE TABLE public.criativo_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  criativo_id UUID NOT NULL REFERENCES public.criativos(id) ON DELETE CASCADE,
  autor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.criativo_comentarios ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_comentarios_criativo ON public.criativo_comentarios(criativo_id);

-- ============================================
-- Trigger updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_clientes_updated BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tarefas_updated BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_criativos_updated BEFORE UPDATE ON public.criativos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Trigger: cria profile automaticamente ao criar usuário
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Helpers de RLS
-- ============================================
-- Verifica se o usuário é gestor responsável pelo cliente
CREATE OR REPLACE FUNCTION public.is_gestor_of_cliente(_user_id UUID, _cliente_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clientes
    WHERE id = _cliente_id AND gestor_id = _user_id
  )
$$;

-- Verifica se o usuário é o cliente vinculado
CREATE OR REPLACE FUNCTION public.is_user_of_cliente(_user_id UUID, _cliente_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clientes
    WHERE id = _cliente_id AND user_id = _user_id
  )
$$;

-- ============================================
-- RLS: profiles
-- ============================================
CREATE POLICY "Usuário vê seu próprio profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admin vê todos os profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestor vê profiles relacionados aos seus clientes"
  ON public.profiles FOR SELECT
  USING (
    public.has_role(auth.uid(), 'gestor') AND (
      EXISTS (SELECT 1 FROM public.clientes WHERE gestor_id = auth.uid() AND user_id = profiles.id)
      OR id = auth.uid()
    )
  );

CREATE POLICY "Usuário atualiza seu próprio profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admin atualiza qualquer profile"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- RLS: user_roles
-- ============================================
CREATE POLICY "Usuário vê suas próprias roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin vê todas as roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin gerencia roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- RLS: clientes
-- ============================================
CREATE POLICY "Admin vê todos os clientes"
  ON public.clientes FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestor vê clientes atribuídos"
  ON public.clientes FOR SELECT
  USING (gestor_id = auth.uid());

CREATE POLICY "Cliente vê seu próprio cadastro"
  ON public.clientes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admin gerencia clientes"
  ON public.clientes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestor edita seus clientes"
  ON public.clientes FOR UPDATE
  USING (gestor_id = auth.uid());

-- ============================================
-- RLS: tarefas
-- ============================================
CREATE POLICY "Admin vê todas as tarefas"
  ON public.tarefas FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestor vê tarefas dos seus clientes"
  ON public.tarefas FOR SELECT
  USING (public.is_gestor_of_cliente(auth.uid(), cliente_id));

CREATE POLICY "Cliente vê suas tarefas"
  ON public.tarefas FOR SELECT
  USING (public.is_user_of_cliente(auth.uid(), cliente_id));

CREATE POLICY "Admin gerencia tarefas"
  ON public.tarefas FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestor cria tarefas para seus clientes"
  ON public.tarefas FOR INSERT
  WITH CHECK (public.is_gestor_of_cliente(auth.uid(), cliente_id));

CREATE POLICY "Gestor atualiza tarefas dos seus clientes"
  ON public.tarefas FOR UPDATE
  USING (public.is_gestor_of_cliente(auth.uid(), cliente_id));

CREATE POLICY "Gestor remove tarefas dos seus clientes"
  ON public.tarefas FOR DELETE
  USING (public.is_gestor_of_cliente(auth.uid(), cliente_id));

-- ============================================
-- RLS: criativos
-- ============================================
CREATE POLICY "Admin vê todos os criativos"
  ON public.criativos FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestor vê criativos dos seus clientes"
  ON public.criativos FOR SELECT
  USING (public.is_gestor_of_cliente(auth.uid(), cliente_id));

CREATE POLICY "Cliente vê seus criativos"
  ON public.criativos FOR SELECT
  USING (public.is_user_of_cliente(auth.uid(), cliente_id));

CREATE POLICY "Cliente envia criativos"
  ON public.criativos FOR INSERT
  WITH CHECK (
    public.is_user_of_cliente(auth.uid(), cliente_id)
    AND enviado_por = auth.uid()
  );

CREATE POLICY "Admin gerencia criativos"
  ON public.criativos FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestor aprova/reprova criativos dos seus clientes"
  ON public.criativos FOR UPDATE
  USING (public.is_gestor_of_cliente(auth.uid(), cliente_id));

-- ============================================
-- RLS: comentarios em criativos
-- ============================================
CREATE POLICY "Ver comentários se vê o criativo"
  ON public.criativo_comentarios FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.criativos c
      WHERE c.id = criativo_id AND (
        public.has_role(auth.uid(), 'admin')
        OR public.is_gestor_of_cliente(auth.uid(), c.cliente_id)
        OR public.is_user_of_cliente(auth.uid(), c.cliente_id)
      )
    )
  );

CREATE POLICY "Comentar se vê o criativo"
  ON public.criativo_comentarios FOR INSERT
  WITH CHECK (
    autor_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.criativos c
      WHERE c.id = criativo_id AND (
        public.has_role(auth.uid(), 'admin')
        OR public.is_gestor_of_cliente(auth.uid(), c.cliente_id)
        OR public.is_user_of_cliente(auth.uid(), c.cliente_id)
      )
    )
  );

-- ============================================
-- Storage bucket: criativos
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('criativos', 'criativos', false);

-- Caminho convencionado: {cliente_id}/{criativo_id}_{filename}
CREATE POLICY "Cliente faz upload na pasta do seu cliente"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'criativos'
    AND public.is_user_of_cliente(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Admin faz upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'criativos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin vê todos os arquivos de criativos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'criativos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestor vê arquivos dos seus clientes"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'criativos'
    AND public.is_gestor_of_cliente(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Cliente vê arquivos da sua pasta"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'criativos'
    AND public.is_user_of_cliente(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Admin remove arquivos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'criativos' AND public.has_role(auth.uid(), 'admin'));
