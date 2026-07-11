
WITH latest AS (
  SELECT DISTINCT ON (conversation_id)
    conversation_id,
    text,
    COALESCE(quo_created_at, message_time, created_at) AS ts,
    direction
  FROM public.quo_messages
  ORDER BY conversation_id, COALESCE(quo_created_at, message_time, created_at) DESC NULLS LAST
),
last_cust AS (
  SELECT conversation_id, MAX(COALESCE(quo_created_at, message_time, created_at)) AS ts
  FROM public.quo_messages WHERE direction = 'inbound' GROUP BY conversation_id
),
last_agent AS (
  SELECT conversation_id, MAX(COALESCE(quo_created_at, message_time, created_at)) AS ts
  FROM public.quo_messages WHERE direction = 'outbound' GROUP BY conversation_id
)
UPDATE public.quo_conversations c
SET
  last_message_preview = LEFT(COALESCE(l.text, ''), 500),
  last_message_at = l.ts,
  direction = COALESCE(l.direction, c.direction),
  last_customer_message_at = COALESCE(lc.ts, c.last_customer_message_at),
  last_agent_message_at = COALESCE(la.ts, c.last_agent_message_at)
FROM latest l
LEFT JOIN last_cust lc ON lc.conversation_id = l.conversation_id
LEFT JOIN last_agent la ON la.conversation_id = l.conversation_id
WHERE c.id = l.conversation_id;
