
-- Função SECURITY DEFINER para buscar nomes públicos de usuários sem expor email/telefone.
-- Necessária porque o RLS de profiles impede que gestores vejam profiles de admins,
-- o que faz o "Criada por" aparecer em branco em tarefas criadas por outros papéis.
CREATE OR REPLACE FUNCTION public.get_profile_names(_ids uuid[])
RETURNS TABLE(id uuid, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome
  FROM public.profiles p
  WHERE p.id = ANY(_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_names(uuid[]) TO authenticated;
