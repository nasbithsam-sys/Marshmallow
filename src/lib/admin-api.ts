import { supabase } from '@/integrations/supabase/client';

async function getFreshAccessToken(): Promise<string> {
  let { data: { session } } = await supabase.auth.getSession();

  // Refresh when the token is missing or expires within the next 60 seconds,
  // otherwise the edge function rejects it with "invalid token".
  const expiresAt = session?.expires_at ? session.expires_at * 1000 : 0;
  if (!session || expiresAt - Date.now() < 60_000) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) {
      await supabase.auth.signOut();
      throw new Error('Your session expired. Please log in again.');
    }
    session = data.session;
  }

  return session.access_token;
}

async function callAdminFunction(body: Record<string, unknown>) {
  const accessToken = await getFreshAccessToken();

  const { data, error } = await supabase.functions.invoke('admin-users', {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (error) {
    // supabase-js FunctionsHttpError attaches the raw Response on error.context.
    // Read it so we surface the real backend error instead of "non-2xx status code".
    let backendMessage: string | null = null;
    const ctx = (error as unknown as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const parsed = await ctx.clone().json();
        backendMessage = parsed?.error || parsed?.message || null;
      } catch {
        try {
          backendMessage = await ctx.clone().text();
        } catch {
          backendMessage = null;
        }
      }
    }

    const msg = backendMessage || error.message || '';
    console.error('admin-users function error:', msg, error);

    if (msg.includes('NOT_FOUND') || msg.includes('not found') || msg.includes('Failed to fetch')) {
      throw new Error('Admin backend is not deployed. Please redeploy the edge function from Supabase dashboard.');
    }
    if (msg.includes('Unauthorized') || msg.includes('401')) {
      throw new Error('Session expired. Please log out and log back in.');
    }
    if (msg.includes('Admin access required') || msg.includes('403')) {
      throw new Error('You do not have admin permissions.');
    }
    throw new Error(msg || 'Admin action failed');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

export const adminApi = {
  ping: () => callAdminFunction({ action: 'ping' }),

  createUser: (email: string, password: string, full_name: string, role: string, access_code?: string) =>
    callAdminFunction({ action: 'create_user', email, password, full_name, role, access_code }),

  setPassword: (user_id: string, password: string) =>
    callAdminFunction({ action: 'set_password', user_id, password }),

  deleteUser: (user_id: string) =>
    callAdminFunction({ action: 'delete_user', user_id }),

  deleteLead: (lead_id: string, job_id?: string) =>
    callAdminFunction({ action: 'delete_lead', lead_id, job_id }),

  listTotpFactors: (user_id: string) =>
    callAdminFunction({ action: 'list_totp_factors', user_id }),

  enrollTotpUser: (user_id: string) =>
    callAdminFunction({ action: 'enroll_totp_user', user_id }),

  deleteTotpUser: (user_id: string) =>
    callAdminFunction({ action: 'delete_totp_user', user_id }),
};
