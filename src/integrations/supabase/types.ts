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
      buses: {
        Row: {
          bus_no: string
          capacity: number | null
          created_at: string
          driver_name: string | null
          driver_phone: string | null
          id: string
          notes: string | null
          reg_no: string | null
          updated_at: string
        }
        Insert: {
          bus_no: string
          capacity?: number | null
          created_at?: string
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          notes?: string | null
          reg_no?: string | null
          updated_at?: string
        }
        Update: {
          bus_no?: string
          capacity?: number | null
          created_at?: string
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          notes?: string | null
          reg_no?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fuel_logs: {
        Row: {
          bus_id: string
          created_at: string
          filled_on: string
          id: string
          litres: number
          mileage_kmpl: number | null
          odometer: number
          rate_per_litre: number
          remarks: string | null
          station: string | null
          total_cost: number
          updated_at: string
        }
        Insert: {
          bus_id: string
          created_at?: string
          filled_on?: string
          id?: string
          litres: number
          mileage_kmpl?: number | null
          odometer: number
          rate_per_litre?: number
          remarks?: string | null
          station?: string | null
          total_cost?: number
          updated_at?: string
        }
        Update: {
          bus_id?: string
          created_at?: string
          filled_on?: string
          id?: string
          litres?: number
          mileage_kmpl?: number | null
          odometer?: number
          rate_per_litre?: number
          remarks?: string | null
          station?: string | null
          total_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_logs_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          mode: string
          paid_on: string
          receipt_no: string
          recorded_by: string | null
          reference: string | null
          remarks: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          mode?: string
          paid_on?: string
          receipt_no?: string
          recorded_by?: string | null
          reference?: string | null
          remarks?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          mode?: string
          paid_on?: string
          receipt_no?: string
          recorded_by?: string | null
          reference?: string | null
          remarks?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      routes: {
        Row: {
          bus_id: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          bus_id?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          bus_id?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
        ]
      }
      service_logs: {
        Row: {
          bus_id: string
          cost: number
          created_at: string
          id: string
          next_due_on: string | null
          remarks: string | null
          service_on: string
          service_type: string
          updated_at: string
          workshop: string | null
        }
        Insert: {
          bus_id: string
          cost?: number
          created_at?: string
          id?: string
          next_due_on?: string | null
          remarks?: string | null
          service_on?: string
          service_type: string
          updated_at?: string
          workshop?: string | null
        }
        Update: {
          bus_id?: string
          cost?: number
          created_at?: string
          id?: string
          next_due_on?: string | null
          remarks?: string | null
          service_on?: string
          service_type?: string
          updated_at?: string
          workshop?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_logs_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
        ]
      }
      stops: {
        Row: {
          created_at: string
          fare: number
          id: string
          name: string
          route_id: string
          stop_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          fare?: number
          id?: string
          name: string
          route_id: string
          stop_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          fare?: number
          id?: string
          name?: string
          route_id?: string
          stop_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          academic_year: string
          created_at: string
          department: string | null
          id: string
          name: string
          parent_phone: string | null
          phone: string | null
          photo_url: string | null
          roll_no: string
          stop_id: string | null
          total_fee: number
          updated_at: string
          year: string | null
        }
        Insert: {
          academic_year: string
          created_at?: string
          department?: string | null
          id?: string
          name: string
          parent_phone?: string | null
          phone?: string | null
          photo_url?: string | null
          roll_no: string
          stop_id?: string | null
          total_fee?: number
          updated_at?: string
          year?: string | null
        }
        Update: {
          academic_year?: string
          created_at?: string
          department?: string | null
          id?: string
          name?: string
          parent_phone?: string | null
          phone?: string | null
          photo_url?: string | null
          roll_no?: string
          stop_id?: string | null
          total_fee?: number
          updated_at?: string
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_requests: {
        Row: {
          bus_stop_name: string
          created_at: string
          department: string
          father_mobile: string
          father_name: string
          id: string
          mobile: string
          name: string
          register_no: string
          remarks: string | null
          status: string
          updated_at: string
          year: string
        }
        Insert: {
          bus_stop_name: string
          created_at?: string
          department: string
          father_mobile: string
          father_name: string
          id?: string
          mobile: string
          name: string
          register_no: string
          remarks?: string | null
          status?: string
          updated_at?: string
          year: string
        }
        Update: {
          bus_stop_name?: string
          created_at?: string
          department?: string
          father_mobile?: string
          father_name?: string
          id?: string
          mobile?: string
          name?: string
          register_no?: string
          remarks?: string | null
          status?: string
          updated_at?: string
          year?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff"
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
      app_role: ["admin", "staff"],
    },
  },
} as const
