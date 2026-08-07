-- Trigram indexes for suffix phone matching used by the Quo chat drawer
CREATE INDEX IF NOT EXISTS quo_conversations_customer_number_trgm_idx
  ON public.quo_conversations USING gin (customer_number extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS quo_outbound_messages_to_number_trgm_idx
  ON public.quo_outbound_messages USING gin (to_number extensions.gin_trgm_ops);

-- Missing foreign-key indexes (CRM tables)
CREATE INDEX IF NOT EXISTS idx_lead_payment_requests_requested_by ON public.lead_payment_requests (requested_by);
CREATE INDEX IF NOT EXISTS idx_lead_payment_requests_reviewed_by ON public.lead_payment_requests (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_lead_operator_assignments_assigned_by ON public.lead_operator_assignments (assigned_by);
CREATE INDEX IF NOT EXISTS idx_technicians_created_by ON public.technicians (created_by);
CREATE INDEX IF NOT EXISTS idx_quo_number_preferences_updated_by ON public.quo_number_preferences (updated_by);
CREATE INDEX IF NOT EXISTS idx_quo_pinned_conversations_pinned_by ON public.quo_pinned_conversations (pinned_by);

-- Missing foreign-key indexes (Quo AI tables)
CREATE INDEX IF NOT EXISTS idx_quo_ai_jobs_latest_message_id ON public.quo_ai_jobs (latest_message_id);
CREATE INDEX IF NOT EXISTS idx_quo_ai_cost_logs_conversation_id ON public.quo_ai_cost_logs (conversation_id);
CREATE INDEX IF NOT EXISTS idx_quo_ai_cost_logs_job_id ON public.quo_ai_cost_logs (job_id);
CREATE INDEX IF NOT EXISTS idx_quo_ai_tags_approved_by_user_id ON public.quo_ai_tags (approved_by_user_id);
CREATE INDEX IF NOT EXISTS idx_quo_ai_tasks_approved_by_user_id ON public.quo_ai_tasks (approved_by_user_id);
CREATE INDEX IF NOT EXISTS idx_quo_ai_tasks_assigned_user_id ON public.quo_ai_tasks (assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_quo_ai_tasks_completed_by_user_id ON public.quo_ai_tasks (completed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_quo_ai_tasks_linked_lead_id ON public.quo_ai_tasks (linked_lead_id);
CREATE INDEX IF NOT EXISTS idx_quo_ai_feedback_task_id ON public.quo_ai_feedback (task_id);
CREATE INDEX IF NOT EXISTS idx_quo_ai_feedback_tag_id ON public.quo_ai_feedback (tag_id);
CREATE INDEX IF NOT EXISTS idx_quo_ai_feedback_user_id ON public.quo_ai_feedback (user_id);
CREATE INDEX IF NOT EXISTS idx_quo_ai_conv_state_assigned_user_id ON public.quo_ai_conversation_state (assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_quo_ai_conv_state_last_message_id ON public.quo_ai_conversation_state (last_message_id);
CREATE INDEX IF NOT EXISTS idx_quo_ai_conv_state_linked_lead_id ON public.quo_ai_conversation_state (linked_lead_id);
CREATE INDEX IF NOT EXISTS idx_quo_ai_conv_state_phone_number_id ON public.quo_ai_conversation_state (quo_phone_number_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_decision_id ON public.ai_audit_logs (decision_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_user_id ON public.ai_audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversation_states_latest_decision ON public.ai_conversation_states (latest_decision_id);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_latest_message_id ON public.ai_decisions (latest_message_id);
CREATE INDEX IF NOT EXISTS idx_ai_reminders_lead_id ON public.ai_reminders (lead_id);
CREATE INDEX IF NOT EXISTS idx_ai_reminders_source_message_id ON public.ai_reminders (source_message_id);
CREATE INDEX IF NOT EXISTS idx_ai_review_queue_conversation_id ON public.ai_review_queue (conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_review_queue_decision_id ON public.ai_review_queue (decision_id);
CREATE INDEX IF NOT EXISTS idx_ai_review_queue_reviewed_by ON public.ai_review_queue (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_conversation_id ON public.ai_usage_logs (conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_decision_id ON public.ai_usage_logs (decision_id);