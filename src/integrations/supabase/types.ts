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
        Relationships: []
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
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          lead_id: string
          note_type: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          lead_id?: string
          note_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_payments: {
        Row: {
          amount: number | null
          created_at: string | null
          created_by: string | null
          id: string
          lead_id: string
          screenshot_url: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_id: string
          screenshot_url?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_id?: string
          screenshot_url?: string | null
        }
        Relationships: [
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
        }
        Insert: {
          created_at?: string | null
          id?: string
          lead_id: string
          photo_url: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lead_id?: string
          photo_url?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_photos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
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
        ]
      }
      lead_updates: {
        Row: {
          author_id: string
          author_name: string
          author_role: string
          content: string
          created_at: string | null
          id: string
          lead_id: string
        }
        Insert: {
          author_id: string
          author_name: string
          author_role: string
          content: string
          created_at?: string | null
          id?: string
          lead_id: string
        }
        Update: {
          author_id?: string
          author_name?: string
          author_role?: string
          content?: string
          created_at?: string | null
          id?: string
          lead_id?: string
        }
        Relationships: [
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
          city: string | null
          created_at: string | null
          created_by: string
          cs_notes: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string
          customer_schedule_requirements: string | null
          direction: string | null
          for_us_amount: number | null
          for_you_amount: number | null
          general_notes: string | null
          id: string
          job_id: string
          labor_amount: number | null
          last_edited_at: string | null
          last_edited_by: string | null
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
          city?: string | null
          created_at?: string | null
          created_by: string
          cs_notes?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          customer_schedule_requirements?: string | null
          direction?: string | null
          for_us_amount?: number | null
          for_you_amount?: number | null
          general_notes?: string | null
          id?: string
          job_id: string
          labor_amount?: number | null
          last_edited_at?: string | null
          last_edited_by?: string | null
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
          city?: string | null
          created_at?: string | null
          created_by?: string
          cs_notes?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          customer_schedule_requirements?: string | null
          direction?: string | null
          for_us_amount?: number | null
          for_you_amount?: number | null
          general_notes?: string | null
          id?: string
          job_id?: string
          labor_amount?: number | null
          last_edited_at?: string | null
          last_edited_by?: string | null
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
          state?: string | null
          status?: string
          tech_name?: string | null
          tech_number?: string | null
          terms?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "processor" | "customer_service" | "no_role"
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
      app_role: ["admin", "processor", "customer_service", "no_role"],
    },
  },
} as const
