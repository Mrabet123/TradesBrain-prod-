// TradesBrain — stripe-create-checkout
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.0.0";
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16", httpClient: Stripe.createFetchHttpClient() });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const PLAN_PRICE_MAP: Record<string, Record<string, string>> = {
  solo: { monthly: Deno.env.get("STRIPE_PRICE_SOLO_MONTHLY")!, annual: Deno.env.get("STRIPE_PRICE_SOLO_ANNUAL")! },
  pro: { monthly: Deno.env.get("STRIPE_PRICE_PRO_MONTHLY")!, annual: Deno.env.get("STRIPE_PRICE_PRO_ANNUAL")! },
  team: { monthly: Deno.env.get("STRIPE_PRICE_TEAM_MONTHLY")!, annual: Deno.env.get("STRIPE_PRICE_TEAM_ANNUAL")! },
};

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const { plan_type, billing_cycle } = await req.json();
  const { data: ud } = await supabase.from("users").select("stripe_customer_id, national_id_kyc_status, license_kyc_status, email, full_name, subscription_status").eq("id", user.id).single();
  if (!ud) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  if (ud.national_id_kyc_status !== "verified" || ud.license_kyc_status !== "verified") return new Response(JSON.stringify({ error: "kyc_required" }), { status: 403, headers: { "Content-Type": "application/json" } });
  if (ud.subscription_status === "active") return new Response(JSON.stringify({ error: "already_subscribed" }), { status: 409, headers: { "Content-Type": "application/json" } });
  let cid = ud.stripe_customer_id;
  if (!cid) { const c = await stripe.customers.create({ email: ud.email, name: ud.full_name, metadata: { supabase_user_id: user.id } }); cid = c.id; await supabase.from("users").update({ stripe_customer_id: cid }).eq("id", user.id); }
  const priceId = PLAN_PRICE_MAP[plan_type]?.[billing_cycle];
  if (!priceId) return new Response(JSON.stringify({ error: "Invalid plan" }), { status: 400, headers: { "Content-Type": "application/json" } });
  const sub = await stripe.subscriptions.create({ customer: cid, items: [{ price: priceId }], payment_behavior: "default_incomplete", payment_settings: { save_default_payment_method: "on_subscription" }, expand: ["latest_invoice.payment_intent"], metadata: { supabase_user_id: user.id, plan_type, billing_cycle } });
  const pi = (sub.latest_invoice as Stripe.Invoice)?.payment_intent as Stripe.PaymentIntent;
  if (!pi?.client_secret) return new Response(JSON.stringify({ error: "Checkout failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
  const ek = await stripe.ephemeralKeys.create({ customer: cid }, { apiVersion: "2023-10-16" });
  return new Response(JSON.stringify({ client_secret: pi.client_secret, subscription_id: sub.id, customer_id: cid, ephemeral_key: ek.secret }), { status: 200, headers: { "Content-Type": "application/json" } });
});
