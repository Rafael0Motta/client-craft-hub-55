ALTER TABLE public.tarefas REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tarefas;