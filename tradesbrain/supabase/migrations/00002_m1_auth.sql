-- M1 — Authentication & Sign-Up
-- 1. VAT number lock trigger (D1 §7, D2 LOCKED RULES, BuildGuide M1 RULE 3)
-- 2. KYC document storage bucket (private; service-role + owner read)

-- ── VAT lock trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prevent_vat_number_update() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.vat_number IS NOT NULL
     AND OLD.vat_number <> ''
     AND NEW.vat_number IS DISTINCT FROM OLD.vat_number THEN
    RAISE EXCEPTION 'vat_number is permanently locked after account creation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lock_vat_number ON public.users;
CREATE TRIGGER lock_vat_number
  BEFORE UPDATE OF vat_number ON public.users
  FOR EACH ROW EXECUTE FUNCTION prevent_vat_number_update();

-- ── KYC document storage bucket ─────────────────────────────────────────────
-- Private bucket: license proofs, national IDs, company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Owner can read their own files; service role unrestricted
DROP POLICY IF EXISTS kyc_documents_owner_read ON storage.objects;
CREATE POLICY kyc_documents_owner_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS kyc_documents_owner_write ON storage.objects;
CREATE POLICY kyc_documents_owner_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
