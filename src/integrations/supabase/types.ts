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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string
          hidden_at: string | null
          id: string
          role: string
          tool_calls: Json | null
          tool_results: Json | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          hidden_at?: string | null
          id?: string
          role: string
          tool_calls?: Json | null
          tool_results?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          hidden_at?: string | null
          id?: string
          role?: string
          tool_calls?: Json | null
          tool_results?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      ai_conversation_summaries: {
        Row: {
          id: string
          last_summarized_at: string
          message_count: number
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          last_summarized_at?: string
          message_count?: number
          summary: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          last_summarized_at?: string
          message_count?: number
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_learned_patterns: {
        Row: {
          created_at: string
          example_request: string | null
          example_response: string | null
          failure_count: number
          id: string
          last_used_at: string
          pattern_hash: string
          request_pattern: string
          success_count: number
          tool_sequence: string[]
        }
        Insert: {
          created_at?: string
          example_request?: string | null
          example_response?: string | null
          failure_count?: number
          id?: string
          last_used_at?: string
          pattern_hash: string
          request_pattern: string
          success_count?: number
          tool_sequence: string[]
        }
        Update: {
          created_at?: string
          example_request?: string | null
          example_response?: string | null
          failure_count?: number
          id?: string
          last_used_at?: string
          pattern_hash?: string
          request_pattern?: string
          success_count?: number
          tool_sequence?: string[]
        }
        Relationships: []
      }
      ai_learning_feedback: {
        Row: {
          ai_response: string
          conversation_id: string | null
          created_at: string
          execution_time_ms: number | null
          feedback_notes: string | null
          id: string
          multi_task_count: number | null
          pattern_hash: string | null
          request_type: string | null
          tool_calls: Json | null
          tool_sequence: string[] | null
          user_message: string
          user_rating: number | null
          was_successful: boolean | null
        }
        Insert: {
          ai_response: string
          conversation_id?: string | null
          created_at?: string
          execution_time_ms?: number | null
          feedback_notes?: string | null
          id?: string
          multi_task_count?: number | null
          pattern_hash?: string | null
          request_type?: string | null
          tool_calls?: Json | null
          tool_sequence?: string[] | null
          user_message: string
          user_rating?: number | null
          was_successful?: boolean | null
        }
        Update: {
          ai_response?: string
          conversation_id?: string | null
          created_at?: string
          execution_time_ms?: number | null
          feedback_notes?: string | null
          id?: string
          multi_task_count?: number | null
          pattern_hash?: string | null
          request_type?: string | null
          tool_calls?: Json | null
          tool_sequence?: string[] | null
          user_message?: string
          user_rating?: number | null
          was_successful?: boolean | null
        }
        Relationships: []
      }
      ai_pending_suggestions: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          parsed_pattern: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_level: string | null
          safety_analysis: Json | null
          status: string | null
          suggestion_text: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          parsed_pattern?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string | null
          safety_analysis?: Json | null
          status?: string | null
          suggestion_text: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          parsed_pattern?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string | null
          safety_analysis?: Json | null
          status?: string | null
          suggestion_text?: string
          user_id?: string
        }
        Relationships: []
      }
      friend_messages: {
        Row: {
          content: string | null
          created_at: string
          file_name: string | null
          file_type: string | null
          file_url: string | null
          from_user_id: string
          id: string
          to_user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          from_user_id: string
          id?: string
          to_user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          from_user_id?: string
          id?: string
          to_user_id?: string
        }
        Relationships: []
      }
      friend_requests: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          status: string
          to_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          status?: string
          to_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          status?: string
          to_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      friends: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      hackathon_participations: {
        Row: {
          created_at: string
          hackathon_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hackathon_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hackathon_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      hackathons: {
        Row: {
          created_at: string
          description: string | null
          end_date: string
          id: string
          is_global: boolean
          location: string
          name: string
          organizer: string | null
          region: string
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string
          start_date: string
          status: string
          submitted_by: string | null
          tags: string[] | null
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          is_global?: boolean
          location?: string
          name: string
          organizer?: string | null
          region?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug: string
          start_date: string
          status?: string
          submitted_by?: string | null
          tags?: string[] | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          is_global?: boolean
          location?: string
          name?: string
          organizer?: string | null
          region?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string
          start_date?: string
          status?: string
          submitted_by?: string | null
          tags?: string[] | null
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          created_at: string
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
          userid: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          userid: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          userid?: string
          username?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          id: string
          is_leader: boolean
          joined_at: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_leader?: boolean
          joined_at?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_leader?: boolean
          joined_at?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_requests: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          status: string
          team_id: string
          to_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          status?: string
          team_id: string
          to_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          status?: string
          team_id?: string
          to_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          created_by: string
          hackathon_id: string
          id: string
          looking_for_teammates: boolean
          looking_visibility: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          hackathon_id: string
          id?: string
          looking_for_teammates?: boolean
          looking_visibility?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          hackathon_id?: string
          id?: string
          looking_for_teammates?: boolean
          looking_visibility?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_ai_providers: {
        Row: {
          assigned_key_index: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_key_index: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_key_index?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      is_team_leader: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
