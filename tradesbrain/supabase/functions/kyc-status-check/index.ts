// TradesBrain — kyc-status-check
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
  const { data } = await supabase.from("users").select("national_id_kyc_status, license_kyc_status").eq("id", user.id).single();
  if (!data) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  const nid = data.national_id_kyc_status, lic = data.license_kyc_status;
  let result: any;
  if (nid === "verified" && lic === "verified") result = { can_subscribe: true, status: "verified", national_id_status: nid, license_status: lic, message: "Identity verified." };
  else if (nid === "rejected") result = { can_subscribe: false, status: "rejected", blocking_document: "national_id", national_id_status: nid, license_status: lic, message: "National ID rejected. Re-upload from Settings." };
  else if (lic === "rejected") result = { can_subscribe: false, status: "rejected", blocking_document: "license", national_id_status: nid, license_status: lic, message: "License rejected. Re-upload from Settings." };
  else if (nid === "pending" || lic === "pending") result = { can_subscribe: false, status: "pending", blocking_document: nid === "pending" ? "national_id" : "license", national_id_status: nid, license_status: lic, message: "Under review. Usually within 24 hours." };
  else result = { can_subscribe: false, status: "not_uploaded", blocking_document: nid !== "verified" ? "national_id" : "license", national_id_status: nid, license_status: lic, message: "Documents required." };
  return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
});
