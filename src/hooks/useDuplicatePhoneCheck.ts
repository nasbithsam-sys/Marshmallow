import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useDuplicatePhoneCheck(phone: string, excludeLeadId?: string) {
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [duplicateLeadName, setDuplicateLeadName] = useState('');
  const [checking, setChecking] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Need at least 7 digits to check
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) {
      setIsDuplicate(false);
      setDuplicateLeadName('');
      return;
    }

    setChecking(true);
    debounceRef.current = setTimeout(async () => {
      try {
        // Search for leads with matching phone (strip formatting for comparison)
        const { data } = await supabase
          .from('leads')
          .select('id, customer_name, customer_phone')
          .neq('status', 'cancelled');

        if (data) {
          const match = data.find((lead: any) => {
            if (excludeLeadId && lead.id === excludeLeadId) return false;
            const leadDigits = (lead.customer_phone || '').replace(/\D/g, '');
            return leadDigits.length >= 7 && leadDigits === digits;
          });

          if (match) {
            setIsDuplicate(true);
            setDuplicateLeadName(match.customer_name);
          } else {
            setIsDuplicate(false);
            setDuplicateLeadName('');
          }
        }
      } catch {
        // ignore errors
      }
      setChecking(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [phone, excludeLeadId]);

  return { isDuplicate, duplicateLeadName, checking };
}
