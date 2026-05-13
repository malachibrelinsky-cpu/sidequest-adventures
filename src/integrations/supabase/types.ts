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
      comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: []
      }
      leaderboard_members: {
        Row: {
          joined_at: string
          leaderboard_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          leaderboard_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          leaderboard_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_members_leaderboard_id_fkey"
            columns: ["leaderboard_id"]
            isOneToOne: false
            referencedRelation: "leaderboards"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboards: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          caption: string | null
          completed_at: string | null
          created_at: string
          difficulty: string | null
          evidence_urls: string[]
          id: string
          image_urls: string[]
          lat_approx: number | null
          latitude: number | null
          location: string | null
          lon_approx: number | null
          longitude: number | null
          notes: string | null
          participants_needed: number | null
          points: number | null
          quest_time: string | null
          user_id: string
        }
        Insert: {
          caption?: string | null
          completed_at?: string | null
          created_at?: string
          difficulty?: string | null
          evidence_urls?: string[]
          id?: string
          image_urls?: string[]
          lat_approx?: number | null
          latitude?: number | null
          location?: string | null
          lon_approx?: number | null
          longitude?: number | null
          notes?: string | null
          participants_needed?: number | null
          points?: number | null
          quest_time?: string | null
          user_id: string
        }
        Update: {
          caption?: string | null
          completed_at?: string | null
          created_at?: string
          difficulty?: string | null
          evidence_urls?: string[]
          id?: string
          image_urls?: string[]
          lat_approx?: number | null
          latitude?: number | null
          location?: string | null
          lon_approx?: number | null
          longitude?: number | null
          notes?: string | null
          participants_needed?: number | null
          points?: number | null
          quest_time?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_ratings: {
        Row: {
          created_at: string
          id: string
          ratee_id: string
          rater_id: string
          review: string | null
          stars: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ratee_id: string
          rater_id: string
          review?: string | null
          stars: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ratee_id?: string
          rater_id?: string
          review?: string | null
          stars?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          contacts_synced_at: string | null
          created_at: string
          discoverable_by_contacts: boolean
          display_name: string
          id: string
          interests: string[] | null
          lat_approx: number | null
          latitude: number | null
          lon_approx: number | null
          longitude: number | null
          map_color: string
          phone_e164: string | null
          phone_hash: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          contacts_synced_at?: string | null
          created_at?: string
          discoverable_by_contacts?: boolean
          display_name: string
          id: string
          interests?: string[] | null
          lat_approx?: number | null
          latitude?: number | null
          lon_approx?: number | null
          longitude?: number | null
          map_color?: string
          phone_e164?: string | null
          phone_hash?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          contacts_synced_at?: string | null
          created_at?: string
          discoverable_by_contacts?: boolean
          display_name?: string
          id?: string
          interests?: string[] | null
          lat_approx?: number | null
          latitude?: number | null
          lon_approx?: number | null
          longitude?: number | null
          map_color?: string
          phone_e164?: string | null
          phone_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quest_completions: {
        Row: {
          created_at: string
          difficulty: string
          id: string
          notes: string | null
          points: number
          post_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty: string
          id?: string
          notes?: string | null
          points: number
          post_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty?: string
          id?: string
          notes?: string | null
          points?: number
          post_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      quest_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quest_messages_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      quest_participants: {
        Row: {
          joined_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quest_participants_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quest_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscribers: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          is_premium: boolean
          last_streak_revive_at: string | null
          plan: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          is_premium?: boolean
          last_streak_revive_at?: string | null
          plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          is_premium?: boolean
          last_streak_revive_at?: string | null
          plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_moderation: {
        Row: {
          reason: string | null
          status: string
          until: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          reason?: string | null
          status?: string
          until?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          reason?: string | null
          status?: string
          until?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          ai_reasoning: string | null
          ai_reviewed_at: string | null
          ai_verdict: string | null
          context: string | null
          created_at: string
          id: string
          reason: string
          reported_user_id: string
          reporter_id: string
          resolution: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          ai_reasoning?: string | null
          ai_reviewed_at?: string | null
          ai_verdict?: string | null
          context?: string | null
          created_at?: string
          id?: string
          reason: string
          reported_user_id: string
          reporter_id: string
          resolution?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          ai_reasoning?: string | null
          ai_reviewed_at?: string | null
          ai_verdict?: string | null
          context?: string | null
          created_at?: string
          id?: string
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          resolution?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
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
      current_week_start_utc: { Args: never; Returns: string }
      find_friends_by_phone_hashes: {
        Args: { hashes: string[] }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
        }[]
      }
      get_my_location: {
        Args: never
        Returns: {
          latitude: number
          longitude: number
        }[]
      }
      get_my_post_location: {
        Args: { p_post_id: string }
        Returns: {
          latitude: number
          longitude: number
        }[]
      }
      get_my_profile_phone: {
        Args: never
        Returns: {
          contacts_synced_at: string
          discoverable_by_contacts: boolean
          phone_e164: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_phone: { Args: { _phone: string }; Returns: string }
      is_leaderboard_member: {
        Args: { _lb: string; _user: string }
        Returns: boolean
      }
      is_quest_participant: {
        Args: { _post: string; _user: string }
        Returns: boolean
      }
      is_user_premium: { Args: { _uid: string }; Returns: boolean }
      join_quest: { Args: { p_post_id: string }; Returns: undefined }
      mark_contacts_synced: { Args: never; Returns: undefined }
      post_quest: {
        Args: {
          p_caption: string
          p_difficulty: string
          p_image_urls: string[]
          p_latitude: number
          p_location: string
          p_longitude: number
          p_notes: string
          p_participants_needed: number
          p_points: number
          p_quest_time: string
        }
        Returns: string
      }
      post_update: {
        Args: { p_caption: string; p_image_urls: string[] }
        Returns: string
      }
      revive_streak: { Args: never; Returns: undefined }
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
