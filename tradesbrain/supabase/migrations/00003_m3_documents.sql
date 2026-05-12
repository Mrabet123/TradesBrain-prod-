-- M3 — Report & Quote Generation
-- Private storage bucket for generated PDFs. Owner-only RLS.

INSERT INTO storage.buckets (id, name, public)
VALUES ('job-documents', 'job-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS job_documents_owner_read ON storage.objects;
CREATE POLICY job_documents_owner_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'job-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS job_documents_owner_write ON storage.objects;
CREATE POLICY job_documents_owner_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'job-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
