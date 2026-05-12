// TradesBrain — decrement-trial-query
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const { data } = await supabase.from("users").select("trial_queries_remaining, subscription_status").eq("id", user.id).single();
  if (!data) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  if (data.subscription_status === "active") return new Response(JSON.stringify({ queries_remaining: null, trial_active: false }), { status: 200, headers: { "Content-Type": "application/json" } });
  if (data.trial_queries_remaining <= 0) return new Response(JSON.stringify({ queries_remaining: 0, trial_active: false, trial_exhausted: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  const { data: updated } = await supabase.rpc("decrement_trial_query", { user_id: user.id });
  const n = updated ?? (data.trial_queries_remaining - 1);
  return new Response(JSON.stringify({ queries_remaining: n, trial_active: n > 0, trial_exhausted: n <= 0 }), { status: 200, headers: { "Content-Type": "application/json" } });
});
