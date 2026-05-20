// TradesBrain — send-push-notification
// Sends Expo push notifications for all notification types.
// Trigger: called internally by other Edge Functions (kyc-webhook,
//   handle-stripe-webhook, create-team-member).
// Auth: service role — internal only.
// Tables: users (expo_push_token).
// External: Expo Push Notification API (https://exp.host/--/api/v2/push/send).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface Template {
  title: string;
  body: string;
}

// ─── NOTIFICATION TEMPLATES PER TYPE ────────────────────────────────────────
function buildTemplate(type: string, metadata?: Record<string, unknown>): Template {
  const templates: Record<string, Template> = {
    kyc_verified: {
      title: "Identity verified ✓",
      body: "Your documents have been approved. You can now subscribe to TradesBrain.",
    },
    kyc_rejected: {
      title: "Document verification failed",
      body: metadata?.document_type === "national_id"
        ? "Your national ID could not be verified. Tap to re-upload."
        : "Your license document could not be verified. Tap to re-upload.",
    },
    payment_failed: {
      title: "Payment failed",
      body: "We could not charge your payment method. Tap to update your card.",
    },
    subscription_expiring: {
      title: "Subscription expiring",
      body: "Your TradesBrain plan is about to expire. Renew to keep access.",
    },
    trial_ending: {
      title: "Trial ending soon",
      body: "Your free trial is almost over. Subscribe to continue using Rex.",
    },
    team_member_added: {
      title: "Welcome to the team",
      body: "You have been added to a TradesBrain team. Tap to get started.",
    },
    subscription_renewed: {
      title: "Subscription renewed",
      body: `Your ${metadata?.plan_type ?? "Solo"} plan has been renewed successfully.`,
    },
    subscription_expired: {
      title: "Your plan has expired",
      body: "Rex and all features are paused. Tap to renew and get back to work.",
    },
    member_activated: {
      title: `${metadata?.member_name ?? "Team member"} has activated their account`,
      body: "First login complete — they are now using Rex.",
    },
  };
  return templates[type] ?? {
    title: "TradesBrain",
    body: "You have a new notification.",
  };
}

// ─── DEFAULT DEEP LINKS PER TYPE ────────────────────────────────────────────
const DEFAULT_DEEP_LINKS: Record<string, string> = {
  kyc_verified: "tradesbrain://paywall",
  kyc_rejected: "tradesbrain://settings/profile",
  payment_failed: "tradesbrain://settings/subscription/payment",
  subscription_expiring: "tradesbrain://settings/subscription",
  trial_ending: "tradesbrain://paywall",
  team_member_added: "tradesbrain://home",
  subscription_renewed: "tradesbrain://settings/subscription",
  subscription_expired: "tradesbrain://paywall",
  member_activated: "tradesbrain://team/members",
};

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let body: {
    user_id?: string;
    type?: string;
    deep_link?: string;
    metadata?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const { user_id, type, metadata } = body;
  if (!user_id || !type) {
    return new Response(JSON.stringify({ error: "user_id and type are required" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const deepLink = body.deep_link ?? DEFAULT_DEEP_LINKS[type] ?? "tradesbrain://home";

  // ── LOOK UP USER'S EXPO PUSH TOKEN ────────────────────────────────────────
  const { data: userData } = await supabase
    .from("users")
    .select("expo_push_token")
    .eq("id", user_id)
    .single();

  const pushToken = userData?.expo_push_token;
  if (!pushToken) {
    console.log(`No push token for user=${user_id} — notification skipped`);
    return new Response(JSON.stringify({ sent: false, reason: "no_token" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  // ── SEND TO EXPO PUSH API ─────────────────────────────────────────────────
  const tmpl = buildTemplate(type, metadata);
  let sent = false;
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: pushToken,
        title: tmpl.title,
        body: tmpl.body,
        data: { type, deep_link: deepLink, ...(metadata ?? {}) },
        sound: "default",
        priority: "high",
      }),
    });
    const result = await response.json();
    if (result?.data?.status === "error") {
      console.error("Expo push error:", result.data.message, "token:", pushToken);
      // Clear stale tokens so we stop trying them.
      if (result.data.details?.error === "DeviceNotRegistered") {
        await supabase.from("users")
          .update({ expo_push_token: null })
          .eq("expo_push_token", pushToken);
      }
      sent = false;
    } else {
      sent = true;
    }
  } catch (err) {
    console.error("Expo push request failed:", err);
    sent = false;
  }

  console.log(`Push notification: user=${user_id} type=${type} sent=${sent}`);
  return new Response(JSON.stringify({ sent }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
