
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS photo_url text;

CREATE POLICY "Authenticated can view student photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'student-photos');

CREATE POLICY "Authenticated can upload student photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'student-photos');

CREATE POLICY "Authenticated can update student photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'student-photos');

CREATE POLICY "Authenticated can delete student photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'student-photos');
