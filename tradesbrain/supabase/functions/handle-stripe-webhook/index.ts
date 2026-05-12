// TradesBrain — handle-stripe-webhook
// Receives Stripe webhook events, verifies signature, updates subscription status
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.0.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16", httpClient: Stripe.createFetchHttpClient(),
});
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const PRICE_TO_PLAN: Record<string, string> = {
  [Deno.env.get("STRIPE_PRICE_SOLO_MONTHLY")!]: "solo",
  [Deno.env.get("STRIPE_PRICE_SOLO_ANNUAL")!]: "solo",
  [Deno.env.get("STRIPE_PRICE_PRO_MONTHLY")!]: "pro",
  [Deno.env.get("STRIPE_PRICE_PRO_ANNUAL")!]: "pro",
  [Deno.env.get("STRIPE_PRICE_TEAM_MONTHLY")!]: "team",
  [Deno.env.get("STRIPE_PRICE_TEAM_ANNUAL")!]: "team",
  [Deno.env.get("STRIPE_PRICE_SEAT_MONTHLY")!]: "team",
  [Deno.env.get("STRIPE_PRICE_SEAT_ANNUAL")!]: "team",
};

async function getUserIdByCustomer(customerId: string): Promise<string | null> {
  const { data } = await supabase.from("users").select("id").eq("stripe_customer_id", customerId).single();
  return data?.id ?? null;
}

function resolvePlanType(sub: Stripe.Subscription): string {
  for (const item of sub.items.data) { const p = PRICE_TO_PLAN[item.price.id]; if (p) return p; }
  return "solo";
}

function countSeats(sub: Stripe.Subscription): number {
  let seats = 1;
  for (const item of sub.items.data) {
    if (item.price.id === Deno.env.get("STRIPE_PRICE_SEAT_MONTHLY") || item.price.id === Deno.env.get("STRIPE_PRICE_SEAT_ANNUAL"))
      seats += item.quantity ?? 0;
  }
  return seats;
}

async function handleSubscriptionCreated(sub: Stripe.Subscription) {
  const userId = await getUserIdByCustomer(sub.customer as string);
  if (!userId) return;
  const plan = resolvePlanType(sub);
  const end = new Date(sub.current_period_end * 1000).toISOString();
  const start = new Date(sub.current_period_start * 1000).toISOString();
  const cycle = sub.items.data[0]?.price.recurring?.interval === "year" ? "annual" : "monthly";
  const amount = sub.items.data.reduce((s, i) => s + ((i.price.unit_amount ?? 0) * (i.quantity ?? 1)) / 100, 0);
  await supabase.from("users").update({ subscription_status: "active", plan_type: plan, subscription_end_date: end }).eq("id", userId);
  await supabase.from("subscriptions").upsert({ user_id: userId, stripe_subscription_id: sub.id, plan_type: plan, status: "active", seat_count: countSeats(sub), monthly_amount: amount, billing_cycle: cycle, current_period_start: start, current_period_end: end }, { onConflict: "stripe_subscription_id" });
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const userId = await getUserIdByCustomer(sub.customer as string);
  if (!userId) return;
  const plan = resolvePlanType(sub);
  const end = new Date(sub.current_period_end * 1000).toISOString();
  const start = new Date(sub.current_period_start * 1000).toISOString();
  const cycle = sub.items.data[0]?.price.recurring?.interval === "year" ? "annual" : "monthly";
  const amount = sub.items.data.reduce((s, i) => s + ((i.price.unit_amount ?? 0) * (i.quantity ?? 1)) / 100, 0);
  const statusMap: Record<string, string> = { active: "active", past_due: "active", canceled: "cancelled", unpaid: "expired", incomplete: "trial", incomplete_expired: "expired" };
  const tbStatus = statusMap[sub.status] ?? "expired";
  await supabase.from("users").update({ subscription_status: tbStatus, plan_type: tbStatus === "active" ? plan : null, subscription_end_date: end }).eq("id", userId);
  await supabase.from("subscriptions").update({ plan_type: plan, status: sub.status, seat_count: countSeats(sub), monthly_amount: amount, billing_cycle: cycle, current_period_start: start, current_period_end: end, cancelled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null }).eq("stripe_subscription_id", sub.id);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const userId = await getUserIdByCustomer(sub.customer as string);
  if (!userId) return;
  await supabase.from("users").update({ subscription_status: "cancelled", subscription_end_date: new Date(sub.current_period_end * 1000).toISOString() }).eq("id", userId);
  await supabase.from("subscriptions").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("stripe_subscription_id", sub.id);
}

async function handleInvoiceSucceeded(inv: Stripe.Invoice) {
  const userId = await getUserIdByCustomer(inv.customer as string);
  if (!userId || !inv.subscription) return;
  const { data: sub } = await supabase.from("subscriptions").select("id, plan_type, seat_count").eq("stripe_subscription_id", inv.subscription).single();
  if (!sub) return;
  await supabase.from("billing_history").insert({ user_id: userId, subscription_id: sub.id, stripe_invoice_id: inv.id, amount_paid: inv.amount_paid / 100, plan_type: sub.plan_type, seat_count: sub.seat_count, billing_period_start: new Date(inv.period_start * 1000).toISOString(), billing_period_end: new Date(inv.period_end * 1000).toISOString(), invoice_pdf_url: inv.invoice_pdf, paid_at: new Date((inv.status_transitions?.paid_at ?? Date.now() / 1000) * 1000).toISOString() });
}

async function handleInvoiceFailed(inv: Stripe.Invoice) {
  const userId = await getUserIdByCustomer(inv.customer as string);
  if (!userId) return;
  await supabase.functions.invoke("send-push-notification", { body: { user_id: userId, type: "payment_failed", deep_link: "tradesbrain://settings/subscription" } });
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Unauthorized", { status: 401 });
  let event: Stripe.Event;
  try { event = await stripe.webhooks.constructEventAsync(body, sig, WEBHOOK_SECRET); }
  catch { return new Response("Signature verification failed", { status: 400 }); }
  try {
    switch (event.type) {
      case "customer.subscription.created": await handleSubscriptionCreated(event.data.object as Stripe.Subscription); break;
      case "customer.subscription.updated": await handleSubscriptionUpdated(event.data.object as Stripe.Subscription); break;
      case "customer.subscription.deleted": await handleSubscriptionDeleted(event.data.object as Stripe.Subscription); break;
      case "invoice.payment_succeeded": await handleInvoiceSucceeded(event.data.object as Stripe.Invoice); break;
      case "invoice.payment_failed": await handleInvoiceFailed(event.data.object as Stripe.Invoice); break;
    }
  } catch (err) {
    console.error(`Error processing ${event.type}:`, err);
    return new Response(JSON.stringify({ error: "logged" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
});
