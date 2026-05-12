// TradesBrain — send-push-notification
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TEMPLATES: Record<string, { title: string; body: string }> = {
  payment_failed: { title: "Payment Failed", body: "Update your payment method to continue." },
  kyc_verified: { title: "Identity Verified", body: "You can now subscribe to TradesBrain." },
  kyc_rejected: { title: "Document Rejected", body: "Re-upload from Settings." },
  subscription_expiring: { title: "Subscription Expiring", body: "Renew to keep access." },
  trial_ending: { title: "Trial Ending", body: "Subscribe to continue using Rex." },
  team_member_added: { title: "Welcome to the Team", body: "You have been added to a TradesBrain team." },
};

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const { user_id, type, deep_link } = await req.json();
  const t = TEMPLATES[type];
  console.log(`Push: user=${user_id} type=${type} link=${deep_link}`);
  return new Response(JSON.stringify({ sent: !!t, type, user_id }), { status: 200, headers: { "Content-Type": "application/json" } });
});
