-- Migration: Add B-tree indexes for QUO Dashboard performance optimization

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_quo_conversations_status ON public.quo_conversations (status);

-- Index for date filtering and sorting by created_at in Eastern Time
CREATE INDEX IF NOT EXISTS idx_quo_conversations_created_at_desc ON public.quo_conversations (created_at DESC);

-- Composite index for QUO number filtering and date sorting
CREATE INDEX IF NOT EXISTS idx_quo_conversations_number_created ON public.quo_conversations (number_id, created_at DESC);

-- Index for customer phone number matching
CREATE INDEX IF NOT EXISTS idx_quo_conversations_customer_number ON public.quo_conversations (customer_number);

-- Index for quo_messages conversation lookup and timestamp ordering
CREATE INDEX IF NOT EXISTS idx_quo_messages_conv_created ON public.quo_messages (conversation_id, created_at ASC);
