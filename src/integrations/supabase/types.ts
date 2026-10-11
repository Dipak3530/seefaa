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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_explanations: {
        Row: {
          content: string
          created_at: string
          formula_id: string | null
          id: string
          mistake_id: string | null
          mode: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          formula_id?: string | null
          id?: string
          mistake_id?: string | null
          mode: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          formula_id?: string | null
          id?: string
          mistake_id?: string | null
          mode?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_explanations_mistake_id_fkey"
            columns: ["mistake_id"]
            isOneToOne: false
            referencedRelation: "mistakes"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          created_at: string
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      curriculum_versions: {
        Row: {
          id: string
          is_active: boolean
          label: string
          level: number
          notes: string | null
        }
        Insert: {
          id: string
          is_active?: boolean
          label: string
          level: number
          notes?: string | null
        }
        Update: {
          id?: string
          is_active?: boolean
          label?: string
          level?: number
          notes?: string | null
        }
        Relationships: []
      }
      exam_attempts: {
        Row: {
          created_at: string
          exam_date: string | null
          id: string
          is_active: boolean
          label: string
          start_date: string
          target_completion_date: string | null
          user_id: string
          version_id: string
        }
        Insert: {
          created_at?: string
          exam_date?: string | null
          id?: string
          is_active?: boolean
          label?: string
          start_date?: string
          target_completion_date?: string | null
          user_id: string
          version_id: string
        }
        Update: {
          created_at?: string
          exam_date?: string | null
          id?: string
          is_active?: boolean
          label?: string
          start_date?: string
          target_completion_date?: string | null
          user_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "curriculum_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      formulas: {
        Row: {
          calculator: string | null
          common_mistakes: string | null
          conditions: string | null
          created_at: string
          example: string | null
          explanation: string | null
          expression: string
          favorite: boolean
          id: string
          module_id: string | null
          name: string
          revision_status: string
          subject_id: string | null
          tags: string[]
          user_id: string
          variables: string | null
        }
        Insert: {
          calculator?: string | null
          common_mistakes?: string | null
          conditions?: string | null
          created_at?: string
          example?: string | null
          explanation?: string | null
          expression: string
          favorite?: boolean
          id?: string
          module_id?: string | null
          name: string
          revision_status?: string
          subject_id?: string | null
          tags?: string[]
          user_id: string
          variables?: string | null
        }
        Update: {
          calculator?: string | null
          common_mistakes?: string | null
          conditions?: string | null
          created_at?: string
          example?: string | null
          explanation?: string | null
          expression?: string
          favorite?: boolean
          id?: string
          module_id?: string | null
          name?: string
          revision_status?: string
          subject_id?: string | null
          tags?: string[]
          user_id?: string
          variables?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formulas_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulas_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      los: {
        Row: {
          code: string
          id: string
          module_id: string
          needs_verification: boolean
          sort: number
          statement: string
        }
        Insert: {
          code: string
          id: string
          module_id: string
          needs_verification?: boolean
          sort?: number
          statement: string
        }
        Update: {
          code?: string
          id?: string
          module_id?: string
          needs_verification?: boolean
          sort?: number
          statement?: string
        }
        Relationships: [
          {
            foreignKeyName: "los_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      los_progress: {
        Row: {
          attempt_id: string
          completed_at: string | null
          confidence: string | null
          id: string
          los_id: string
          status: string
          user_id: string
        }
        Insert: {
          attempt_id: string
          completed_at?: string | null
          confidence?: string | null
          id?: string
          los_id: string
          status?: string
          user_id: string
        }
        Update: {
          attempt_id?: string
          completed_at?: string | null
          confidence?: string | null
          id?: string
          los_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "los_progress_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "los_progress_los_id_fkey"
            columns: ["los_id"]
            isOneToOne: false
            referencedRelation: "los"
            referencedColumns: ["id"]
          },
        ]
      }
      mistake_attempts: {
        Row: {
          answer: string | null
          created_at: string
          id: string
          is_correct: boolean
          mistake_id: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          created_at?: string
          id?: string
          is_correct: boolean
          mistake_id: string
          user_id: string
        }
        Update: {
          answer?: string | null
          created_at?: string
          id?: string
          is_correct?: boolean
          mistake_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mistake_attempts_mistake_id_fkey"
            columns: ["mistake_id"]
            isOneToOne: false
            referencedRelation: "mistakes"
            referencedColumns: ["id"]
          },
        ]
      }
      mistakes: {
        Row: {
          attempt_id: string | null
          attempts_count: number
          choices: Json
          concept: string | null
          correct_answer: string | null
          correct_count: number
          correct_verified: boolean
          created_at: string
          error_category: string
          id: string
          image_hash: string | null
          image_paths: string[]
          interval_days: number
          los_id: string | null
          mastery: string
          module_id: string | null
          next_review: string
          notes: string | null
          parent_id: string | null
          question: string
          selected_answer: string | null
          source: string
          streak: number
          subject_id: string | null
          updated_at: string
          user_id: string
          version_id: string | null
        }
        Insert: {
          attempt_id?: string | null
          attempts_count?: number
          choices?: Json
          concept?: string | null
          correct_answer?: string | null
          correct_count?: number
          correct_verified?: boolean
          created_at?: string
          error_category?: string
          id?: string
          image_hash?: string | null
          image_paths?: string[]
          interval_days?: number
          los_id?: string | null
          mastery?: string
          module_id?: string | null
          next_review?: string
          notes?: string | null
          parent_id?: string | null
          question: string
          selected_answer?: string | null
          source?: string
          streak?: number
          subject_id?: string | null
          updated_at?: string
          user_id: string
          version_id?: string | null
        }
        Update: {
          attempt_id?: string | null
          attempts_count?: number
          choices?: Json
          concept?: string | null
          correct_answer?: string | null
          correct_count?: number
          correct_verified?: boolean
          created_at?: string
          error_category?: string
          id?: string
          image_hash?: string | null
          image_paths?: string[]
          interval_days?: number
          los_id?: string | null
          mastery?: string
          module_id?: string | null
          next_review?: string
          notes?: string | null
          parent_id?: string | null
          question?: string
          selected_answer?: string | null
          source?: string
          streak?: number
          subject_id?: string | null
          updated_at?: string
          user_id?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mistakes_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mistakes_los_id_fkey"
            columns: ["los_id"]
            isOneToOne: false
            referencedRelation: "los"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mistakes_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mistakes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mistakes_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "curriculum_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_exams: {
        Row: {
          attempt_id: string | null
          created_at: string
          exam_date: string
          id: string
          name: string
          score_pct: number
          subject_scores: Json
          time_notes: string | null
          user_id: string
          weak_areas: string | null
        }
        Insert: {
          attempt_id?: string | null
          created_at?: string
          exam_date?: string
          id?: string
          name: string
          score_pct: number
          subject_scores?: Json
          time_notes?: string | null
          user_id: string
          weak_areas?: string | null
        }
        Update: {
          attempt_id?: string | null
          created_at?: string
          exam_date?: string
          id?: string
          name?: string
          score_pct?: number
          subject_scores?: Json
          time_notes?: string | null
          user_id?: string
          weak_areas?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mock_exams_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      module_progress: {
        Row: {
          attempt_id: string
          completed_at: string | null
          confidence: string | null
          id: string
          module_id: string
          notes: string | null
          status: string
          studied_on: string | null
          user_id: string
        }
        Insert: {
          attempt_id: string
          completed_at?: string | null
          confidence?: string | null
          id?: string
          module_id: string
          notes?: string | null
          status?: string
          studied_on?: string | null
          user_id: string
        }
        Update: {
          attempt_id?: string
          completed_at?: string | null
          confidence?: string | null
          id?: string
          module_id?: string
          notes?: string | null
          status?: string
          studied_on?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_progress_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          id: string
          needs_verification: boolean
          sort: number
          subject_id: string
          title: string
          version_id: string
        }
        Insert: {
          id: string
          needs_verification?: boolean
          sort: number
          subject_id: string
          title: string
          version_id: string
        }
        Update: {
          id?: string
          needs_verification?: boolean
          sort?: number
          subject_id?: string
          title?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modules_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "curriculum_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_sessions: {
        Row: {
          attempt_id: string | null
          correct: number
          created_at: string
          id: string
          minutes: number | null
          module_id: string | null
          notes: string | null
          session_date: string
          source: string | null
          subject_id: string | null
          total: number
          user_id: string
        }
        Insert: {
          attempt_id?: string | null
          correct: number
          created_at?: string
          id?: string
          minutes?: number | null
          module_id?: string | null
          notes?: string | null
          session_date?: string
          source?: string | null
          subject_id?: string | null
          total: number
          user_id: string
        }
        Update: {
          attempt_id?: string | null
          correct?: number
          created_at?: string
          id?: string
          minutes?: number | null
          module_id?: string | null
          notes?: string | null
          session_date?: string
          source?: string | null
          subject_id?: string | null
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_sessions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_sessions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_attempt_id: string | null
          created_at: string
          display_name: string | null
          hours_per_day: number
          id: string
          leaderboard_opt_in: boolean
          onboarded: boolean
          reminders: Json
          study_days: number[]
          timezone: string
        }
        Insert: {
          active_attempt_id?: string | null
          created_at?: string
          display_name?: string | null
          hours_per_day?: number
          id: string
          leaderboard_opt_in?: boolean
          onboarded?: boolean
          reminders?: Json
          study_days?: number[]
          timezone?: string
        }
        Update: {
          active_attempt_id?: string | null
          created_at?: string
          display_name?: string | null
          hours_per_day?: number
          id?: string
          leaderboard_opt_in?: boolean
          onboarded?: boolean
          reminders?: Json
          study_days?: number[]
          timezone?: string
        }
        Relationships: []
      }
      revision_checkpoints: {
        Row: {
          attempt_id: string
          completed_at: string | null
          confidence: string | null
          due_date: string
          id: string
          module_id: string
          notes: string | null
          performance: number | null
          stage: number
          user_id: string
        }
        Insert: {
          attempt_id: string
          completed_at?: string | null
          confidence?: string | null
          due_date: string
          id?: string
          module_id: string
          notes?: string | null
          performance?: number | null
          stage: number
          user_id: string
        }
        Update: {
          attempt_id?: string
          completed_at?: string | null
          confidence?: string | null
          due_date?: string
          id?: string
          module_id?: string
          notes?: string | null
          performance?: number | null
          stage?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revision_checkpoints_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_checkpoints_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      study_tasks: {
        Row: {
          attempt_id: string
          completed_at: string | null
          created_at: string
          done: boolean
          id: string
          kind: string
          minutes: number
          module_id: string | null
          subject_id: string | null
          task_date: string
          title: string
          user_id: string
        }
        Insert: {
          attempt_id: string
          completed_at?: string | null
          created_at?: string
          done?: boolean
          id?: string
          kind: string
          minutes?: number
          module_id?: string | null
          subject_id?: string | null
          task_date: string
          title: string
          user_id: string
        }
        Update: {
          attempt_id?: string
          completed_at?: string | null
          created_at?: string
          done?: boolean
          id?: string
          kind?: string
          minutes?: number
          module_id?: string | null
          subject_id?: string | null
          task_date?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_tasks_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_tasks_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_tasks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_plans: {
        Row: {
          attempt_id: string
          confidence: string | null
          deadline: string | null
          id: string
          position: number | null
          status: string
          subject_id: string
          user_id: string
        }
        Insert: {
          attempt_id: string
          confidence?: string | null
          deadline?: string | null
          id?: string
          position?: number | null
          status?: string
          subject_id: string
          user_id: string
        }
        Update: {
          attempt_id?: string
          confidence?: string | null
          deadline?: string | null
          id?: string
          position?: number | null
          status?: string
          subject_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_plans_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_plans_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          est_hours: number
          id: string
          name: string
          short_name: string
          sort: number
          version_id: string
        }
        Insert: {
          est_hours?: number
          id: string
          name: string
          short_name: string
          sort: number
          version_id: string
        }
        Update: {
          est_hours?: number
          id?: string
          name?: string
          short_name?: string
          sort?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "curriculum_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      timer_sessions: {
        Row: {
          active_seconds: number | null
          attempt_id: string | null
          created_at: string
          ended_at: string | null
          id: string
          kind: string
          module_id: string | null
          notes: string | null
          paused_at: string | null
          paused_seconds: number
          started_at: string
          status: string
          subject_id: string | null
          user_id: string
        }
        Insert: {
          active_seconds?: number | null
          attempt_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          kind: string
          module_id?: string | null
          notes?: string | null
          paused_at?: string | null
          paused_seconds?: number
          started_at?: string
          status?: string
          subject_id?: string | null
          user_id: string
        }
        Update: {
          active_seconds?: number | null
          attempt_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          kind?: string
          module_id?: string | null
          notes?: string | null
          paused_at?: string | null
          paused_seconds?: number
          started_at?: string
          status?: string
          subject_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timer_sessions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timer_sessions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timer_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ai_keys: {
        Row: {
          api_key: string
          created_at: string
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          created_at?: string
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_ai_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      xp_config: {
        Row: {
          amount: number
          description: string | null
          key: string
        }
        Insert: {
          amount: number
          description?: string | null
          key: string
        }
        Update: {
          amount?: number
          description?: string | null
          key?: string
        }
        Relationships: []
      }
      xp_ledger: {
        Row: {
          amount: number
          attempt_id: string | null
          created_at: string
          id: string
          source: string
          source_key: string
          user_id: string
        }
        Insert: {
          amount: number
          attempt_id?: string | null
          created_at?: string
          id?: string
          source: string
          source_key: string
          user_id: string
        }
        Update: {
          amount?: number
          attempt_id?: string | null
          created_at?: string
          id?: string
          source?: string
          source_key?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_xp: {
        Args: { _attempt: string; _key: string; _source: string; _user: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      leaderboard: {
        Args: { _days?: number }
        Returns: {
          display_name: string
          is_me: boolean
          xp: number
        }[]
      }
      timer_action: {
        Args: { _action: string; _id: string; _notes?: string }
        Returns: {
          active_seconds: number | null
          attempt_id: string | null
          created_at: string
          ended_at: string | null
          id: string
          kind: string
          module_id: string | null
          notes: string | null
          paused_at: string | null
          paused_seconds: number
          started_at: string
          status: string
          subject_id: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "timer_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
