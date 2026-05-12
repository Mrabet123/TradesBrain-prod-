-- TradesBrain Database Schema — D5 v1.0
-- Tables in dependency order per D5 Section 15

CREATE EXTENSION IF NOT EXISTS vector;

-- code_documents
CREATE TABLE public.code_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_name text NOT NULL, short_name text NOT NULL, version text NOT NULL,
  trade_type text NOT NULL, source_url text, chunk_count integer NOT NULL DEFAULT 0,
  ingested_at timestamptz NOT NULL DEFAULT now(), ingested_by text NOT NULL,
  is_active boolean NOT NULL DEFAULT true, UNIQUE(short_name, version)
);

-- code_chunks
CREATE TABLE public.code_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.code_documents(id),
  trade_type text NOT NULL CHECK (trade_type IN ('plumber','electrician','hvac','roofer','general')),
  document_name text NOT NULL, version text NOT NULL, section_number text,
  page_number integer, content text NOT NULL, embedding vector(1536) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- users
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), full_name text NOT NULL,
  email text NOT NULL UNIQUE, phone_number text NOT NULL,
  trade_type text NOT NULL CHECK (trade_type IN ('plumber','electrician','hvac','roofer','other')),
  account_type text NOT NULL CHECK (account_type IN ('solopreneur','team_owner')),
  hourly_rate numeric(10,2) NOT NULL DEFAULT 0, vat_number text NOT NULL,
  company_name text, company_logo_url text, license_number text NOT NULL,
  license_proof_url text NOT NULL, national_id_url text,
  national_id_kyc_status text NOT NULL DEFAULT 'not_uploaded'
    CHECK (national_id_kyc_status IN ('not_uploaded','pending','verified','rejected')),
  license_kyc_status text NOT NULL DEFAULT 'not_uploaded'
    CHECK (license_kyc_status IN ('not_uploaded','pending','verified','rejected')),
  trial_queries_remaining integer NOT NULL DEFAULT 10 CHECK (trial_queries_remaining >= 0),
  subscription_status text NOT NULL DEFAULT 'trial'
    CHECK (subscription_status IN ('trial','active','expired','cancelled')),
  plan_type text CHECK (plan_type IN ('solo','pro','team')),
  subscription_end_date timestamptz, stripe_customer_id text UNIQUE,
  terms_accepted_at timestamptz NOT NULL, terms_version text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- team_members
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), is_active boolean NOT NULL DEFAULT true,
  temporary_password_set boolean NOT NULL DEFAULT true,
  UNIQUE(team_owner_id, member_id)
);

-- worker_preferences
CREATE TABLE public.worker_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('report','quote')),
  sections jsonb NOT NULL DEFAULT '[]', default_include_vat boolean NOT NULL DEFAULT false,
  default_include_license boolean NOT NULL DEFAULT false, default_payment_terms text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, document_type)
);

-- subscriptions
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  stripe_subscription_id text NOT NULL UNIQUE,
  plan_type text NOT NULL CHECK (plan_type IN ('solo','pro','team')),
  status text NOT NULL CHECK (status IN ('active','cancelled','expired','past_due')),
  seat_count integer NOT NULL DEFAULT 1, monthly_amount numeric(10,2) NOT NULL,
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','annual')),
  current_period_start timestamptz NOT NULL, current_period_end timestamptz NOT NULL,
  cancelled_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);

-- billing_history
CREATE TABLE public.billing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id),
  stripe_invoice_id text NOT NULL UNIQUE, amount_paid numeric(10,2) NOT NULL,
  plan_type text NOT NULL, seat_count integer NOT NULL DEFAULT 1,
  billing_period_start timestamptz NOT NULL, billing_period_end timestamptz NOT NULL,
  invoice_pdf_url text, paid_at timestamptz NOT NULL
);

-- job_sessions
CREATE TABLE public.job_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','reopened')),
  job_name text, jobsite text, trade_type text NOT NULL,
  session_source text NOT NULL DEFAULT 'rex' CHECK (session_source IN ('rex','report_standalone','quote_standalone')),
  message_count integer NOT NULL DEFAULT 0, time_on_jobsite_seconds integer,
  parent_session_id uuid REFERENCES public.job_sessions(id)
);

-- messages
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.job_sessions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content_text text, photo_url text, transcript_original text, transcript_edited text,
  model_used text, session_stage integer CHECK (session_stage BETWEEN 1 AND 5),
  is_summary boolean NOT NULL DEFAULT false, tokens_used integer
);

-- job_reports
CREATE TABLE public.job_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.job_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), version_number integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','finalised')),
  report_text text NOT NULL, pdf_url text,
  suggested_amount numeric(10,2), confirmed_amount numeric(10,2),
  sections_config jsonb, includes_vat boolean NOT NULL DEFAULT false,
  includes_license boolean NOT NULL DEFAULT false,
  UNIQUE(session_id, version_number)
);

