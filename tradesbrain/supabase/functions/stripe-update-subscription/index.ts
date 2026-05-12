// TradesBrain — stripe-update-subscription
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.0.0";
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16", httpClient: Stripe.createFetchHttpClient() });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const PPM: Record<string, Record<string, string>> = {
  solo: { monthly: Deno.env.get("STRIPE_PRICE_SOLO_MONTHLY")!, annual: Deno.env.get("STRIPE_PRICE_SOLO_ANNUAL")! },
  pro: { monthly: Deno.env.get("STRIPE_PRICE_PRO_MONTHLY")!, annual: Deno.env.get("STRIPE_PRICE_PRO_ANNUAL")! },
  team: { monthly: Deno.env.get("STRIPE_PRICE_TEAM_MONTHLY")!, annual: Deno.env.get("STRIPE_PRICE_TEAM_ANNUAL")! },
  seat: { monthly: Deno.env.get("STRIPE_PRICE_SEAT_MONTHLY")!, annual: Deno.env.get("STRIPE_PRICE_SEAT_ANNUAL")! },
};

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const ah = req.headers.get("Authorization");
  if (!ah) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const uc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: ah } } });
  const { data: { user } } = await uc.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const body = await req.json();
  const { data: sd } = await supabase.from("subscriptions").select("stripe_subscription_id, plan_type, billing_cycle").eq("user_id", user.id).eq("status", "active").single();
  if (!sd) return new Response(JSON.stringify({ error: "No subscription" }), { status: 404, headers: { "Content-Type": "application/json" } });
  const sub = await stripe.subscriptions.retrieve(sd.stripe_subscription_id);
  const ci = sub.items.data[0];
  try {
    switch (body.action) {
      case "upgrade": case "downgrade": {
        const np = PPM[body.new_plan_type]?.[sd.billing_cycle];
        if (!np) return new Response(JSON.stringify({ error: "Invalid plan" }), { status: 400, headers: { "Content-Type": "application/json" } });
        await stripe.subscriptions.update(sub.id, { items: [{ id: ci.id, price: np }], proration_behavior: "create_prorations" }); break;
      }
      case "switch_annual": {
        const ap = PPM[sd.plan_type]?.annual;
        if (!ap) return new Response(JSON.stringify({ error: "No annual price" }), { status: 400, headers: { "Content-Type": "application/json" } });
        await stripe.subscriptions.update(sub.id, { items: [{ id: ci.id, price: ap }], proration_behavior: "create_prorations", billing_cycle_anchor: "now" }); break;
      }
      case "add_seat": {
        const sp = PPM.seat[sd.billing_cycle]; const ei = sub.items.data.find(i => i.price.id === sp);
        if (ei) await stripe.subscriptionItems.update(ei.id, { quantity: (ei.quantity ?? 0) + 1, proration_behavior: "create_prorations" });
        else await stripe.subscriptions.update(sub.id, { items: [{ price: sp, quantity: 1 }], proration_behavior: "create_prorations" }); break;
      }
      case "remove_seat": {
        const sp = PPM.seat[sd.billing_cycle]; const ei = sub.items.data.find(i => i.price.id === sp);
        if (!ei) return new Response(JSON.stringify({ error: "No seats" }), { status: 400, headers: { "Content-Type": "application/json" } });
        const nq = (ei.quantity ?? 1) - 1;
        if (nq <= 0) await stripe.subscriptionItems.del(ei.id, { proration_behavior: "create_prorations" } as any);
        else await stripe.subscriptionItems.update(ei.id, { quantity: nq, proration_behavior: "create_prorations" }); break;
      }
      default: return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
  } catch (err) { return new Response(JSON.stringify({ error: "Failed", details: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } }); }
  return new Response(JSON.stringify({ success: true, action: body.action }), { status: 200, headers: { "Content-Type": "application/json" } });
});
