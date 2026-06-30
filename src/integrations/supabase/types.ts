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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_email_recipients: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          label: string | null
          notify_fully_paid: boolean
          notify_new_booking: boolean
          notify_payment_proof: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          label?: string | null
          notify_fully_paid?: boolean
          notify_new_booking?: boolean
          notify_payment_proof?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          label?: string | null
          notify_fully_paid?: boolean
          notify_new_booking?: boolean
          notify_payment_proof?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      booking_requests: {
        Row: {
          balance_amount: number | null
          balance_due_at: string | null
          balance_paid_at: string | null
          balance_proof_path: string | null
          balance_reminder_sent_at: string | null
          booking_group_id: string
          cabin_id: string | null
          check_in: string
          check_out: string
          comforter: boolean
          comforter_total: number
          confirmation_email_sent_at: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          deposit_amount: number
          email: string
          guest_name: string
          guest_token: string
          guests: number
          hold_expires_at: string | null
          id: string
          locker_code: string | null
          nights: number | null
          notes: string | null
          num_rooms: number | null
          payment_proof_path: string | null
          payment_reference: string | null
          payment_type: string
          phone: string
          relationship: string | null
          room_type: string
          status: Database["public"]["Enums"]["booking_status"]
          subtotal: number | null
          total_amount: number | null
          vehicle_number: string | null
          vehicle_type: string | null
        }
        Insert: {
          balance_amount?: number | null
          balance_due_at?: string | null
          balance_paid_at?: string | null
          balance_proof_path?: string | null
          balance_reminder_sent_at?: string | null
          booking_group_id?: string
          cabin_id?: string | null
          check_in: string
          check_out: string
          comforter?: boolean
          comforter_total?: number
          confirmation_email_sent_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          deposit_amount?: number
          email: string
          guest_name: string
          guest_token?: string
          guests: number
          hold_expires_at?: string | null
          id?: string
          locker_code?: string | null
          nights?: number | null
          notes?: string | null
          num_rooms?: number | null
          payment_proof_path?: string | null
          payment_reference?: string | null
          payment_type?: string
          phone: string
          relationship?: string | null
          room_type: string
          status?: Database["public"]["Enums"]["booking_status"]
          subtotal?: number | null
          total_amount?: number | null
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Update: {
          balance_amount?: number | null
          balance_due_at?: string | null
          balance_paid_at?: string | null
          balance_proof_path?: string | null
          balance_reminder_sent_at?: string | null
          booking_group_id?: string
          cabin_id?: string | null
          check_in?: string
          check_out?: string
          comforter?: boolean
          comforter_total?: number
          confirmation_email_sent_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          deposit_amount?: number
          email?: string
          guest_name?: string
          guest_token?: string
          guests?: number
          hold_expires_at?: string | null
          id?: string
          locker_code?: string | null
          nights?: number | null
          notes?: string | null
          num_rooms?: number | null
          payment_proof_path?: string | null
          payment_reference?: string | null
          payment_type?: string
          phone?: string
          relationship?: string | null
          room_type?: string
          status?: Database["public"]["Enums"]["booking_status"]
          subtotal?: number | null
          total_amount?: number | null
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_cabin_id_fkey"
            columns: ["cabin_id"]
            isOneToOne: false
            referencedRelation: "cabins"
            referencedColumns: ["id"]
          },
        ]
      }
      cabins: {
        Row: {
          cabin_type: string
          capacity: number
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          school_holiday_rate: number
          slug: string
          weekday_rate: number
          weekend_rate: number
        }
        Insert: {
          cabin_type: string
          capacity: number
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          school_holiday_rate: number
          slug: string
          weekday_rate: number
          weekend_rate: number
        }
        Update: {
          cabin_type?: string
          capacity?: number
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          school_holiday_rate?: number
          slug?: string
          weekday_rate?: number
          weekend_rate?: number
        }
        Relationships: []
      }
      email_outbox: {
        Row: {
          body: string
          booking_id: string | null
          cc_emails: string[]
          created_at: string
          error: string | null
          id: string
          kind: string
          sent_at: string | null
          status: string
          subject: string
          to_email: string
        }
        Insert: {
          body: string
          booking_id?: string | null
          cc_emails?: string[]
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          sent_at?: string | null
          status?: string
          subject: string
          to_email: string
        }
        Update: {
          body?: string
          booking_id?: string | null
          cc_emails?: string[]
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          sent_at?: string | null
          status?: string
          subject?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      manage_link_requests: {
        Row: {
          id: string
          ip: string
          requested_at: string
        }
        Insert: {
          id?: string
          ip: string
          requested_at?: string
        }
        Update: {
          id?: string
          ip?: string
          requested_at?: string
        }
        Relationships: []
      }
      school_holidays: {
        Row: {
          created_at: string
          ends_on: string
          id: string
          label: string
          starts_on: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          id?: string
          label: string
          starts_on: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          label?: string
          starts_on?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      booking_accepts_proof: { Args: { _booking_id: string }; Returns: boolean }
      cabin_taken_dates: {
        Args: { _cabin_id: string; _from: string; _to: string }
        Returns: {
          d: string
        }[]
      }
      compute_booking_price: {
        Args: {
          _cabin_id: string
          _check_in: string
          _check_out: string
          _comforter: boolean
        }
        Returns: {
          comforter_total: number
          nights: number
          subtotal: number
          total: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "owner" | "user"
      booking_status:
        | "pending_payment"
        | "awaiting_review"
        | "confirmed"
        | "cancelled"
        | "expired"
        | "fully_paid"
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
      app_role: ["admin", "owner", "user"],
      booking_status: [
        "pending_payment",
        "awaiting_review",
        "confirmed",
        "cancelled",
        "expired",
        "fully_paid",
      ],
    },
  },
} as const
