// supabase/functions/full-signup/index.ts
// deno run --allow-net --allow-env --allow-read

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
    }

    const { name, email, password, cleaned_phone, location, referred_by, referral_code, role } = await req.json();

    if (!name || !email || !password) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // 1) Create auth user (email verification OPTIONAL)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // DO NOT enforce email verification now
      user_metadata: { name }
    });

    if (createErr || !created?.user?.id) {
      return new Response(JSON.stringify({ error: createErr?.message || "Could not create auth user" }), { status: 400 });
    }

    const newUserId = created.user.id;

    // 2) Insert into your custom table
    const { error: insertErr } = await admin
      .from("users")
      .insert({
        id: newUserId,
        name,
        email: email.toLowerCase(),
        phone: cleaned_phone || null,
        wallet_balance: 0,
        total_liyog_coins: 0,
        referred_by: referred_by || null,
        role: role || "user",
        location: location || null,
        is_active: true,
        referral_code: referral_code
      });

    if (insertErr) {
      // 3) Roll back auth user so there is NO partial registration
      await admin.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: insertErr.message || "Failed to insert user profile" }), { status: 400 });
    }

    return new Response(JSON.stringify({ ok: true, user_id: newUserId }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "Unexpected error" }), { status: 500 });
  }
});
