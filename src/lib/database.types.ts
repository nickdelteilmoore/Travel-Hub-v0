export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      countries: {
        Row: {
          code: string
          fcdo_slug: string | null
          flag_emoji: string
          is_schengen: boolean
          name: string
        }
        Insert: {
          code: string
          fcdo_slug?: string | null
          flag_emoji: string
          is_schengen?: boolean
          name: string
        }
        Update: {
          code?: string
          fcdo_slug?: string | null
          flag_emoji?: string
          is_schengen?: boolean
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      travel_airports: {
        Row: {
          city: string | null
          country_code: string | null
          iata: string
          icao: string | null
          latitude: number | null
          longitude: number | null
          name: string
          tz: string
        }
        Insert: {
          city?: string | null
          country_code?: string | null
          iata: string
          icao?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          tz: string
        }
        Update: {
          city?: string | null
          country_code?: string | null
          iata?: string
          icao?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          tz?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_airports_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      travel_alerts: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          pushed_at: string | null
          read_at: string | null
          segment_id: string | null
          severity: string
          title: string
          traveller_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          pushed_at?: string | null
          read_at?: string | null
          segment_id?: string | null
          severity?: string
          title: string
          traveller_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          pushed_at?: string | null
          read_at?: string | null
          segment_id?: string | null
          severity?: string
          title?: string
          traveller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_alerts_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "travel_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_documents: {
        Row: {
          bytes: number | null
          created_at: string
          filename: string
          id: string
          kind: string
          mime_type: string | null
          pinned: boolean
          segment_id: string | null
          source: string
          storage_path: string
          traveller_id: string
          trip_id: string | null
        }
        Insert: {
          bytes?: number | null
          created_at?: string
          filename: string
          id?: string
          kind?: string
          mime_type?: string | null
          pinned?: boolean
          segment_id?: string | null
          source?: string
          storage_path: string
          traveller_id?: string
          trip_id?: string | null
        }
        Update: {
          bytes?: number | null
          created_at?: string
          filename?: string
          id?: string
          kind?: string
          mime_type?: string | null
          pinned?: boolean
          segment_id?: string | null
          source?: string
          storage_path?: string
          traveller_id?: string
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "travel_documents_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "travel_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_documents_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "travel_trips"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_entries: {
        Row: {
          country_code: string
          created_at: string
          entry_date: string
          exit_date: string | null
          id: string
          notes: string | null
          transit: boolean
          traveler_id: string
        }
        Insert: {
          country_code: string
          created_at?: string
          entry_date: string
          exit_date?: string | null
          id?: string
          notes?: string | null
          transit?: boolean
          traveler_id: string
        }
        Update: {
          country_code?: string
          created_at?: string
          entry_date?: string
          exit_date?: string | null
          id?: string
          notes?: string | null
          transit?: boolean
          traveler_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_entries_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "travel_entries_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_flight_status: {
        Row: {
          arrive_actual: string | null
          arrive_belt: string | null
          arrive_delay_min: number | null
          arrive_estimated: string | null
          arrive_gate: string | null
          arrive_terminal: string | null
          checked_at: string
          depart_actual: string | null
          depart_delay_min: number | null
          depart_estimated: string | null
          depart_gate: string | null
          depart_terminal: string | null
          flight_status: string | null
          raw: Json | null
          segment_id: string
        }
        Insert: {
          arrive_actual?: string | null
          arrive_belt?: string | null
          arrive_delay_min?: number | null
          arrive_estimated?: string | null
          arrive_gate?: string | null
          arrive_terminal?: string | null
          checked_at?: string
          depart_actual?: string | null
          depart_delay_min?: number | null
          depart_estimated?: string | null
          depart_gate?: string | null
          depart_terminal?: string | null
          flight_status?: string | null
          raw?: Json | null
          segment_id: string
        }
        Update: {
          arrive_actual?: string | null
          arrive_belt?: string | null
          arrive_delay_min?: number | null
          arrive_estimated?: string | null
          arrive_gate?: string | null
          arrive_terminal?: string | null
          checked_at?: string
          depart_actual?: string | null
          depart_delay_min?: number | null
          depart_estimated?: string | null
          depart_gate?: string | null
          depart_terminal?: string | null
          flight_status?: string | null
          raw?: Json | null
          segment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_flight_status_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: true
            referencedRelation: "travel_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_flight_watches: {
        Row: {
          active: boolean
          checks_used: number
          created_at: string
          flight_iata: string
          last_error: string | null
          next_check_at: string | null
          paused: boolean
          scheduled_date: string
          segment_id: string
          traveller_id: string
        }
        Insert: {
          active?: boolean
          checks_used?: number
          created_at?: string
          flight_iata: string
          last_error?: string | null
          next_check_at?: string | null
          paused?: boolean
          scheduled_date: string
          segment_id: string
          traveller_id: string
        }
        Update: {
          active?: boolean
          checks_used?: number
          created_at?: string
          flight_iata?: string
          last_error?: string | null
          next_check_at?: string | null
          paused?: boolean
          scheduled_date?: string
          segment_id?: string
          traveller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_flight_watches_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: true
            referencedRelation: "travel_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_preferences: {
        Row: {
          created_at: string
          home_country_code: string
          traveller_id: string
        }
        Insert: {
          created_at?: string
          home_country_code?: string
          traveller_id?: string
        }
        Update: {
          created_at?: string
          home_country_code?: string
          traveller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_preferences_home_country_code_fkey"
            columns: ["home_country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      travel_segment_types: {
        Row: {
          code: string
          is_extractable: boolean
          is_lodging: boolean
          is_transport: boolean
          label: string
          leaf: string
          position: number
        }
        Insert: {
          code: string
          is_extractable?: boolean
          is_lodging?: boolean
          is_transport?: boolean
          label: string
          leaf?: string
          position?: number
        }
        Update: {
          code?: string
          is_extractable?: boolean
          is_lodging?: boolean
          is_transport?: boolean
          label?: string
          leaf?: string
          position?: number
        }
        Relationships: []
      }
      travel_segments: {
        Row: {
          address: string | null
          arrive_at: string | null
          arrive_country_code: string | null
          arrive_iata: string | null
          arrive_place: string | null
          arrive_tz: string | null
          booking_ref: string | null
          cabin: string | null
          carrier: string | null
          co2_kg: number | null
          confidence: number | null
          created_at: string
          depart_at: string | null
          depart_country_code: string | null
          depart_iata: string | null
          depart_place: string | null
          depart_tz: string | null
          distance_km: number | null
          id: string
          needs_review: boolean
          notes: string | null
          number: string | null
          phone: string | null
          raw: Json | null
          seat: string | null
          segment_type: string
          source: string
          source_ref: string | null
          status: string
          title: string | null
          traveller_id: string
          trip_id: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          address?: string | null
          arrive_at?: string | null
          arrive_country_code?: string | null
          arrive_iata?: string | null
          arrive_place?: string | null
          arrive_tz?: string | null
          booking_ref?: string | null
          cabin?: string | null
          carrier?: string | null
          co2_kg?: number | null
          confidence?: number | null
          created_at?: string
          depart_at?: string | null
          depart_country_code?: string | null
          depart_iata?: string | null
          depart_place?: string | null
          depart_tz?: string | null
          distance_km?: number | null
          id?: string
          needs_review?: boolean
          notes?: string | null
          number?: string | null
          phone?: string | null
          raw?: Json | null
          seat?: string | null
          segment_type: string
          source?: string
          source_ref?: string | null
          status?: string
          title?: string | null
          traveller_id?: string
          trip_id?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          address?: string | null
          arrive_at?: string | null
          arrive_country_code?: string | null
          arrive_iata?: string | null
          arrive_place?: string | null
          arrive_tz?: string | null
          booking_ref?: string | null
          cabin?: string | null
          carrier?: string | null
          co2_kg?: number | null
          confidence?: number | null
          created_at?: string
          depart_at?: string | null
          depart_country_code?: string | null
          depart_iata?: string | null
          depart_place?: string | null
          depart_tz?: string | null
          distance_km?: number | null
          id?: string
          needs_review?: boolean
          notes?: string | null
          number?: string | null
          phone?: string | null
          raw?: Json | null
          seat?: string | null
          segment_type?: string
          source?: string
          source_ref?: string | null
          status?: string
          title?: string | null
          traveller_id?: string
          trip_id?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "travel_segments_arrive_country_code_fkey"
            columns: ["arrive_country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "travel_segments_arrive_iata_fkey"
            columns: ["arrive_iata"]
            isOneToOne: false
            referencedRelation: "travel_airports"
            referencedColumns: ["iata"]
          },
          {
            foreignKeyName: "travel_segments_depart_country_code_fkey"
            columns: ["depart_country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "travel_segments_depart_iata_fkey"
            columns: ["depart_iata"]
            isOneToOne: false
            referencedRelation: "travel_airports"
            referencedColumns: ["iata"]
          },
          {
            foreignKeyName: "travel_segments_segment_type_fkey"
            columns: ["segment_type"]
            isOneToOne: false
            referencedRelation: "travel_segment_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "travel_segments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "travel_trips"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_trips: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          notes: string | null
          primary_country_code: string | null
          purpose: string
          source: string
          start_date: string | null
          title: string
          traveller_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          primary_country_code?: string | null
          purpose?: string
          source?: string
          start_date?: string | null
          title: string
          traveller_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          primary_country_code?: string | null
          purpose?: string
          source?: string
          start_date?: string | null
          title?: string
          traveller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_trips_primary_country_code_fkey"
            columns: ["primary_country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      trip_expenses: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          id: string
          photo_path: string | null
          reason: string | null
          spent_on: string | null
          traveller_id: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          photo_path?: string | null
          reason?: string | null
          spent_on?: string | null
          traveller_id?: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          photo_path?: string | null
          reason?: string | null
          spent_on?: string | null
          traveller_id?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "travel_trips"
            referencedColumns: ["id"]
          },
        ]
      }
      visited_countries: {
        Row: {
          country_code: string
          created_at: string
          traveler_id: string
        }
        Insert: {
          country_code: string
          created_at?: string
          traveler_id: string
        }
        Update: {
          country_code?: string
          created_at?: string
          traveler_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visited_countries_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "visited_countries_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_household_member: { Args: never; Returns: boolean }
      reconcile_travel_entries: { Args: { p_trip_id: string }; Returns: number }
      travel_merge_trips: {
        Args: { p_from: string; p_into: string }
        Returns: undefined
      }
      travel_segment_countries: {
        Args: { seg: Database["public"]["Tables"]["travel_segments"]["Row"] }
        Returns: {
          country_code: string
          from_date: string
          to_date: string
        }[]
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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

