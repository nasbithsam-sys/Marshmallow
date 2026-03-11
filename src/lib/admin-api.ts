import { supabase } from '@/integrations/supabase/client';

async function callAdminFunction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body,
  });

  if (error) {
    // Parse the error for user-friendly messages
    const msg = error.message || '';
    
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

  // supabase.functions.invoke returns parsed data directly
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

  deleteLead: (lead_id: string) =>
    callAdminFunction({ action: 'delete_lead', lead_id }),
};
