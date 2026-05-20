// TradesBrain — calculate-days-remaining
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const ah = req.headers.get("Authorization");
  if (!ah) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const uc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: ah } } });
  const { data: { user } } = await uc.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const { data: ud } = await supabase.from("users").select("subscription_end_date, subscription_status, plan_type").eq("id", user.id).single();
  if (!ud) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  // Fetch the active subscription row for billing context (D10).
  const { data: subData } = await supabase
    .from("subscriptions")
    .select("billing_cycle, monthly_amount, seat_count")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  const billing_cycle = subData?.billing_cycle ?? "monthly";
  const monthly_amount = subData?.monthly_amount ?? null;
  const seat_count = subData?.seat_count ?? 1;
  if (ud.subscription_status === "trial") return new Response(JSON.stringify({ days_remaining: null, end_date: null, message: "Free trial active", billing_cycle, monthly_amount, seat_count }), { status: 200, headers: { "Content-Type": "application/json" } });
  if (!ud.subscription_end_date) return new Response(JSON.stringify({ days_remaining: 0, end_date: null, billing_cycle, monthly_amount, seat_count }), { status: 200, headers: { "Content-Type": "application/json" } });
  const end = new Date(ud.subscription_end_date);
  const days = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
  return new Response(JSON.stringify({ days_remaining: days, end_date: ud.subscription_end_date, end_date_formatted: end.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), subscription_status: ud.subscription_status, plan_type: ud.plan_type, billing_cycle, monthly_amount, seat_count }), { status: 200, headers: { "Content-Type": "application/json" } });
});
