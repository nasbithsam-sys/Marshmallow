import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = 'https://kxiqholnmhkwhdkhtopp.supabase.co';

async function callAdminFunction(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const adminApi = {
  createUser: (email: string, password: string, full_name: string, role: string, access_code?: string) =>
    callAdminFunction({ action: 'create_user', email, password, full_name, role, access_code }),

  setPassword: (user_id: string, password: string) =>
    callAdminFunction({ action: 'set_password', user_id, password }),

  deleteUser: (user_id: string) =>
    callAdminFunction({ action: 'delete_user', user_id }),

  deleteLead: (lead_id: string) =>
    callAdminFunction({ action: 'delete_lead', lead_id }),
};
