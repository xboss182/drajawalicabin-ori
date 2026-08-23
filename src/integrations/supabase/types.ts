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
          actual_check_out_at: string | null
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
          deposit_refund_note: string | null
          deposit_refunded_amount: number | null
          deposit_refunded_at: string | null
          discount_amount: number
          discount_code: string | null
          discount_id: string | null
          email: string
          guest_name: string
          guest_token: string
          guests: number
          hold_expires_at: string | null
          id: string
          late_checkout_fee: number
          late_checkout_hours: number
          locker_code: string | null
          nights: number | null
          notes: string | null
          num_rooms: number | null
          payment_method: string
          payment_proof_path: string | null
          payment_reference: string | null
          payment_type: string
          phone: string
          relationship: string | null
          room_type: string
          source: string
          status: Database["public"]["Enums"]["booking_status"]
          stripe_balance_payment_intent_id: string | null
          stripe_balance_session_id: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal: number | null
          total_amount: number | null
          vehicle_number: string | null
          vehicle_type: string | null
          wa_chat_id: string | null
        }
        Insert: {
          actual_check_out_at?: string | null
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
          deposit_refund_note?: string | null
          deposit_refunded_amount?: number | null
          deposit_refunded_at?: string | null
          discount_amount?: number
          discount_code?: string | null
          discount_id?: string | null
          email: string
          guest_name: string
          guest_token?: string
          guests: number
          hold_expires_at?: string | null
          id?: string
          late_checkout_fee?: number
          late_checkout_hours?: number
          locker_code?: string | null
          nights?: number | null
          notes?: string | null
          num_rooms?: number | null
          payment_method?: string
          payment_proof_path?: string | null
          payment_reference?: string | null
          payment_type?: string
          phone: string
          relationship?: string | null
          room_type: string
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_balance_payment_intent_id?: string | null
          stripe_balance_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number | null
          total_amount?: number | null
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Update: {
          actual_check_out_at?: string | null
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
          deposit_refund_note?: string | null
          deposit_refunded_amount?: number | null
          deposit_refunded_at?: string | null
          discount_amount?: number
          discount_code?: string | null
          discount_id?: string | null
          email?: string
          guest_name?: string
          guest_token?: string
          guests?: number
          hold_expires_at?: string | null
          id?: string
          late_checkout_fee?: number
          late_checkout_hours?: number
          locker_code?: string | null
          nights?: number | null
          notes?: string | null
          num_rooms?: number | null
          payment_method?: string
          payment_proof_path?: string | null
          payment_reference?: string | null
          payment_type?: string
          phone?: string
          relationship?: string | null
          room_type?: string
          source?: string
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_balance_payment_intent_id?: string | null
          stripe_balance_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number | null
          total_amount?: number | null
          vehicle_number?: string | null
          vehicle_type?: string | null
          wa_chat_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_cabin_id_fkey"
            columns: ["cabin_id"]
            isOneToOne: false
            referencedRelation: "cabins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
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
          legacy_school_holiday_rate: number | null
          legacy_weekday_rate: number | null
          legacy_weekend_rate: number | null
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
          legacy_school_holiday_rate?: number | null
          legacy_weekday_rate?: number | null
          legacy_weekend_rate?: number | null
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
          legacy_school_holiday_rate?: number | null
          legacy_weekday_rate?: number | null
          legacy_weekend_rate?: number | null
          name?: string
          school_holiday_rate?: number
          slug?: string
          weekday_rate?: number
          weekend_rate?: number
        }
        Relationships: []
      }
      crm_broadcasts: {
        Row: {
          audience: Json
          body_html: string
          id: string
          recipient_count: number
          sent_at: string
          sent_by: string | null
          subject: string
        }
        Insert: {
          audience?: Json
          body_html: string
          id?: string
          recipient_count?: number
          sent_at?: string
          sent_by?: string | null
          subject: string
        }
        Update: {
          audience?: Json
          body_html?: string
          id?: string
          recipient_count?: number
          sent_at?: string
          sent_by?: string | null
          subject?: string
        }
        Relationships: []
      }
      crm_guests: {
        Row: {
          created_at: string
          email: string
          first_seen_at: string
          full_name: string | null
          id: string
          last_stay_at: string | null
          marketing_opt_in: boolean
          notes: string | null
          phone: string | null
          tags: string[]
          total_bookings: number
          total_nights: number
          total_spent: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_seen_at?: string
          full_name?: string | null
          id?: string
          last_stay_at?: string | null
          marketing_opt_in?: boolean
          notes?: string | null
          phone?: string | null
          tags?: string[]
          total_bookings?: number
          total_nights?: number
          total_spent?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_seen_at?: string
          full_name?: string | null
          id?: string
          last_stay_at?: string | null
          marketing_opt_in?: boolean
          notes?: string | null
          phone?: string | null
          tags?: string[]
          total_bookings?: number
          total_nights?: number
          total_spent?: number
          updated_at?: string
        }
        Relationships: []
      }
      crm_tasks: {
        Row: {
          created_at: string
          created_by: string | null
          done: boolean
          due_at: string | null
          guest_id: string
          id: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          done?: boolean
          due_at?: string | null
          guest_id: string
          id?: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          done?: boolean
          due_at?: string | null
          guest_id?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "crm_guests"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_redemptions: {
        Row: {
          amount_off: number
          booking_group_id: string
          created_at: string
          discount_id: string
          email: string | null
          id: string
        }
        Insert: {
          amount_off?: number
          booking_group_id: string
          created_at?: string
          discount_id: string
          email?: string | null
          id?: string
        }
        Update: {
          amount_off?: number
          booking_group_id?: string
          created_at?: string
          discount_id?: string
          email?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_redemptions_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
        ]
      }
      discounts: {
        Row: {
          active: boolean
          applies_to: Database["public"]["Enums"]["discount_scope"]
          cabin_types: string[]
          code: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          max_uses: number | null
          max_uses_per_email: number | null
          min_nights: number
          min_rooms: number
          min_subtotal: number
          name: string
          nth_night_percent: number | null
          stackable: boolean
          starts_at: string | null
          stay_from: string | null
          stay_to: string | null
          type: Database["public"]["Enums"]["discount_type"]
          updated_at: string
          value: number
        }
        Insert: {
          active?: boolean
          applies_to?: Database["public"]["Enums"]["discount_scope"]
          cabin_types?: string[]
          code?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          max_uses?: number | null
          max_uses_per_email?: number | null
          min_nights?: number
          min_rooms?: number
          min_subtotal?: number
          name: string
          nth_night_percent?: number | null
          stackable?: boolean
          starts_at?: string | null
          stay_from?: string | null
          stay_to?: string | null
          type: Database["public"]["Enums"]["discount_type"]
          updated_at?: string
          value?: number
        }
        Update: {
          active?: boolean
          applies_to?: Database["public"]["Enums"]["discount_scope"]
          cabin_types?: string[]
          code?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          max_uses?: number | null
          max_uses_per_email?: number | null
          min_nights?: number
          min_rooms?: number
          min_subtotal?: number
          name?: string
          nth_night_percent?: number | null
          stackable?: boolean
          starts_at?: string | null
          stay_from?: string | null
          stay_to?: string | null
          type?: Database["public"]["Enums"]["discount_type"]
          updated_at?: string
          value?: number
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
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
          kind: string
          label: string
          starts_on: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          id?: string
          kind?: string
          label: string
          starts_on: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          kind?: string
          label?: string
          starts_on?: string
        }
        Relationships: []
      }
      store_items: {
        Row: {
          created_at: string
          description_bm: string | null
          description_en: string | null
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          name_bm: string
          name_en: string
          price: number
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_bm?: string | null
          description_en?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name_bm: string
          name_en: string
          price?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_bm?: string | null
          description_en?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name_bm?: string
          name_en?: string
          price?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      wa_admin_audit: {
        Row: {
          action: string
          actor_id: string | null
          booking_group_id: string | null
          chat_id: string | null
          created_at: string
          detail: Json
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          booking_group_id?: string | null
          chat_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          booking_group_id?: string | null
          chat_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_admin_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_conversations: {
        Row: {
          booking_group_id: string | null
          chat_id: string
          created_at: string
          data: Json
          failure_count: number
          lang: string
          state: string
          updated_at: string
          version: number
        }
        Insert: {
          booking_group_id?: string | null
          chat_id: string
          created_at?: string
          data?: Json
          failure_count?: number
          lang?: string
          state?: string
          updated_at?: string
          version?: number
        }
        Update: {
          booking_group_id?: string | null
          chat_id?: string
          created_at?: string
          data?: Json
          failure_count?: number
          lang?: string
          state?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      wa_events: {
        Row: {
          chat_id: string
          event_id: string
          payload: Json
          processed_at: string | null
          received_at: string
          type: string
        }
        Insert: {
          chat_id: string
          event_id: string
          payload?: Json
          processed_at?: string | null
          received_at?: string
          type: string
        }
        Update: {
          chat_id?: string
          event_id?: string
          payload?: Json
          processed_at?: string | null
          received_at?: string
          type?: string
        }
        Relationships: []
      }
      wa_nonces: {
        Row: {
          expires_at: string
          key_id: string
          nonce: string
        }
        Insert: {
          expires_at: string
          key_id: string
          nonce: string
        }
        Update: {
          expires_at?: string
          key_id?: string
          nonce?: string
        }
        Relationships: []
      }
      wa_outbox: {
        Row: {
          attempts: number
          chat_id: string
          created_at: string
          dedupe_key: string
          id: string
          kind: string
          last_error: string | null
          payload: Json
          status: string
          updated_at: string
          wa_message_id: string | null
        }
        Insert: {
          attempts?: number
          chat_id: string
          created_at?: string
          dedupe_key: string
          id?: string
          kind: string
          last_error?: string | null
          payload?: Json
          status?: string
          updated_at?: string
          wa_message_id?: string | null
        }
        Update: {
          attempts?: number
          chat_id?: string
          created_at?: string
          dedupe_key?: string
          id?: string
          kind?: string
          last_error?: string | null
          payload?: Json
          status?: string
          updated_at?: string
          wa_message_id?: string | null
        }
        Relationships: []
      }
      wa_proofs: {
        Row: {
          booking_group_id: string
          bytes: number | null
          chat_id: string
          created_at: string
          file_path: string | null
          id: string
          kind: string
          mime: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          wa_message_id: string
        }
        Insert: {
          booking_group_id: string
          bytes?: number | null
          chat_id: string
          created_at?: string
          file_path?: string | null
          id?: string
          kind?: string
          mime?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          wa_message_id: string
        }
        Update: {
          booking_group_id?: string
          bytes?: number | null
          chat_id?: string
          created_at?: string
          file_path?: string | null
          id?: string
          kind?: string
          mime?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          wa_message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_proofs_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_runtime_status: {
        Row: {
          id: boolean
          last_error: string | null
          observed_at: string
          session: string | null
          state: string
        }
        Insert: {
          id?: boolean
          last_error?: string | null
          observed_at?: string
          session?: string | null
          state: string
        }
        Update: {
          id?: boolean
          last_error?: string | null
          observed_at?: string
          session?: string | null
          state?: string
        }
        Relationships: []
      }
      wa_settings: {
        Row: {
          hold_minutes: number
          id: boolean
          payment_text_bm: string
          payment_text_en: string
          qr_storage_path: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          hold_minutes?: number
          id?: boolean
          payment_text_bm?: string
          payment_text_en?: string
          qr_storage_path?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          hold_minutes?: number
          id?: boolean
          payment_text_bm?: string
          payment_text_en?: string
          qr_storage_path?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_email: { Args: { _uid: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      wa_claim_hold: {
        Args: {
          _cabin_id: string
          _check_in: string
          _check_out: string
          _comforter: boolean
          _guests: number
          _guest_name: string
          _phone: string
          _chat_id: string
          _subtotal: number
          _comforter_total: number
          _discount_id?: string
          _discount_code?: string
          _discount_amount?: number
        }
        Returns: {
          booking_id: string
          booking_group_id: string
          guest_token: string
          payment_reference: string
          nights: number
          subtotal: number
          comforter_total: number
          total_amount: number
          deposit_amount: number
          balance_amount: number
          hold_expires_at: string
          created_at: string
        }[]
      }
      wa_expire_stale_holds: {
        Args: Record<string, never>
        Returns: {
          chat_id: string
          booking_group_id: string
        }[]
      }
      wa_outbox_claim: {
        Args: { _batch?: number }
        Returns: {
          id: string
          chat_id: string
          kind: string
          payload: Json
          attempts: number
        }[]
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
      discount_scope: "any" | "weekday" | "weekend" | "holiday"
      discount_type: "percent" | "fixed" | "nth_night" | "nth_night_onwards"
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
      discount_scope: ["any", "weekday", "weekend", "holiday"],
      discount_type: ["percent", "fixed", "nth_night", "nth_night_onwards"],
    },
  },
} as const
