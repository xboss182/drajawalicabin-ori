
DROP POLICY IF EXISTS "Anyone can upload payment proof" ON storage.objects;
CREATE POLICY "Anyone can upload payment proof" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "Admins read payment proofs" ON storage.objects;
CREATE POLICY "Admins read payment proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins delete payment proofs" ON storage.objects;
CREATE POLICY "Admins delete payment proofs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(),'admin'));
