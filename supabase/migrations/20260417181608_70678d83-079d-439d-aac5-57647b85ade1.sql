-- Garantir cascade entre tarefas → criativos → versões/comentários
ALTER TABLE public.criativos
  DROP CONSTRAINT IF EXISTS criativos_tarefa_id_fkey,
  ADD CONSTRAINT criativos_tarefa_id_fkey
    FOREIGN KEY (tarefa_id) REFERENCES public.tarefas(id) ON DELETE CASCADE;

ALTER TABLE public.criativo_versoes
  DROP CONSTRAINT IF EXISTS criativo_versoes_criativo_id_fkey,
  ADD CONSTRAINT criativo_versoes_criativo_id_fkey
    FOREIGN KEY (criativo_id) REFERENCES public.criativos(id) ON DELETE CASCADE;

ALTER TABLE public.criativo_comentarios
  DROP CONSTRAINT IF EXISTS criativo_comentarios_criativo_id_fkey,
  ADD CONSTRAINT criativo_comentarios_criativo_id_fkey
    FOREIGN KEY (criativo_id) REFERENCES public.criativos(id) ON DELETE CASCADE;

-- Políticas de DELETE para criativos
DROP POLICY IF EXISTS "Gestor exclui criativos dos seus clientes" ON public.criativos;
CREATE POLICY "Gestor exclui criativos dos seus clientes"
ON public.criativos FOR DELETE
USING (public.is_gestor_of_cliente(auth.uid(), cliente_id));

DROP POLICY IF EXISTS "Cliente exclui criativos pendentes" ON public.criativos;
CREATE POLICY "Cliente exclui criativos pendentes"
ON public.criativos FOR DELETE
USING (
  public.is_user_of_cliente(auth.uid(), cliente_id)
  AND status = 'pendente_aprovacao'
);