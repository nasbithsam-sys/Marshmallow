import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const WEBHOOK_TOKEN = Deno.env.get('QUO_WEBHOOK_TOKEN');
    
    // Simple token validation (assume passed in headers or query for simplicity if not signed, 
    // but typically Quo sends it in header or we check url param)
    const url = new URL(req.url);
    const token = url.searchParams.get('token') || req.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (WEBHOOK_TOKEN && token !== WEBHOOK_TOKEN) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const payload = await req.json()
    
    // Expected Quo payload structure for a new message
    // payload.data.message = { id, text, createdAt, direction, conversationId, etc. }
    // payload.data.conversation = { id, contact: { name, phoneNumbers }, etc. }
    const message = payload?.data?.message || payload;
    const conversation = payload?.data?.conversation || payload?.conversation;
    
    if (!message || !message.id) {
        return new Response(JSON.stringify({ error: 'Invalid payload: missing message id' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey =
      Deno.env.get('SB_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !supabaseServiceKey) {
        return new Response(JSON.stringify({ error: 'Missing Supabase service configuration' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const quoMessageId = message.id;
    const quoConversationId = conversation?.id || message.conversationId;
    
    // Extract customer info
    const customerName = conversation?.contact?.name || 'Unknown Contact';
    const customerNumber = conversation?.contact?.phoneNumbers?.[0]?.value || message.from;
    const direction = message.direction === 'inbound' || message.direction === 'incoming' ? 'incoming' : 'outgoing';
    const sender = direction === 'incoming' ? 'customer' : 'agent';
    const text = message.text || '';
    const messageTime = message.createdAt ? new Date(message.createdAt).toISOString() : new Date().toISOString();
    
    // 1. Upsert Conversation
    // Use upsert on quo_conversation_id
    const { data: convData, error: convError } = await supabase
        .from('quo_conversations')
        .upsert({
            quo_conversation_id: quoConversationId,
            customer_name: customerName,
            customer_number: customerNumber,
            last_message_preview: text.substring(0, 200),
            last_message_time: messageTime,
            direction: direction,
            status: 'active',
            raw_payload: payload
        }, { onConflict: 'quo_conversation_id' })
        .select('id')
        .single();

    if (convError) {
        throw new Error(`Failed to upsert conversation: ${convError.message}`);
    }

    const internalConversationId = convData.id;

    // 2. Insert Message safely (ignore duplicates)
    const { error: msgError } = await supabase
        .from('quo_messages')
        .upsert({
            quo_message_id: quoMessageId,
            conversation_id: internalConversationId,
            sender: sender,
            text: text,
            message_time: messageTime,
            raw_payload: payload
        }, { onConflict: 'quo_message_id', ignoreDuplicates: false }); 
        // ignoreDuplicates: false will update the row if it exists, which is safe upsert

    if (msgError) {
        throw new Error(`Failed to upsert message: ${msgError.message}`);
    }
    
    // 3. Ensure Flags row exists
    const { error: flagError } = await supabase
        .from('quo_conversation_flags')
        .upsert({
            conversation_id: internalConversationId,
            // Keep existing values or default to false
        }, { onConflict: 'conversation_id', ignoreDuplicates: true });

    if (flagError) {
        console.error('Flag error:', flagError);
    }

    // 4. Trigger Analysis Function asynchronously
    // Deno edge functions can call other functions without awaiting their completion
    // or just invoke it and don't await
    try {
       supabase.functions.invoke('quo-analyze-conversations', {
           body: { conversation_id: internalConversationId }
       });
    } catch (e) {
       console.error("Failed to invoke analysis", e);
    }

    return new Response(JSON.stringify({ success: true, messageId: quoMessageId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
