-- 1) Realtime: restringir broadcast/presence a usuários autenticados
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated can read realtime messages"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can write realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated can write realtime messages"
  ON realtime.messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 2) Storage policies para o bucket "criativos"
DROP POLICY IF EXISTS "Gestor atualiza arquivos de criativos" ON storage.objects;
CREATE POLICY "Gestor atualiza arquivos de criativos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'criativos'
    AND public.is_gestor_of_cliente(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Gestor exclui arquivos de criativos" ON storage.objects;
CREATE POLICY "Gestor exclui arquivos de criativos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'criativos'
    AND public.is_gestor_of_cliente(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Cliente exclui seus arquivos de criativos" ON storage.objects;
CREATE POLICY "Cliente exclui seus arquivos de criativos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'criativos'
    AND public.is_user_of_cliente(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- 3) Mover extensions compatíveis de public para schema "extensions"
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

DO $$
DECLARE ext record;
BEGIN
  FOR ext IN
    SELECT e.extname
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE n.nspname = 'public'
      AND e.extname NOT IN ('plpgsql', 'pg_net')
  LOOP
    BEGIN
      EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions', ext.extname);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping extension % (not movable)', ext.extname;
    END;
  END LOOP;
END $$;