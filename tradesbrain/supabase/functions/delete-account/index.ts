// delete-account — D2 F8 / BuildGuide M7 RULE 4.
// Permanently destroys all the caller's data:
//   • storage objects under <userId>/ in kyc-documents + job-documents
//   • the public.users row (FK cascades clean up everything related)
//   • the auth.users row via the admin API
//
// Subscription continues to bill until the period ends per D2 F8 — that
// decision is left to the worker to cancel separately if needed.
//
// Deploy with: supabase functions deploy delete-account
// Secrets:    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY

// @ts-ignore — Deno globals
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// @ts-ignore — ESM via Deno
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// @ts-ignore Deno
const admin = createClient(
  // @ts-ignore Deno
  Deno.env.get('SUPABASE_URL')!,
  // @ts-ignore Deno
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

async function clearBucket(userId: string, bucket: string) {
  const { data: files } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
  const paths = (files ?? []).map((f: any) => `${userId}/${f.name}`);
  // Recursively walk one level deep (reports / quotes / etc.)
  for (const f of files ?? []) {
    if (f.id == null) {
      const sub = await admin.storage.from(bucket).list(`${userId}/${f.name}`, { limit: 1000 });
      for (const inner of sub.data ?? []) {
        paths.push(`${userId}/${f.name}/${inner.name}`);
      }
    }
  }
  if (paths.length > 0) await admin.storage.from(bucket).remove(paths);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const auth = req.headers.get('Authorization');
  if (!auth)
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { ...cors(), 'Content-Type': 'application/json' },
    });

  const userClient = createClient(
    // @ts-ignore Deno
    Deno.env.get('SUPABASE_URL')!,
    // @ts-ignore Deno
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user)
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...cors(), 'Content-Type': 'application/json' },
    });

  try {
    // 1) Wipe storage objects
    await clearBucket(user.id, 'kyc-documents');
    await clearBucket(user.id, 'job-documents');

    // 2) Delete public.users — FK cascade drops job_sessions, messages,
    //    job_reports, quotes, team_members, worker_preferences, subscriptions,
    //    billing_history (per D5 schema).
    const { error: delErr } = await admin.from('users').delete().eq('id', user.id);
    if (delErr) throw delErr;

    // 3) Delete auth user — requires service role
    const { error: authErr } = await admin.auth.admin.deleteUser(user.id);
    if (authErr) throw authErr;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...cors(), 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'delete failed' }), {
      status: 500,
      headers: { ...cors(), 'Content-Type': 'application/json' },
    });
  }
});
