-- Permitir versões/criativos enviados via link externo (sem arquivo no storage)
ALTER TABLE public.criativo_versoes
  ALTER COLUMN arquivo_path DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS link_url text;

ALTER TABLE public.criativos
  ALTER COLUMN arquivo_path DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS link_url text;

-- Atualiza trigger de sync para propagar link_url também
CREATE OR REPLACE FUNCTION public.sync_tarefa_status_from_versao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _tarefa_id uuid;
BEGIN
  SELECT tarefa_id INTO _tarefa_id FROM public.criativos WHERE id = NEW.criativo_id;
  IF _tarefa_id IS NULL THEN RETURN NEW; END IF;

  UPDATE public.criativos
    SET status = NEW.status, comentario_revisao = NEW.comentario_revisao,
        revisado_por = NEW.revisado_por, revisado_em = NEW.revisado_em,
        arquivo_path = NEW.arquivo_path, arquivo_nome = NEW.arquivo_nome, arquivo_tipo = NEW.arquivo_tipo,
        link_url = NEW.link_url,
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
$function$;