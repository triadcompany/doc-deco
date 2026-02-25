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
      bible_bookmarks: {
        Row: {
          book_abbrev: string
          book_name: string
          chapter: number
          created_at: string
          id: string
          user_id: string
          verse: number
          verse_text: string
          version: string
        }
        Insert: {
          book_abbrev: string
          book_name: string
          chapter: number
          created_at?: string
          id?: string
          user_id: string
          verse: number
          verse_text: string
          version: string
        }
        Update: {
          book_abbrev?: string
          book_name?: string
          chapter?: number
          created_at?: string
          id?: string
          user_id?: string
          verse?: number
          verse_text?: string
          version?: string
        }
        Relationships: []
      }
      bible_highlights: {
        Row: {
          book_abbrev: string
          chapter: number
          color: string
          created_at: string
          id: string
          user_id: string
          verse: number
          version: string
        }
        Insert: {
          book_abbrev: string
          chapter: number
          color?: string
          created_at?: string
          id?: string
          user_id: string
          verse: number
          version: string
        }
        Update: {
          book_abbrev?: string
          chapter?: number
          color?: string
          created_at?: string
          id?: string
          user_id?: string
          verse?: number
          version?: string
        }
        Relationships: []
      }
      bible_notes: {
        Row: {
          book_abbrev: string
          book_name: string
          chapter: number
          created_at: string
          id: string
          note: string
          updated_at: string
          user_id: string
          verse: number | null
          version: string
        }
        Insert: {
          book_abbrev: string
          book_name: string
          chapter: number
          created_at?: string
          id?: string
          note: string
          updated_at?: string
          user_id: string
          verse?: number | null
          version: string
        }
        Update: {
          book_abbrev?: string
          book_name?: string
          chapter?: number
          created_at?: string
          id?: string
          note?: string
          updated_at?: string
          user_id?: string
          verse?: number | null
          version?: string
        }
        Relationships: []
      }
      document_annotations: {
        Row: {
          color: string
          created_at: string
          document_id: string
          id: string
          note: string | null
          page: number
          position: Json | null
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          document_id: string
          id?: string
          note?: string | null
          page: number
          position?: Json | null
          text?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          document_id?: string
          id?: string
          note?: string | null
          page?: number
          position?: Json | null
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_annotations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_summaries: {
        Row: {
          created_at: string
          document_id: string
          id: string
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          summary: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_summaries_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          author: string
          content: string | null
          created_at: string
          date: string
          favorite: boolean
          file_name: string
          file_size: number
          id: string
          pages: number | null
          storage_path: string
          tags: string[]
          title: string
          translator: string
          updated_at: string
          user_id: string | null
          visibility: string
        }
        Insert: {
          author?: string
          content?: string | null
          created_at?: string
          date?: string
          favorite?: boolean
          file_name: string
          file_size?: number
          id?: string
          pages?: number | null
          storage_path: string
          tags?: string[]
          title: string
          translator?: string
          updated_at?: string
          user_id?: string | null
          visibility?: string
        }
        Update: {
          author?: string
          content?: string | null
          created_at?: string
          date?: string
          favorite?: boolean
          file_name?: string
          file_size?: number
          id?: string
          pages?: number | null
          storage_path?: string
          tags?: string[]
          title?: string
          translator?: string
          updated_at?: string
          user_id?: string | null
          visibility?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reading_goals: {
        Row: {
          created_at: string
          daily_pages_goal: number
          id: string
          month: number
          monthly_docs_goal: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          daily_pages_goal?: number
          id?: string
          month: number
          monthly_docs_goal?: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          daily_pages_goal?: number
          id?: string
          month?: number
          monthly_docs_goal?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      reading_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          current_page: number
          document_id: string
          id: string
          is_reading: boolean
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          current_page?: number
          document_id: string
          id?: string
          is_reading?: boolean
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          current_page?: number
          document_id?: string
          id?: string
          is_reading?: boolean
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_progress_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
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
