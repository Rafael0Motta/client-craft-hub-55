CREATE OR REPLACE FUNCTION public.trg_cliente_restringe_update_tarefa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin/gestor passam livremente
  IF public.has_role(auth.uid(), 'admin') OR public.is_gestor_of_cliente(auth.uid(), NEW.cliente_id) THEN
    RETURN NEW;
  END IF;

  IF public.is_user_of_cliente(auth.uid(), NEW.cliente_id) THEN
    -- Cliente não pode alterar nenhum campo a não ser status
    IF NEW.titulo IS DISTINCT FROM OLD.titulo
       OR NEW.descricao IS DISTINCT FROM OLD.descricao
       OR NEW.prioridade IS DISTINCT FROM OLD.prioridade
       OR NEW.prazo IS DISTINCT FROM OLD.prazo
       OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
       OR NEW.tipo_tarefa_id IS DISTINCT FROM OLD.tipo_tarefa_id
       OR NEW.funil IS DISTINCT FROM OLD.funil
       OR NEW.criado_por IS DISTINCT FROM OLD.criado_por THEN
      RAISE EXCEPTION 'Cliente só pode alterar o status da tarefa';
    END IF;

    -- Status: cliente pode alternar manualmente entre pendente e em_andamento.
    -- Transições para 'aguardando_aprovacao' e 'aprovado' são feitas pelo
    -- trigger interno sync_tarefa_status_from_versao (envio/aprovação de criativo)
    -- e devem ser permitidas mesmo quando auth.uid() é do cliente.
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NOT (
        (OLD.status = 'pendente' AND NEW.status = 'em_andamento')
        OR (OLD.status = 'em_andamento' AND NEW.status = 'pendente')
        OR (NEW.status IN ('aguardando_aprovacao', 'aprovado'))
      ) THEN
        RAISE EXCEPTION 'Cliente só pode alternar entre Pendente e Em andamento';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;