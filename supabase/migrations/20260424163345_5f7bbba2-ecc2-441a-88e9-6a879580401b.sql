
-- Permite que cliente atualize SUAS tarefas (apenas o campo status, validado por trigger)
CREATE POLICY "Cliente atualiza status das suas tarefas"
ON public.tarefas
FOR UPDATE
USING (public.is_user_of_cliente(auth.uid(), cliente_id))
WITH CHECK (public.is_user_of_cliente(auth.uid(), cliente_id));

-- Trigger que restringe o que o cliente pode alterar:
-- só pode mudar o status, e apenas entre 'pendente' <-> 'em_andamento'
CREATE OR REPLACE FUNCTION public.trg_cliente_restringe_update_tarefa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só aplica restrição para clientes (admin/gestor passam livremente)
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

    -- Status só pode transitar entre pendente e em_andamento
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NOT (
        (OLD.status = 'pendente' AND NEW.status = 'em_andamento')
        OR (OLD.status = 'em_andamento' AND NEW.status = 'pendente')
      ) THEN
        RAISE EXCEPTION 'Cliente só pode alternar entre Pendente e Em andamento';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cliente_restringe_update_tarefa ON public.tarefas;
CREATE TRIGGER trg_cliente_restringe_update_tarefa
BEFORE UPDATE ON public.tarefas
FOR EACH ROW
EXECUTE FUNCTION public.trg_cliente_restringe_update_tarefa();
