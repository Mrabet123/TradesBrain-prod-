// TradesBrain — delete-team-member
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const ah = req.headers.get("Authorization");
  if (!ah) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const uc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: ah } } });
  const { data: { user: owner } } = await uc.auth.getUser();
  if (!owner) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const b = await req.json();
  if (b.confirmation !== "DELETE") return new Response(JSON.stringify({ error: "Confirmation required" }), { status: 400, headers: { "Content-Type": "application/json" } });
  if (b.member_id === owner.id) return new Response(JSON.stringify({ error: "Cannot delete self" }), { status: 400, headers: { "Content-Type": "application/json" } });
  const { data: tl } = await supabase.from("team_members").select("id").eq("team_owner_id", owner.id).eq("member_id", b.member_id).single();
  if (!tl) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  try {
    const { data: sess } = await supabase.from("job_sessions").select("id").eq("user_id", b.member_id);
    if (sess?.length) { const ids = sess.map(s => s.id); await supabase.from("messages").delete().in("session_id", ids); await supabase.from("job_reports").delete().in("session_id", ids); await supabase.from("quotes").delete().in("session_id", ids); }
    await supabase.from("job_sessions").delete().eq("user_id", b.member_id);
    await supabase.from("worker_preferences").delete().eq("user_id", b.member_id);
    await supabase.from("team_members").delete().eq("member_id", b.member_id);
    for (const bkt of ["job-photos","job-documents","kyc-documents","profile-assets"]) { const { data: f } = await supabase.storage.from(bkt).list(b.member_id); if (f?.length) await supabase.storage.from(bkt).remove(f.map(x => `${b.member_id}/${x.name}`)); }
    await supabase.from("users").delete().eq("id", b.member_id);
    await supabase.auth.admin.deleteUser(b.member_id).catch(() => {});
    await supabase.functions.invoke("stripe-update-subscription", { headers: { Authorization: ah }, body: { action: "remove_seat" } });
    return new Response(JSON.stringify({ success: true, member_id: b.member_id }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) { return new Response(JSON.stringify({ error: "Failed", details: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } }); }
});
