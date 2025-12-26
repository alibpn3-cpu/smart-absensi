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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      ad_images: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order: number
          id?: string
          image_url: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      admin_accounts: {
        Row: {
          created_at: string
          id: string
          password_hash: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          password_hash: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          password_hash?: string
          username?: string
        }
        Relationships: []
      }
      admin_activity_logs: {
        Row: {
          action_type: string
          admin_username: string
          created_at: string
          details: Json | null
          id: string
          target_name: string
          target_type: string
        }
        Insert: {
          action_type: string
          admin_username: string
          created_at?: string
          details?: Json | null
          id?: string
          target_name: string
          target_type: string
        }
        Update: {
          action_type?: string
          admin_username?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_name?: string
          target_type?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          attendance_type: string | null
          check_in_time: string | null
          check_out_time: string | null
          checkin_location_address: string | null
          checkin_location_lat: number | null
          checkin_location_lng: number | null
          checkout_location_address: string | null
          checkout_location_lat: number | null
          checkout_location_lng: number | null
          created_at: string
          date: string
          hours_worked: number | null
          id: string
          reason: string | null
          selfie_checkin_url: string | null
          selfie_checkout_url: string | null
          selfie_photo_url: string | null
          staff_name: string
          staff_uid: string
          status: string
          updated_at: string
        }
        Insert: {
          attendance_type?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          checkin_location_address?: string | null
          checkin_location_lat?: number | null
          checkin_location_lng?: number | null
          checkout_location_address?: string | null
          checkout_location_lat?: number | null
          checkout_location_lng?: number | null
          created_at?: string
          date?: string
          hours_worked?: number | null
          id?: string
          reason?: string | null
          selfie_checkin_url?: string | null
          selfie_checkout_url?: string | null
          selfie_photo_url?: string | null
          staff_name: string
          staff_uid: string
          status: string
          updated_at?: string
        }
        Update: {
          attendance_type?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          checkin_location_address?: string | null
          checkin_location_lat?: number | null
          checkin_location_lng?: number | null
          checkout_location_address?: string | null
          checkout_location_lat?: number | null
          checkout_location_lng?: number | null
          created_at?: string
          date?: string
          hours_worked?: number | null
          id?: string
          reason?: string | null
          selfie_checkin_url?: string | null
          selfie_checkout_url?: string | null
          selfie_photo_url?: string | null
          staff_name?: string
          staff_uid?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_staff_uid_fkey"
            columns: ["staff_uid"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["uid"]
          },
        ]
      }
      birthdays: {
        Row: {
          created_at: string
          id: string
          level: string | null
          lokasi: string | null
          nama: string
          tanggal: string
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string | null
          lokasi?: string | null
          nama: string
          tanggal: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: string | null
          lokasi?: string | null
          nama?: string
          tanggal?: string
        }
        Relationships: []
      }
      daily_scores: {
        Row: {
          calculation_method: string | null
          check_in_time: string | null
          check_out_time: string | null
          clock_in_score: number
          clock_out_score: number
          created_at: string
          employee_type: string | null
          final_score: number
          id: string
          is_late: boolean | null
          p2h_score: number
          score_date: string
          staff_name: string
          staff_uid: string
          toolbox_score: number
          updated_at: string
          work_area: string | null
        }
        Insert: {
          calculation_method?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          clock_in_score?: number
          clock_out_score?: number
          created_at?: string
          employee_type?: string | null
          final_score?: number
          id?: string
          is_late?: boolean | null
          p2h_score?: number
          score_date?: string
          staff_name: string
          staff_uid: string
          toolbox_score?: number
          updated_at?: string
          work_area?: string | null
        }
        Update: {
          calculation_method?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          clock_in_score?: number
          clock_out_score?: number
          created_at?: string
          employee_type?: string | null
          final_score?: number
          id?: string
          is_late?: boolean | null
          p2h_score?: number
          score_date?: string
          staff_name?: string
          staff_uid?: string
          toolbox_score?: number
          updated_at?: string
          work_area?: string | null
        }
        Relationships: []
      }
      debug_logs: {
        Row: {
          console_logs: string[] | null
          created_at: string | null
          device_id: string | null
          error_message: string | null
          error_stack: string | null
          id: string
          issue_type: string | null
          location_data: Json | null
          permissions_state: Json | null
          platform: string | null
          screen_height: number | null
          screen_width: number | null
          staff_name: string | null
          staff_uid: string | null
          user_agent: string | null
          user_notes: string | null
          work_areas_data: Json | null
        }
        Insert: {
          console_logs?: string[] | null
          created_at?: string | null
          device_id?: string | null
          error_message?: string | null
          error_stack?: string | null
          id?: string
          issue_type?: string | null
          location_data?: Json | null
          permissions_state?: Json | null
          platform?: string | null
          screen_height?: number | null
          screen_width?: number | null
          staff_name?: string | null
          staff_uid?: string | null
          user_agent?: string | null
          user_notes?: string | null
          work_areas_data?: Json | null
        }
        Update: {
          console_logs?: string[] | null
          created_at?: string | null
          device_id?: string | null
          error_message?: string | null
          error_stack?: string | null
          id?: string
          issue_type?: string | null
          location_data?: Json | null
          permissions_state?: Json | null
          platform?: string | null
          screen_height?: number | null
          screen_width?: number | null
          staff_name?: string | null
          staff_uid?: string | null
          user_agent?: string | null
          user_notes?: string | null
          work_areas_data?: Json | null
        }
        Relationships: []
      }
      geofence_areas: {
        Row: {
          center_lat: number | null
          center_lng: number | null
          coordinates: Json | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          radius: number | null
          updated_at: string
        }
        Insert: {
          center_lat?: number | null
          center_lng?: number | null
          coordinates?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          radius?: number | null
          updated_at?: string
        }
        Update: {
          center_lat?: number | null
          center_lng?: number | null
          coordinates?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          radius?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      monthly_ranking_overrides: {
        Row: {
          created_at: string | null
          display_order: number | null
          display_score: number | null
          id: string
          month: number
          photo_url: string | null
          staff_name: string
          staff_uid: string
          tier: string
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          display_score?: number | null
          id?: string
          month: number
          photo_url?: string | null
          staff_name: string
          staff_uid: string
          tier: string
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          display_score?: number | null
          id?: string
          month?: number
          photo_url?: string | null
          staff_name?: string
          staff_uid?: string
          tier?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      p2h_toolbox_checklist: {
        Row: {
          checklist_date: string
          created_at: string
          id: string
          p2h_checked: boolean | null
          staff_name: string
          staff_uid: string
          toolbox_checked: boolean | null
          updated_at: string
        }
        Insert: {
          checklist_date?: string
          created_at?: string
          id?: string
          p2h_checked?: boolean | null
          staff_name: string
          staff_uid: string
          toolbox_checked?: boolean | null
          updated_at?: string
        }
        Update: {
          checklist_date?: string
          created_at?: string
          id?: string
          p2h_checked?: boolean | null
          staff_name?: string
          staff_uid?: string
          toolbox_checked?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      staff_users: {
        Row: {
          created_at: string
          division: string | null
          employee_type: string | null
          id: string
          is_active: boolean
          is_admin: boolean | null
          is_first_login: boolean | null
          name: string
          password_hash: string | null
          photo_url: string | null
          position: string
          uid: string
          updated_at: string
          work_area: string
        }
        Insert: {
          created_at?: string
          division?: string | null
          employee_type?: string | null
          id?: string
          is_active?: boolean
          is_admin?: boolean | null
          is_first_login?: boolean | null
          name: string
          password_hash?: string | null
          photo_url?: string | null
          position: string
          uid: string
          updated_at?: string
          work_area: string
        }
        Update: {
          created_at?: string
          division?: string | null
          employee_type?: string | null
          id?: string
          is_active?: boolean
          is_admin?: boolean | null
          is_first_login?: boolean | null
          name?: string
          password_hash?: string | null
          photo_url?: string | null
          position?: string
          uid?: string
          updated_at?: string
          work_area?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
