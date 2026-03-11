import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SB_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing env: SUPABASE_URL or SB_SERVICE_ROLE_KEY");
      return jsonResponse({ error: "Server configuration missing. Set SB_SERVICE_ROLE_KEY in Supabase secrets." }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const { action } = body;

    // Health check - no auth needed
    if (action === "ping") {
      return jsonResponse({ success: true, message: "pong" });
    }

    // Access code verification - called before full auth, uses email/password
    if (action === "verify_access_code") {
      const { email, password, code } = body;
      if (!email || !password || !code) {
        return jsonResponse({ error: "Email, password, and code are required" }, 400);
      }

      // Sign in to verify credentials
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
      if (!anonKey) {
        return jsonResponse({ error: "Server configuration missing" }, 500);
      }
      const anonClient = createClient(supabaseUrl, anonKey);
      const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({ email, password });
      if (signInError || !signInData.user) {
        return jsonResponse({ error: "Invalid credentials" }, 401);
      }

      const userId = signInData.user.id;

      // Check stored code server-side (using service role to bypass RLS)
      const { data: codeData } = await adminClient
        .from("user_access_codes")
        .select("code")
        .eq("user_id", userId)
        .single();

      if (!codeData || codeData.code !== code) {
        // Sign out the temporary session
        await anonClient.auth.signOut();
        return jsonResponse({ error: "Invalid access code" }, 403);
      }

      // Code valid — regenerate for single-use
      const newCode = String(Math.floor(100000 + Math.random() * 900000));
      await adminClient
        .from("user_access_codes")
        .update({ code: newCode })
        .eq("user_id", userId);

      // Return the session tokens so the client can set the session
      return jsonResponse({
        success: true,
        session: {
          access_token: signInData.session?.access_token,
          refresh_token: signInData.session?.refresh_token,
        },
      });
    }

    // Check if user needs access code (called after initial sign-in)
    if (action === "check_access_code") {
      const { user_id } = body;
      if (!user_id) {
        return jsonResponse({ error: "user_id is required" }, 400);
      }

      const { data: roleData } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user_id)
        .single();

      if (roleData?.role === "admin") {
        return jsonResponse({ requires_code: false });
      }

      const { data: codeData } = await adminClient
        .from("user_access_codes")
        .select("id")
        .eq("user_id", user_id)
        .single();

      return jsonResponse({ requires_code: !!codeData });
    }

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized - no token provided" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: callerUser }, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !callerUser) {
      console.error("Auth verification failed:", userError?.message);
      return jsonResponse({ error: "Unauthorized - invalid token" }, 401);
    }

    const callerId = callerUser.id;

    // Check admin role
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .single();

    if (roleData?.role !== "admin") {
      return jsonResponse({ error: "Admin access required" }, 403);
    }

    // CREATE USER
    if (action === "create_user") {
      const { email, password, full_name, role, access_code } = body;

      const { data: newUser, error: createError } =
        await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name },
        });

      if (createError) {
        console.error("Create user error:", createError.message);
        return jsonResponse({ error: createError.message }, 400);
      }

      const userId = newUser.user.id;

      await adminClient
        .from("profiles")
        .insert({ id: userId, full_name, email });

      await adminClient
        .from("user_roles")
        .insert({ user_id: userId, role: role || "no_role" });

      if (role !== "admin" && access_code) {
        await adminClient
          .from("user_access_codes")
          .insert({ user_id: userId, code: access_code });
      }

      return jsonResponse({ success: true, user_id: userId });
    }

    // SET PASSWORD
    if (action === "set_password") {
      const { user_id, password } = body;
      const { error } = await adminClient.auth.admin.updateUserById(user_id, {
        password,
      });
      if (error) {
        return jsonResponse({ error: error.message }, 400);
      }
      return jsonResponse({ success: true });
    }

    // DELETE USER
    if (action === "delete_user") {
      const { user_id } = body;

      await Promise.all([
        adminClient.from("user_roles").delete().eq("user_id", user_id),
        adminClient.from("navigation_permissions").delete().eq("user_id", user_id),
        adminClient.from("status_permissions").delete().eq("user_id", user_id),
        adminClient.from("notifications").delete().eq("user_id", user_id),
        adminClient.from("user_access_codes").delete().eq("user_id", user_id),
        adminClient.from("profiles").delete().eq("id", user_id),
      ]);

      const { error } = await adminClient.auth.admin.deleteUser(user_id);
      if (error) {
        return jsonResponse({ error: error.message }, 400);
      }
      return jsonResponse({ success: true });
    }

    // DELETE LEAD
    if (action === "delete_lead") {
      const { lead_id } = body;

      await Promise.all([
        adminClient.from("lead_notes").delete().eq("lead_id", lead_id),
        adminClient.from("lead_photos").delete().eq("lead_id", lead_id),
        adminClient.from("lead_shares").delete().eq("lead_id", lead_id),
        adminClient.from("lead_updates").delete().eq("lead_id", lead_id),
        adminClient.from("notifications").delete().eq("lead_id", lead_id),
        adminClient.from("lead_payments").delete().eq("lead_id", lead_id),
      ]);

      const { error } = await adminClient
        .from("leads")
        .delete()
        .eq("id", lead_id);

      if (error) {
        return jsonResponse({ error: error.message }, 400);
      }
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Unknown action: " + action }, 400);
  } catch (err) {
    console.error("Edge function error:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
