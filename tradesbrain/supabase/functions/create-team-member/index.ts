// TradesBrain — create-team-member
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.0.0";
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16", httpClient: Stripe.createFetchHttpClient() });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const ah = req.headers.get("Authorization");
  if (!ah) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const uc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: ah } } });
  const { data: { user: owner } } = await uc.auth.getUser();
  if (!owner) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const { data: od } = await supabase.from("users").select("full_name, plan_type, subscription_status").eq("id", owner.id).single();
  if (od?.plan_type !== "team" || od?.subscription_status !== "active") return new Response(JSON.stringify({ error: "team_plan_required" }), { status: 403, headers: { "Content-Type": "application/json" } });
  const { count } = await supabase.from("team_members").select("id", { count: "exact" }).eq("team_owner_id", owner.id).eq("is_active", true);
  if ((count ?? 0) >= 10) return new Response(JSON.stringify({ error: "max_seats_reached" }), { status: 409, headers: { "Content-Type": "application/json" } });
  const b = await req.json();
  let nid: string | null = null;
  try {
    const { data: au, error } = await supabase.auth.admin.createUser({ email: b.email, phone: b.phone_number, password: b.temp_password, email_confirm: true, phone_confirm: false });
    if (error || !au.user) throw new Error(error?.message);
    nid = au.user.id;
    await supabase.from("users").insert({ id: nid, full_name: b.full_name, email: b.email, phone_number: b.phone_number, trade_type: b.trade_type, account_type: "solopreneur", hourly_rate: 0, vat_number: b.vat_number, license_number: b.license_number, license_proof_url: b.license_proof_url, national_id_url: b.national_id_url, national_id_kyc_status: "pending", license_kyc_status: "pending", trial_queries_remaining: 0, subscription_status: "active", plan_type: "team", terms_accepted_at: new Date().toISOString(), terms_version: "1.2" });
    await supabase.from("team_members").insert({ team_owner_id: owner.id, member_id: nid, is_active: true, temporary_password_set: true });
    await supabase.functions.invoke("stripe-update-subscription", { headers: { Authorization: ah }, body: { action: "add_seat" } });
    await stripe.identity.verificationSessions.create({ type: "document", metadata: { user_id: nid, document_type: "national_id" }, options: { document: { require_live_capture: true, require_id_number: false } } });
    await stripe.identity.verificationSessions.create({ type: "document", metadata: { user_id: nid, document_type: "license" }, options: { document: { require_live_capture: true, require_id_number: false } } });
    await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "TradesBrain <noreply@tradesbrain.app>", to: [b.email], subject: `${od.full_name} added you to TradesBrain`, html: `<h2>Welcome ${b.full_name}</h2><p>Temp password: <strong>${b.temp_password}</strong></p>` }) });
    return new Response(JSON.stringify({ success: true, member_id: nid }), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    if (nid) { await supabase.auth.admin.deleteUser(nid).catch(() => {}); await supabase.from("users").delete().eq("id", nid).catch(() => {}); await supabase.from("team_members").delete().eq("member_id", nid).catch(() => {}); }
    return new Response(JSON.stringify({ error: "creation_failed", details: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
