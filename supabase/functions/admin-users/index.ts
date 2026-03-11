import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SB_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: callerUser }, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = callerUser.id;


    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .single();

    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

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
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = newUser.user.id;

      // Create profile
      await adminClient
        .from("profiles")
        .insert({ id: userId, full_name, email });

      // Set role
      await adminClient
        .from("user_roles")
        .insert({ user_id: userId, role: role || "no_role" });

      // Generate access code for non-admin
      if (role !== "admin" && access_code) {
        await adminClient
          .from("user_access_codes")
          .insert({ user_id: userId, code: access_code });
      }

      return new Response(
        JSON.stringify({ success: true, user_id: userId }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // SET PASSWORD
    if (action === "set_password") {
      const { user_id, password } = body;
      const { error } = await adminClient.auth.admin.updateUserById(user_id, {
        password,
      });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE USER
    if (action === "delete_user") {
      const { user_id } = body;

      // Delete app data first
      await Promise.all([
        adminClient.from("user_roles").delete().eq("user_id", user_id),
        adminClient.from("navigation_permissions").delete().eq("user_id", user_id),
        adminClient.from("status_permissions").delete().eq("user_id", user_id),
        adminClient.from("notifications").delete().eq("user_id", user_id),
        adminClient.from("user_access_codes").delete().eq("user_id", user_id),
        adminClient.from("profiles").delete().eq("id", user_id),
      ]);

      // Delete auth user
      const { error } = await adminClient.auth.admin.deleteUser(user_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE LEAD (admin bypass RLS)
    if (action === "delete_lead") {
      const { lead_id } = body;

      // Delete related records
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
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
