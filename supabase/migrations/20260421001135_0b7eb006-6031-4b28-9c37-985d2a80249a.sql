-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Helper: invoke the dispatch-webhook edge function
CREATE OR REPLACE FUNCTION public.invoke_dispatch_webhook(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://johcsnnseeetyxtvbxut.supabase.co/functions/v1/dispatch-webhook',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvaGNzbm5zZWVldHl4dHZieHV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NDMzNDUsImV4cCI6MjA5MjAxOTM0NX0.ft868tmkn0DhbuH3trJ2XUL-hHhp8fXebuG1tOAgZGI'
    ),
    body := payload
  );
END;
$$;

-- Trigger: createTask
CREATE OR REPLACE FUNCTION public.trg_tarefa_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.invoke_dispatch_webhook(
    jsonb_build_object('event', 'createTask', 'tarefa_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tarefa_created_webhook ON public.tarefas;
CREATE TRIGGER tarefa_created_webhook
  AFTER INSERT ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.trg_tarefa_created();

-- Trigger: addContentTask (criativo inicial)
CREATE OR REPLACE FUNCTION public.trg_criativo_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.invoke_dispatch_webhook(
    jsonb_build_object('event', 'addContentTask', 'criativo_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS criativo_created_webhook ON public.criativos;
CREATE TRIGGER criativo_created_webhook
  AFTER INSERT ON public.criativos
  FOR EACH ROW EXECUTE FUNCTION public.trg_criativo_created();

-- Trigger: addContentTask (nova versão)
CREATE OR REPLACE FUNCTION public.trg_criativo_versao_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.invoke_dispatch_webhook(
    jsonb_build_object('event', 'addContentTask', 'criativo_id', NEW.criativo_id, 'versao_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS criativo_versao_created_webhook ON public.criativo_versoes;
CREATE TRIGGER criativo_versao_created_webhook
  AFTER INSERT ON public.criativo_versoes
  FOR EACH ROW EXECUTE FUNCTION public.trg_criativo_versao_created();

-- Cron job: roda diariamente às 9h UTC para checar tarefas (due soon + overdue)
SELECT cron.unschedule('check-due-tasks-webhook') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-due-tasks-webhook'
);

SELECT cron.schedule(
  'check-due-tasks-webhook',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://johcsnnseeetyxtvbxut.supabase.co/functions/v1/dispatch-webhook',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvaGNzbm5zZWVldHl4dHZieHV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NDMzNDUsImV4cCI6MjA5MjAxOTM0NX0.ft868tmkn0DhbuH3trJ2XUL-hHhp8fXebuG1tOAgZGI'
    ),
    body := jsonb_build_object('event', 'cron')
  );
  $$
);