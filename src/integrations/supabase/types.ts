export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string | null
          details: string | null
          id: string
          target_id: string | null
          target_type: string
          user_id: string | null
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: string | null
          id?: string
          target_id?: string | null
          target_type: string
          user_id?: string | null
          user_name: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: string | null
          id?: string
          target_id?: string | null
          target_type?: string
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_audit_logs: {
        Row: {
          action: string
          conversation_id: string | null
          created_at: string
          decision_id: string | null
          details: Json
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          conversation_id?: string | null
          created_at?: string
          decision_id?: string | null
          details?: Json
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          conversation_id?: string | null
          created_at?: string
          decision_id?: string | null
          details?: Json
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_audit_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "quo_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_audit_logs_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "ai_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversation_states: {
        Row: {
          confidence: number
          conversation_id: string
          customer_state: string
          evidence: Json
          human_review_status: string
          is_lost: boolean
          is_possible_dead: boolean
          latest_decision_id: string | null
          lead_state: string | null
          lost_reason: string | null
          needs_reply: boolean
          priority: string
          risk_level: string
          section: string
          should_create_lead: boolean
          should_create_reminder: boolean
          should_link_lead: boolean
          updated_at: string
        }
        Insert: {
          confidence?: number
          conversation_id: string
          customer_state?: string
          evidence?: Json
          human_review_status?: string
          is_lost?: boolean
          is_possible_dead?: boolean
          latest_decision_id?: string | null
          lead_state?: string | null
          lost_reason?: string | null
          needs_reply?: boolean
          priority?: string
          risk_level?: string
          section?: string
          should_create_lead?: boolean
          should_create_reminder?: boolean
          should_link_lead?: boolean
          updated_at?: string
        }
        Update: {
          confidence?: number
          conversation_id?: string
          customer_state?: string
          evidence?: Json
          human_review_status?: string
          is_lost?: boolean
          is_possible_dead?: boolean
          latest_decision_id?: string | null
          lead_state?: string | null
          lost_reason?: string | null
          needs_reply?: boolean
          priority?: string
          risk_level?: string
          section?: string
          should_create_lead?: boolean
          should_create_reminder?: boolean
          should_link_lead?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversation_states_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "quo_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversation_states_latest_decision_id_fkey"
            columns: ["latest_decision_id"]
            isOneToOne: false
            referencedRelation: "ai_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_decisions: {
        Row: {
          applied_actions: Json
          completion_tokens: number | null
          confidence: number
          conversation_id: string
          created_at: string
          estimated_cost_usd: number | null
          evidence_message_ids: string[]
          id: string
          input_hash: string
          input_snapshot: Json
          latest_message_id: string | null
          model_used: string | null
          needs_human_review: boolean
          output_json: Json
          prompt_tokens: number | null
          reason: string | null
          risk_level: string
          skipped_actions: Json
        }
        Insert: {
          applied_actions?: Json
          completion_tokens?: number | null
          confidence?: number
          conversation_id: string
          created_at?: string
          estimated_cost_usd?: number | null
          evidence_message_ids?: string[]
          id?: string
          input_hash: string
          input_snapshot: Json
          latest_message_id?: string | null
          model_used?: string | null
          needs_human_review?: boolean
          output_json: Json
          prompt_tokens?: number | null
          reason?: string | null
          risk_level?: string
          skipped_actions?: Json
        }
        Update: {
          applied_actions?: Json
          completion_tokens?: number | null
          confidence?: number
          conversation_id?: string
          created_at?: string
          estimated_cost_usd?: number | null
          evidence_message_ids?: string[]
          id?: string
          input_hash?: string
          input_snapshot?: Json
          latest_message_id?: string | null
          model_used?: string | null
          needs_human_review?: boolean
          output_json?: Json
          prompt_tokens?: number | null
          reason?: string | null
          risk_level?: string
          skipped_actions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_decisions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "quo_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_decisions_latest_message_id_fkey"
            columns: ["latest_message_id"]
            isOneToOne: false
            referencedRelation: "quo_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_lead_links: {
        Row: {
          confidence: number
          conversation_id: string
          created_at: string
          created_by_ai: boolean
          id: string
          lead_id: string
          match_type: string
        }
        Insert: {
          confidence?: number
          conversation_id: string
          created_at?: string
          created_by_ai?: boolean
          id?: string
          lead_id: string
          match_type?: string
        }
        Update: {
          confidence?: number
          conversation_id?: string
          created_at?: string
          created_by_ai?: boolean
          id?: string
          lead_id?: string
          match_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_lead_links_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "quo_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_lead_links_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_reminders: {
        Row: {
          completed_at: string | null
          conversation_id: string
          created_at: string
          created_by_ai: boolean
          due_at: string
          id: string
          lead_id: string | null
          notify_one_day_before: boolean
          notify_same_day: boolean
          reason: string | null
          reminder_type: string
          source_message_id: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          conversation_id: string
          created_at?: string
          created_by_ai?: boolean
          due_at: string
          id?: string
          lead_id?: string | null
          notify_one_day_before?: boolean
          notify_same_day?: boolean
          reason?: string | null
          reminder_type?: string
          source_message_id?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          conversation_id?: string
          created_at?: string
          created_by_ai?: boolean
          due_at?: string
          id?: string
          lead_id?: string | null
          notify_one_day_before?: boolean
          notify_same_day?: boolean
          reason?: string | null
          reminder_type?: string
          source_message_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_reminders_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "quo_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_reminders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_reminders_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "quo_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_review_queue: {
        Row: {
          conversation_id: string
          created_at: string
          decision_id: string | null
          id: string
          reason: string
          review_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suggested_action: Json
        }
        Insert: {
          conversation_id: string
          created_at?: string
          decision_id?: string | null
          id?: string
          reason: string
          review_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_action?: Json
        }
        Update: {
          conversation_id?: string
          created_at?: string
          decision_id?: string | null
          id?: string
          reason?: string
          review_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_action?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_review_queue_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "quo_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_review_queue_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "ai_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          call_type: string
          conversation_id: string | null
          created_at: string
          decision_id: string | null
          estimated_cost_usd: number
          id: string
          input_tokens: number
          model_used: string
          output_tokens: number
          skip_reason: string | null
          skipped: boolean
        }
        Insert: {
          call_type?: string
          conversation_id?: string | null
          created_at?: string
          decision_id?: string | null
          estimated_cost_usd?: number
          id?: string
          input_tokens?: number
          model_used: string
          output_tokens?: number
          skip_reason?: string | null
          skipped?: boolean
        }
        Update: {
          call_type?: string
          conversation_id?: string | null
          created_at?: string
          decision_id?: string | null
          estimated_cost_usd?: number
          id?: string
          input_tokens?: number
          model_used?: string
          output_tokens?: number
          skip_reason?: string | null
          skipped?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "quo_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "ai_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          call_date: string
          created_at: string
          created_by: string
          customer_message: string | null
          direction: string
          flag: string
          handled_by: string | null
          id: string
          linked_lead_id: string | null
          notes: string | null
          number_name: string
          updated_at: string
        }
        Insert: {
          call_date?: string
          created_at?: string
          created_by: string
          customer_message?: string | null
          direction: string
          flag?: string
          handled_by?: string | null
          id?: string
          linked_lead_id?: string | null
          notes?: string | null
          number_name: string
          updated_at?: string
        }
        Update: {
          call_date?: string
          created_at?: string
          created_by?: string
          customer_message?: string | null
          direction?: string
          flag?: string
          handled_by?: string | null
          id?: string
          linked_lead_id?: string | null
          notes?: string | null
          number_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_update_receipts: {
        Row: {
          acknowledged_at: string
          id: string
          notification_id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          id?: string
          notification_id: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          id?: string
          notification_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_update_receipts_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "crm_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_updates: {
        Row: {
          affected_section: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_active: boolean
          priority: string
          published_at: string
          target_roles: string[]
          title: string
          updated_at: string
        }
        Insert: {
          affected_section: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          is_active?: boolean
          priority?: string
          published_at?: string
          target_roles: string[]
          title: string
          updated_at?: string
        }
        Update: {
          affected_section?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_active?: boolean
          priority?: string
          published_at?: string
          target_roles?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_cancellation_requests: {
        Row: {
          comment: string
          created_at: string
          id: string
          lead_id: string
          previous_status: string
          proof: string | null
          proof_image_path: string | null
          requested_by: string | null
          requested_by_name: string | null
          requested_by_role: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          lead_id: string
          previous_status: string
          proof?: string | null
          proof_image_path?: string | null
          requested_by?: string | null
          requested_by_name?: string | null
          requested_by_role: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          lead_id?: string
          previous_status?: string
          proof?: string | null
          proof_image_path?: string | null
          requested_by?: string | null
          requested_by_name?: string | null
          requested_by_role?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_cancellation_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cancellation_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cancellation_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cancellation_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cancellation_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_drafts: {
        Row: {
          draft_data: Json
          id: string
          lead_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          draft_data: Json
          id?: string
          lead_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          draft_data?: Json
          id?: string
          lead_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_drafts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          content: string
          created_at: string | null
          id: string
          lead_id: string
          note_type: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          lead_id: string
          note_type: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          lead_id?: string
          note_type?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_payment_requests: {
        Row: {
          amount: number
          comment: string | null
          created_at: string
          id: string
          lead_id: string
          previous_status: string
          requested_by: string | null
          requested_by_name: string | null
          requested_by_role: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_name: string | null
          screenshot_path: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          comment?: string | null
          created_at?: string
          id?: string
          lead_id: string
          previous_status: string
          requested_by?: string | null
          requested_by_name?: string | null
          requested_by_role: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          screenshot_path?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          comment?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          previous_status?: string
          requested_by?: string | null
          requested_by_name?: string | null
          requested_by_role?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          screenshot_path?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_payment_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_payment_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_payment_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_payment_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_payment_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_payments: {
        Row: {
          amount: number | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          id: string
          lead_id: string
          screenshot_url: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          lead_id: string
          screenshot_url?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          lead_id?: string
          screenshot_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_payments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_photos: {
        Row: {
          created_at: string | null
          id: string
          lead_id: string
          photo_url: string
          uploaded_by: string | null
          uploaded_by_name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lead_id: string
          photo_url: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lead_id?: string
          photo_url?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_photos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_shares: {
        Row: {
          created_at: string | null
          id: string
          lead_id: string
          shared_by: string
          shared_with_user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lead_id: string
          shared_by: string
          shared_with_user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lead_id?: string
          shared_by?: string
          shared_with_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_shares_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_status_visibility: {
        Row: {
          created_at: string
          id: string
          is_visible: boolean
          role: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_visible?: boolean
          role?: string | null
          status: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_visible?: boolean
          role?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_status_visibility_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_status_visibility_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_updates: {
        Row: {
          author_id: string | null
          author_name: string
          author_role: string
          content: string
          created_at: string | null
          id: string
          lead_id: string
        }
        Insert: {
          author_id?: string | null
          author_name: string
          author_role: string
          content: string
          created_at?: string | null
          id?: string
          lead_id: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          author_role?: string
          content?: string
          created_at?: string | null
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_updates_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_updates_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_updates_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string | null
          amount: number | null
          assigned_cs: string | null
          booked_at: string | null
          cancellation_reason: string | null
          city: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          cs_notes: string | null
          cs_tag: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string
          customer_schedule_requirements: string | null
          direction: string | null
          for_us_amount: number | null
          for_you_amount: number | null
          general_notes: string | null
          half_address: string | null
          id: string
          job_id: string
          labor_amount: number | null
          last_edited_at: string | null
          last_edited_by: string | null
          last_edited_by_name: string | null
          latitude: number | null
          longitude: number | null
          material_amount: number | null
          number_name: string | null
          payment_amount: number | null
          payment_screenshot_url: string | null
          processor_notes: string | null
          quote: string | null
          reference_name: string | null
          scheduled_date: string | null
          scheduled_time_end: string | null
          scheduled_time_start: string | null
          service_details: string | null
          service_type: string
          source_url: string | null
          state: string | null
          status: string
          tech_name: string | null
          tech_number: string | null
          terms: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          amount?: number | null
          assigned_cs?: string | null
          booked_at?: string | null
          cancellation_reason?: string | null
          city?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          cs_notes?: string | null
          cs_tag?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          customer_schedule_requirements?: string | null
          direction?: string | null
          for_us_amount?: number | null
          for_you_amount?: number | null
          general_notes?: string | null
          half_address?: string | null
          id?: string
          job_id: string
          labor_amount?: number | null
          last_edited_at?: string | null
          last_edited_by?: string | null
          last_edited_by_name?: string | null
          latitude?: number | null
          longitude?: number | null
          material_amount?: number | null
          number_name?: string | null
          payment_amount?: number | null
          payment_screenshot_url?: string | null
          processor_notes?: string | null
          quote?: string | null
          reference_name?: string | null
          scheduled_date?: string | null
          scheduled_time_end?: string | null
          scheduled_time_start?: string | null
          service_details?: string | null
          service_type: string
          source_url?: string | null
          state?: string | null
          status?: string
          tech_name?: string | null
          tech_number?: string | null
          terms?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          amount?: number | null
          assigned_cs?: string | null
          booked_at?: string | null
          cancellation_reason?: string | null
          city?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          cs_notes?: string | null
          cs_tag?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          customer_schedule_requirements?: string | null
          direction?: string | null
          for_us_amount?: number | null
          for_you_amount?: number | null
          general_notes?: string | null
          half_address?: string | null
          id?: string
          job_id?: string
          labor_amount?: number | null
          last_edited_at?: string | null
          last_edited_by?: string | null
          last_edited_by_name?: string | null
          latitude?: number | null
          longitude?: number | null
          material_amount?: number | null
          number_name?: string | null
          payment_amount?: number | null
          payment_screenshot_url?: string | null
          processor_notes?: string | null
          quote?: string | null
          reference_name?: string | null
          scheduled_date?: string | null
          scheduled_time_end?: string | null
          scheduled_time_start?: string | null
          service_details?: string | null
          service_type?: string
          source_url?: string | null
          state?: string | null
          status?: string
          tech_name?: string | null
          tech_number?: string | null
          terms?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_cs_fkey"
            columns: ["assigned_cs"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_assigned_cs_fkey"
            columns: ["assigned_cs"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_last_edited_by_fkey"
            columns: ["last_edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_last_edited_by_fkey"
            columns: ["last_edited_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      navigation_permissions: {
        Row: {
          allowed: boolean | null
          id: string
          nav_section: string
          user_id: string
        }
        Insert: {
          allowed?: boolean | null
          id?: string
          nav_section: string
          user_id: string
        }
        Update: {
          allowed?: boolean | null
          id?: string
          nav_section?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          lead_id: string | null
          message: string
          read: boolean | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lead_id?: string | null
          message: string
          read?: boolean | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lead_id?: string | null
          message?: string
          read?: boolean | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      quo_ai_conversation_state: {
        Row: {
          ai_summary: string | null
          assigned_role: string
          assigned_user_id: string | null
          confidence: number
          conversation_id: string
          created_at: string
          current_status: string
          customer_issue: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_situation: Json
          evidence: Json
          human_review_reason: string | null
          id: string
          last_ai_checked_at: string | null
          last_message_id: string | null
          lead_stage: string
          linked_lead_id: string | null
          missing_information: Json
          next_action: string | null
          next_action_due_at: string | null
          payment_status: string
          quo_phone_number_id: string | null
          quote_status: string
          requires_human_review: boolean
          risk_level: string
          schedule_status: string
          scheduled_for: string | null
          sentiment: string
          service_needed: string | null
          updated_at: string
          urgency_level: string
          urgency_score: number
          waiting_on: string
        }
        Insert: {
          ai_summary?: string | null
          assigned_role?: string
          assigned_user_id?: string | null
          confidence?: number
          conversation_id: string
          created_at?: string
          current_status?: string
          customer_issue?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_situation?: Json
          evidence?: Json
          human_review_reason?: string | null
          id?: string
          last_ai_checked_at?: string | null
          last_message_id?: string | null
          lead_stage?: string
          linked_lead_id?: string | null
          missing_information?: Json
          next_action?: string | null
          next_action_due_at?: string | null
          payment_status?: string
          quo_phone_number_id?: string | null
          quote_status?: string
          requires_human_review?: boolean
          risk_level?: string
          schedule_status?: string
          scheduled_for?: string | null
          sentiment?: string
          service_needed?: string | null
          updated_at?: string
          urgency_level?: string
          urgency_score?: number
          waiting_on?: string
        }
        Update: {
          ai_summary?: string | null
          assigned_role?: string
          assigned_user_id?: string | null
          confidence?: number
          conversation_id?: string
          created_at?: string
          current_status?: string
          customer_issue?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_situation?: Json
          evidence?: Json
          human_review_reason?: string | null
          id?: string
          last_ai_checked_at?: string | null
          last_message_id?: string | null
          lead_stage?: string
          linked_lead_id?: string | null
          missing_information?: Json
          next_action?: string | null
          next_action_due_at?: string | null
          payment_status?: string
          quo_phone_number_id?: string | null
          quote_status?: string
          requires_human_review?: boolean
          risk_level?: string
          schedule_status?: string
          scheduled_for?: string | null
          sentiment?: string
          service_needed?: string | null
          updated_at?: string
          urgency_level?: string
          urgency_score?: number
          waiting_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "quo_ai_conversation_state_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "quo_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quo_ai_conversation_state_last_message_id_fkey"
            columns: ["last_message_id"]
            isOneToOne: false
            referencedRelation: "quo_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quo_ai_conversation_state_linked_lead_id_fkey"
            columns: ["linked_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quo_ai_conversation_state_quo_phone_number_id_fkey"
            columns: ["quo_phone_number_id"]
            isOneToOne: false
            referencedRelation: "quo_phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      quo_ai_cost_logs: {
        Row: {
          conversation_id: string | null
          created_at: string
          estimated_cost: number
          feature: string
          id: string
          input_tokens: number
          job_id: string | null
          model: string
          output_tokens: number
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          estimated_cost?: number
          feature: string
          id?: string
          input_tokens?: number
          job_id?: string | null
          model: string
          output_tokens?: number
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          estimated_cost?: number
          feature?: string
          id?: string
          input_tokens?: number
          job_id?: string | null
          model?: string
          output_tokens?: number
        }
        Relationships: [
          {
            foreignKeyName: "quo_ai_cost_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "quo_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quo_ai_cost_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "quo_ai_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      quo_ai_daily_briefs: {
        Row: {
          brief_date: string
          created_at: string
          generated_by_ai: boolean
          id: string
          metrics: Json
          model: string | null
          summary: string | null
          urgent_items: Json
        }
        Insert: {
          brief_date?: string
          created_at?: string
          generated_by_ai?: boolean
          id?: string
          metrics?: Json
          model?: string | null
          summary?: string | null
          urgent_items?: Json
        }
        Update: {
          brief_date?: string
          created_at?: string
          generated_by_ai?: boolean
          id?: string
          metrics?: Json
          model?: string | null
          summary?: string | null
          urgent_items?: Json
        }
        Relationships: []
      }
      quo_ai_events: {
        Row: {
          confidence: number
          conversation_id: string
          created_at: string
          event_json: Json
          event_type: string
          evidence: Json
          extracted_at: string
          id: string
        }
        Insert: {
          confidence?: number
          conversation_id: string
          created_at?: string
          event_json?: Json
          event_type: string
          evidence?: Json
          extracted_at?: string
          id?: string
        }
        Update: {
          confidence?: number
          conversation_id?: string
          created_at?: string
          event_json?: Json
          event_type?: string
          evidence?: Json
          extracted_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quo_ai_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "quo_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      quo_ai_feedback: {
        Row: {
          conversation_id: string
          corrected_json: Json | null
          created_at: string
          feedback_type: string
          id: string
          previous_ai_json: Json | null
          tag_id: string | null
          task_id: string | null
          user_id: string
          user_note: string | null
        }
        Insert: {
          conversation_id: string
          corrected_json?: Json | null
          created_at?: string
          feedback_type: string
          id?: string
          previous_ai_json?: Json | null
          tag_id?: string | null
          task_id?: string | null
          user_id: string
          user_note?: string | null
        }
        Update: {
          conversation_id?: string
          corrected_json?: Json | null
          created_at?: string
          feedback_type?: string
          id?: string
          previous_ai_json?: Json | null
          tag_id?: string | null
          task_id?: string | null
          user_id?: string
          user_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quo_ai_feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "quo_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quo_ai_feedback_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "quo_ai_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quo_ai_feedback_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "quo_ai_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      quo_ai_jobs: {
        Row: {
          attempts: number
          conversation_id: string
          created_at: string
          error_message: string | null
          id: string
          input_hash: string | null
          job_type: string
          latest_message_id: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          priority: string
          run_after: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          conversation_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          input_hash?: string | null
          job_type?: string
          latest_message_id?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          priority?: string
          run_after?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          conversation_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          input_hash?: string | null
          job_type?: string
          latest_message_id?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          priority?: string
          run_after?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quo_ai_jobs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "quo_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quo_ai_jobs_latest_message_id_fkey"
            columns: ["latest_message_id"]
            isOneToOne: false
            referencedRelation: "quo_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      quo_ai_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      quo_ai_tags: {
        Row: {
          approved_by_user_id: string | null
          confidence: number
          conversation_id: string
          created_at: string
          created_by_ai: boolean
          evidence: Json
          id: string
          reason: string | null
          status: string
          tag: string
          updated_at: string
        }
        Insert: {
          approved_by_user_id?: string | null
          confidence?: number
          conversation_id: string
          created_at?: string
          created_by_ai?: boolean
          evidence?: Json
          id?: string
          reason?: string | null
          status?: string
          tag: string
          updated_at?: string
        }
        Update: {
          approved_by_user_id?: string | null
          confidence?: number
          conversation_id?: string
          created_at?: string
          created_by_ai?: boolean
          evidence?: Json
          id?: string
          reason?: string | null
          status?: string
          tag?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quo_ai_tags_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "quo_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      quo_ai_tasks: {
        Row: {
          approved_by_user_id: string | null
          assigned_role: string
          assigned_user_id: string | null
          completed_at: string | null
          completed_by_user_id: string | null
          conversation_id: string
          created_at: string
          created_by_ai: boolean
          due_at: string | null
          evidence: Json
          id: string
          instructions: string | null
          linked_lead_id: string | null
          priority: string
          reason: string | null
          requires_human_review: boolean
          snoozed_until: string | null
          status: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_by_user_id?: string | null
          assigned_role?: string
          assigned_user_id?: string | null
          completed_at?: string | null
          completed_by_user_id?: string | null
          conversation_id: string
          created_at?: string
          created_by_ai?: boolean
          due_at?: string | null
          evidence?: Json
          id?: string
          instructions?: string | null
          linked_lead_id?: string | null
          priority?: string
          reason?: string | null
          requires_human_review?: boolean
          snoozed_until?: string | null
          status?: string
          task_type: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_by_user_id?: string | null
          assigned_role?: string
          assigned_user_id?: string | null
          completed_at?: string | null
          completed_by_user_id?: string | null
          conversation_id?: string
          created_at?: string
          created_by_ai?: boolean
          due_at?: string | null
          evidence?: Json
          id?: string
          instructions?: string | null
          linked_lead_id?: string | null
          priority?: string
          reason?: string | null
          requires_human_review?: boolean
          snoozed_until?: string | null
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quo_ai_tasks_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "quo_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quo_ai_tasks_linked_lead_id_fkey"
            columns: ["linked_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      quo_conversation_flags: {
        Row: {
          conversation_id: string
          created_at: string
          followed_up_at: string | null
          is_dead: boolean
          is_delayed: boolean
          is_important: boolean
          last_agent_reply_time: string | null
          last_customer_reply_time: string | null
          needs_follow_up: boolean
          reason: string | null
          response_delay: string | null
          rule_result: string | null
          suggested_action: string | null
          updated_at: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          followed_up_at?: string | null
          is_dead?: boolean
          is_delayed?: boolean
          is_important?: boolean
          last_agent_reply_time?: string | null
          last_customer_reply_time?: string | null
          needs_follow_up?: boolean
          reason?: string | null
          response_delay?: string | null
          rule_result?: string | null
          suggested_action?: string | null
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          followed_up_at?: string | null
          is_dead?: boolean
          is_delayed?: boolean
          is_important?: boolean
          last_agent_reply_time?: string | null
          last_customer_reply_time?: string | null
          needs_follow_up?: boolean
          reason?: string | null
          response_delay?: string | null
          rule_result?: string | null
          suggested_action?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quo_conversation_flags_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "quo_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      quo_conversations: {
        Row: {
          ai_tags: string[]
          created_at: string
          current_ai_section: string
          current_priority: string
          current_status: string
          customer_name: string | null
          customer_number: string | null
          direction: string | null
          id: string
          last_agent_message_at: string | null
          last_ai_analyzed_at: string | null
          last_customer_message_at: string | null
          last_message_at: string | null
          last_message_preview: string | null
          last_message_time: string | null
          linked_lead_id: string | null
          number_id: string | null
          quo_conversation_id: string
          raw_payload: Json | null
          rolling_ai_summary: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          ai_tags?: string[]
          created_at?: string
          current_ai_section?: string
          current_priority?: string
          current_status?: string
          customer_name?: string | null
          customer_number?: string | null
          direction?: string | null
          id?: string
          last_agent_message_at?: string | null
          last_ai_analyzed_at?: string | null
          last_customer_message_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          last_message_time?: string | null
          linked_lead_id?: string | null
          number_id?: string | null
          quo_conversation_id: string
          raw_payload?: Json | null
          rolling_ai_summary?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          ai_tags?: string[]
          created_at?: string
          current_ai_section?: string
          current_priority?: string
          current_status?: string
          customer_name?: string | null
          customer_number?: string | null
          direction?: string | null
          id?: string
          last_agent_message_at?: string | null
          last_ai_analyzed_at?: string | null
          last_customer_message_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          last_message_time?: string | null
          linked_lead_id?: string | null
          number_id?: string | null
          quo_conversation_id?: string
          raw_payload?: Json | null
          rolling_ai_summary?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quo_conversations_linked_lead_id_fkey"
            columns: ["linked_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quo_conversations_number_id_fkey"
            columns: ["number_id"]
            isOneToOne: false
            referencedRelation: "quo_phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      quo_messages: {
        Row: {
          conversation_id: string | null
          created_at: string
          direction: string | null
          id: string
          inserted_at: string
          media: Json
          message_time: string | null
          quo_created_at: string | null
          quo_message_id: string
          raw_payload: Json | null
          recipients: Json
          sender: string
          status: string | null
          text: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          direction?: string | null
          id?: string
          inserted_at?: string
          media?: Json
          message_time?: string | null
          quo_created_at?: string | null
          quo_message_id: string
          raw_payload?: Json | null
          recipients?: Json
          sender: string
          status?: string | null
          text?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          direction?: string | null
          id?: string
          inserted_at?: string
          media?: Json
          message_time?: string | null
          quo_created_at?: string | null
          quo_message_id?: string
          raw_payload?: Json | null
          recipients?: Json
          sender?: string
          status?: string | null
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quo_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "quo_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      quo_number_preferences: {
        Row: {
          created_at: string
          emoji: string
          hidden: boolean
          id: string
          label_override: string | null
          phone_number_id: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          emoji?: string
          hidden?: boolean
          id?: string
          label_override?: string | null
          phone_number_id: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          emoji?: string
          hidden?: boolean
          id?: string
          label_override?: string | null
          phone_number_id?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quo_number_preferences_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: true
            referencedRelation: "quo_phone_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quo_number_preferences_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quo_number_preferences_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      quo_phone_numbers: {
        Row: {
          active: boolean
          brand: string | null
          created_at: string
          display_number: string | null
          id: string
          label: string | null
          location: string | null
          name: string | null
          number: string
          quo_phone_number_id: string
          team: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand?: string | null
          created_at?: string
          display_number?: string | null
          id?: string
          label?: string | null
          location?: string | null
          name?: string | null
          number: string
          quo_phone_number_id: string
          team?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand?: string | null
          created_at?: string
          display_number?: string | null
          id?: string
          label?: string | null
          location?: string | null
          name?: string | null
          number?: string
          quo_phone_number_id?: string
          team?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quo_pinned_conversations: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          pinned_by: string | null
          sort_order: number
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          pinned_by?: string | null
          sort_order?: number
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          pinned_by?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quo_pinned_conversations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "quo_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quo_pinned_conversations_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quo_pinned_conversations_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      quo_sync_logs: {
        Row: {
          created_at: string
          details: Json | null
          id: string
          status: string
          sync_type: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: string
          status: string
          sync_type: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: string
          status?: string
          sync_type?: string
        }
        Relationships: []
      }
      quo_webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string | null
          id: string
          processed_at: string | null
          processing_status: string
          quo_conversation_id: string | null
          quo_event_id: string | null
          quo_message_id: string | null
          quo_phone_number_id: string | null
          raw_payload: Json
          received_at: string
          signature_verified: boolean
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          processed_at?: string | null
          processing_status?: string
          quo_conversation_id?: string | null
          quo_event_id?: string | null
          quo_message_id?: string | null
          quo_phone_number_id?: string | null
          raw_payload: Json
          received_at?: string
          signature_verified?: boolean
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          processed_at?: string | null
          processing_status?: string
          quo_conversation_id?: string | null
          quo_event_id?: string | null
          quo_message_id?: string | null
          quo_phone_number_id?: string | null
          raw_payload?: Json
          received_at?: string
          signature_verified?: boolean
        }
        Relationships: []
      }
      status_permissions: {
        Row: {
          allowed: boolean | null
          id: string
          status: string
          user_id: string
        }
        Insert: {
          allowed?: boolean | null
          id?: string
          status: string
          user_id: string
        }
        Update: {
          allowed?: boolean | null
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      technicians: {
        Row: {
          area: string
          chat_link: string | null
          created_at: string
          created_by: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          phone_number: string | null
          service: string | null
          updated_at: string
        }
        Insert: {
          area: string
          chat_link?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          phone_number?: string | null
          service?: string | null
          updated_at?: string
        }
        Update: {
          area?: string
          chat_link?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          phone_number?: string | null
          service?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_access_codes: {
        Row: {
          code: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_status_change_permissions: {
        Row: {
          allowed_statuses: string[]
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_statuses?: string[]
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_statuses?: string[]
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_public: {
        Row: {
          full_name: string | null
          id: string | null
        }
        Insert: {
          full_name?: string | null
          id?: string | null
        }
        Update: {
          full_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_access_quo_ai: { Args: never; Returns: boolean }
      cron_ai_daily_brief: { Args: never; Returns: undefined }
      cron_ai_process_quo_jobs: { Args: never; Returns: undefined }
      cron_ai_reminder_checker: { Args: never; Returns: undefined }
      cron_ai_sweep_conversations: { Args: never; Returns: undefined }
      cron_quo_reconcile_sync: { Args: never; Returns: undefined }
      cron_quo_sync_contacts: { Args: never; Returns: undefined }
      enqueue_quo_ai_job: {
        Args: {
          _conversation_id: string
          _debounce_seconds?: number
          _job_type?: string
          _latest_message_id?: string
          _priority?: string
        }
        Returns: string
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role_old"]
              _user_id: string
            }
            Returns: boolean
          }
      quo_conversation_counts_by_number: {
        Args: never
        Returns: {
          phone_number_id: string
          total: number
        }[]
      }
      search_technicians: {
        Args: { _limit: number; _offset: number; _q: string }
        Returns: {
          area: string
          chat_link: string
          id: string
          latitude: number
          longitude: number
          name: string
          notes: string
          phone_number: string
          service: string
          total_count: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "processor" | "customer_service" | "opr" | "cs_admin"
      app_role_old:
        | "admin"
        | "processor"
        | "customer_service"
        | "no_role"
        | "opr"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "processor", "customer_service", "opr", "cs_admin"],
      app_role_old: [
        "admin",
        "processor",
        "customer_service",
        "no_role",
        "opr",
      ],
    },
  },
} as const
