import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import type { LeadUpdate } from '@/types';

interface Props {
  leadId: string;
}

const LeadUpdatesSection = ({ leadId }: Props) => {
  const { user, profile, role } = useAuth();
  const queryClient = useQueryClient();
  const [newUpdate, setNewUpdate] = useState('');

  const { data: updates = [] } = useQuery({
    queryKey: ['lead-updates', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_updates')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as LeadUpdate[];
    },
  });

  const addUpdate = useMutation({
    mutationFn: async () => {
      if (!user || !newUpdate.trim()) return;
      const { error } = await supabase.from('lead_updates').insert({
        lead_id: leadId,
        author_id: user.id,
        author_name: profile?.full_name ?? 'Unknown',
        author_role: role,
        content: newUpdate.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewUpdate('');
      queryClient.invalidateQueries({ queryKey: ['lead-updates', leadId] });
    },
  });

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Updated Details</h3>

      {/* Add update */}
      <div className="flex gap-2">
        <Textarea
          value={newUpdate}
          onChange={e => setNewUpdate(e.target.value)}
          placeholder="Add an update..."
          rows={2}
          className="flex-1"
        />
        <Button
          onClick={() => addUpdate.mutate()}
          disabled={!newUpdate.trim() || addUpdate.isPending}
          size="sm"
          className="self-end"
        >
          Post
        </Button>
      </div>

      {/* Feed */}
      <div className="space-y-3">
        {updates.map((u) => (
          <div key={u.id} className="border rounded-md p-3 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{u.author_name}</span>
              <span className="capitalize px-1.5 py-0.5 rounded bg-muted text-[10px]">
                {u.author_role.replace('_', ' ')}
              </span>
              <span>·</span>
              <span>{format(new Date(u.created_at), 'MMM d, yyyy h:mm a')}</span>
            </div>
            <p className="text-sm text-foreground">{u.content}</p>
          </div>
        ))}
        {updates.length === 0 && (
          <p className="text-sm text-muted-foreground">No updates yet.</p>
        )}
      </div>
    </div>
  );
};

export default LeadUpdatesSection;
