// TradesBrain — kyc-webhook: Stripe Identity KYC events
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@13.0.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16", httpClient: Stripe.createFetchHttpClient() });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const WEBHOOK_SECRET = Deno.env.get("STRIPE_IDENTITY_WEBHOOK_SECRET")!;

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 401 });
  let event: Stripe.Event;
  try { event = await stripe.webhooks.constructEventAsync(body, sig, WEBHOOK_SECRET); }
  catch { return new Response("Signature failed", { status: 400 }); }
  const session = event.data.object as any;
  const userId = session.metadata?.user_id;
  const docType = session.metadata?.document_type as "national_id" | "license" | undefined;
  if (!userId || !docType) return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  try {
    if (event.type === "identity.verification_session.verified") {
      await supabase.from("users").update(docType === "national_id" ? { national_id_kyc_status: "verified" } : { license_kyc_status: "verified" }).eq("id", userId);
      const { data: u } = await supabase.from("users").select("national_id_kyc_status, license_kyc_status").eq("id", userId).single();
      if (u?.national_id_kyc_status === "verified" && u?.license_kyc_status === "verified")
        await supabase.functions.invoke("send-push-notification", { body: { user_id: userId, type: "kyc_verified", deep_link: "tradesbrain://paywall" } });
    } else if (event.type === "identity.verification_session.requires_input") {
      await supabase.from("users").update(docType === "national_id" ? { national_id_kyc_status: "rejected" } : { license_kyc_status: "rejected" }).eq("id", userId);
      await supabase.functions.invoke("send-push-notification", { body: { user_id: userId, type: "kyc_rejected", deep_link: "tradesbrain://settings/profile", metadata: { document_type: docType, rejection_reason: session.last_error?.reason ?? "Could not verify" } } });
    } else if (event.type === "identity.verification_session.processing") {
      await supabase.from("users").update(docType === "national_id" ? { national_id_kyc_status: "pending" } : { license_kyc_status: "pending" }).eq("id", userId);
    }
  } catch (err) { console.error("KYC error:", err); }
  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
});
