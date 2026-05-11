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
      cards: {
        Row: {
          back: string
          card_type: string
          created_at: string
          deck_id: string
          ease_factor: number
          front: string
          id: string
          interval_days: number
          last_seen_at: string | null
          mc_distractors: string[] | null
          mc_status: string | null
          next_review_at: string | null
          repetitions: number
          sort_order: number | null
          tags: string[]
          times_correct: number
          times_seen: number
        }
        Insert: {
          back: string
          card_type?: string
          created_at?: string
          deck_id: string
          ease_factor?: number
          front: string
          id?: string
          interval_days?: number
          last_seen_at?: string | null
          mc_distractors?: string[] | null
          mc_status?: string | null
          next_review_at?: string | null
          repetitions?: number
          sort_order?: number | null
          tags?: string[]
          times_correct?: number
          times_seen?: number
        }
        Update: {
          back?: string
          card_type?: string
          created_at?: string
          deck_id?: string
          ease_factor?: number
          front?: string
          id?: string
          interval_days?: number
          last_seen_at?: string | null
          mc_distractors?: string[] | null
          mc_status?: string | null
          next_review_at?: string | null
          repetitions?: number
          sort_order?: number | null
          tags?: string[]
          times_correct?: number
          times_seen?: number
        }
        Relationships: [
          {
            foreignKeyName: "cards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_attempts: {
        Row: {
          card_results: Json
          challenge_id: string
          completed_at: string | null
          id: string
          score: number | null
          started_at: string | null
          status: string
          total: number | null
          user_id: string
        }
        Insert: {
          card_results?: Json
          challenge_id: string
          completed_at?: string | null
          id?: string
          score?: number | null
          started_at?: string | null
          status?: string
          total?: number | null
          user_id: string
        }
        Update: {
          card_results?: Json
          challenge_id?: string
          completed_at?: string | null
          id?: string
          score?: number | null
          started_at?: string | null
          status?: string
          total?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_attempts_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          card_ids: string[] | null
          challenger_id: string
          created_at: string
          deck_id: string | null
          expires_at: string | null
          id: string
          quiz_mode: string
          status: string
          title: string
        }
        Insert: {
          card_ids?: string[] | null
          challenger_id: string
          created_at?: string
          deck_id?: string | null
          expires_at?: string | null
          id?: string
          quiz_mode?: string
          status?: string
          title: string
        }
        Update: {
          card_ids?: string[] | null
          challenger_id?: string
          created_at?: string
          deck_id?: string | null
          expires_at?: string | null
          id?: string
          quiz_mode?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_decks: {
        Row: {
          added_at: string
          collection_id: string
          deck_id: string
        }
        Insert: {
          added_at?: string
          collection_id: string
          deck_id: string
        }
        Update: {
          added_at?: string
          collection_id?: string
          deck_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_decks_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_decks_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      decks: {
        Row: {
          card_count: number
          created_at: string
          id: string
          is_public: boolean
          note_id: string | null
          source_deck_id: string | null
          title: string
          topic_tags: string[]
          user_id: string | null
        }
        Insert: {
          card_count?: number
          created_at?: string
          id?: string
          is_public?: boolean
          note_id?: string | null
          source_deck_id?: string | null
          title: string
          topic_tags?: string[]
          user_id?: string | null
        }
        Update: {
          card_count?: number
          created_at?: string
          id?: string
          is_public?: boolean
          note_id?: string | null
          source_deck_id?: string | null
          title?: string
          topic_tags?: string[]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decks_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decks_source_deck_id_fkey"
            columns: ["source_deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          created_at: string
          github_sha: string | null
          id: string
          processed_at: string | null
          raw_content: string
          source_path: string
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          github_sha?: string | null
          id?: string
          processed_at?: string | null
          raw_content: string
          source_path: string
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          github_sha?: string | null
          id?: string
          processed_at?: string | null
          raw_content?: string
          source_path?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          payload: Json
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          daily_goal: number | null
          default_study_mode: string | null
          display_name: string | null
          id: string
          notification_prefs: Json
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          daily_goal?: number | null
          default_study_mode?: string | null
          display_name?: string | null
          id: string
          notification_prefs?: Json
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          daily_goal?: number | null
          default_study_mode?: string | null
          display_name?: string | null
          id?: string
          notification_prefs?: Json
        }
        Relationships: []
      }
      sessions: {
        Row: {
          completed_at: string | null
          deck_id: string
          id: string
          score: number | null
          started_at: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          deck_id: string
          id?: string
          score?: number | null
          started_at?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          deck_id?: string
          id?: string
          score?: number | null
          started_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
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