-- quotes
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.job_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), version_number integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','finalised')),
  line_items jsonb NOT NULL DEFAULT '[]', labour_hours numeric(5,2),
  hourly_rate_snapshot numeric(10,2), suggested_range_min numeric(10,2),
  suggested_range_max numeric(10,2), confirmed_total numeric(10,2),
  payment_terms text, pdf_url text, sections_config jsonb,
  includes_vat boolean NOT NULL DEFAULT false, includes_license boolean NOT NULL DEFAULT false,
  UNIQUE(session_id, version_number)
);

-- audit_logs
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), event_type text NOT NULL,
  user_id uuid, details jsonb, error_message text,
  source text NOT NULL DEFAULT 'system'
);

-- INDEXES
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_stripe_customer_id ON public.users(stripe_customer_id);
CREATE INDEX idx_users_subscription_status ON public.users(subscription_status);
CREATE INDEX idx_job_sessions_user_id ON public.job_sessions(user_id);
CREATE INDEX idx_job_sessions_status ON public.job_sessions(status);
CREATE INDEX idx_job_sessions_created_at ON public.job_sessions(created_at DESC);
CREATE INDEX idx_messages_session_id ON public.messages(session_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at ASC);
CREATE INDEX idx_job_reports_session_id ON public.job_reports(session_id);
CREATE INDEX idx_job_reports_user_id ON public.job_reports(user_id);
CREATE INDEX idx_quotes_session_id ON public.quotes(session_id);
CREATE INDEX idx_quotes_user_id ON public.quotes(user_id);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);
CREATE INDEX idx_code_chunks_embedding ON public.code_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_code_chunks_trade_type ON public.code_chunks(trade_type);

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_own_row ON public.users USING (auth.uid() = id);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_members_policy ON public.team_members USING (auth.uid() = team_owner_id OR auth.uid() = member_id);
ALTER TABLE public.job_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY job_sessions_policy ON public.job_sessions USING (auth.uid() = user_id);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages_policy ON public.messages USING (session_id IN (SELECT id FROM public.job_sessions WHERE user_id = auth.uid()));
ALTER TABLE public.job_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY job_reports_policy ON public.job_reports USING (auth.uid() = user_id);
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY quotes_policy ON public.quotes USING (auth.uid() = user_id);
ALTER TABLE public.worker_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY worker_preferences_policy ON public.worker_preferences USING (auth.uid() = user_id);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_policy ON public.subscriptions USING (auth.uid() = user_id);
ALTER TABLE public.billing_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_history_policy ON public.billing_history USING (auth.uid() = user_id);
ALTER TABLE public.code_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY code_chunks_read ON public.code_chunks FOR SELECT USING (auth.role() = 'authenticated');
ALTER TABLE public.code_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY code_documents_read ON public.code_documents FOR SELECT USING (auth.role() = 'authenticated');
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_service_only ON public.audit_logs FOR ALL USING (false);

-- TRIGGERS
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER job_sessions_updated_at BEFORE UPDATE ON public.job_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER worker_preferences_updated_at BEFORE UPDATE ON public.worker_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION prevent_finalised_update() RETURNS TRIGGER AS $$ BEGIN IF OLD.status = 'finalised' THEN RAISE EXCEPTION 'Cannot modify a finalised document'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER lock_finalised_report BEFORE UPDATE ON public.job_reports FOR EACH ROW EXECUTE FUNCTION prevent_finalised_update();
CREATE TRIGGER lock_finalised_quote BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION prevent_finalised_update();

-- RPC FUNCTIONS
CREATE OR REPLACE FUNCTION match_documents(query_embedding vector(1536), filter_trade_type text, match_count int DEFAULT 5)
RETURNS TABLE(id uuid, content text, section_number text, document_name text, version text, similarity float) LANGUAGE plpgsql AS $$
BEGIN RETURN QUERY SELECT c.id, c.content, c.section_number, c.document_name, c.version, 1 - (c.embedding <=> query_embedding) AS similarity
FROM public.code_chunks c WHERE c.trade_type = filter_trade_type ORDER BY c.embedding <=> query_embedding LIMIT match_count; END; $$;

CREATE OR REPLACE FUNCTION decrement_trial_query(user_id uuid) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE new_count integer; BEGIN UPDATE public.users SET trial_queries_remaining = GREATEST(trial_queries_remaining - 1, 0)
WHERE id = user_id RETURNING trial_queries_remaining INTO new_count; RETURN new_count; END; $$;
