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
      app_templates: {
        Row: {
          created_at: string
          description: string | null
          key: string
          payload: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          payload: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          checkin_date: string
          created_at: string
          energy: number | null
          hunger: number | null
          id: string
          notes: string | null
          sleep_hours: number | null
          sleep_quality: string | null
          steps: number | null
          updated_at: string
          user_id: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          checkin_date: string
          created_at?: string
          energy?: number | null
          hunger?: number | null
          id?: string
          notes?: string | null
          sleep_hours?: number | null
          sleep_quality?: string | null
          steps?: number | null
          updated_at?: string
          user_id: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          checkin_date?: string
          created_at?: string
          energy?: number | null
          hunger?: number | null
          id?: string
          notes?: string | null
          sleep_hours?: number | null
          sleep_quality?: string | null
          steps?: number | null
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      food_entries: {
        Row: {
          carbs_g: number | null
          client_request_id: string | null
          created_at: string
          entry_date: string
          fat_g: number | null
          food_item_id: string | null
          id: string
          kcal: number
          meal_slot: string
          name: string
          plan_meal_id: string | null
          protein_g: number
          qty_label: string | null
          quantity: number | null
          recipe_id: string | null
          snack_kind: string | null
          source: string
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          carbs_g?: number | null
          client_request_id?: string | null
          created_at?: string
          entry_date: string
          fat_g?: number | null
          food_item_id?: string | null
          id?: string
          kcal: number
          meal_slot?: string
          name: string
          plan_meal_id?: string | null
          protein_g: number
          qty_label?: string | null
          quantity?: number | null
          recipe_id?: string | null
          snack_kind?: string | null
          source: string
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          carbs_g?: number | null
          client_request_id?: string | null
          created_at?: string
          entry_date?: string
          fat_g?: number | null
          food_item_id?: string | null
          id?: string
          kcal?: number
          meal_slot?: string
          name?: string
          plan_meal_id?: string | null
          protein_g?: number
          qty_label?: string | null
          quantity?: number | null
          recipe_id?: string | null
          snack_kind?: string | null
          source?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_entries_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_entries_plan_meal_id_fkey"
            columns: ["plan_meal_id"]
            isOneToOne: false
            referencedRelation: "meal_plan_meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_entries_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      food_items: {
        Row: {
          basis: string
          brand: string | null
          carbs_g: number | null
          created_at: string
          default_amount: number
          diet_type: string
          fat_g: number | null
          id: string
          kcal: number
          name: string
          notes: string | null
          protein_g: number
          seed_key: string | null
          unit_label: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          basis: string
          brand?: string | null
          carbs_g?: number | null
          created_at?: string
          default_amount: number
          diet_type?: string
          fat_g?: number | null
          id?: string
          kcal: number
          name: string
          notes?: string | null
          protein_g: number
          seed_key?: string | null
          unit_label: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          basis?: string
          brand?: string | null
          carbs_g?: number | null
          created_at?: string
          default_amount?: number
          diet_type?: string
          fat_g?: number | null
          id?: string
          kcal?: number
          name?: string
          notes?: string | null
          protein_g?: number
          seed_key?: string | null
          unit_label?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      grocery_list_items: {
        Row: {
          created_at: string
          id: string
          is_purchased: boolean
          list_id: string
          name: string
          position: number
          quantity: number | null
          quantity_label: string | null
          source: string
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_purchased?: boolean
          list_id: string
          name: string
          position?: number
          quantity?: number | null
          quantity_label?: string | null
          source?: string
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_purchased?: boolean
          list_id?: string
          name?: string
          position?: number
          quantity?: number | null
          quantity_label?: string | null
          source?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grocery_list_items_list_id_user_id_fkey"
            columns: ["list_id", "user_id"]
            isOneToOne: false
            referencedRelation: "grocery_lists"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      grocery_lists: {
        Row: {
          created_at: string
          generated_at: string | null
          generated_from_plan_id: string | null
          id: string
          is_current: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          generated_at?: string | null
          generated_from_plan_id?: string | null
          id?: string
          is_current?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          generated_at?: string | null
          generated_from_plan_id?: string | null
          id?: string
          is_current?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grocery_lists_generated_from_plan_id_fkey"
            columns: ["generated_from_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_logs: {
        Row: {
          completed: boolean
          created_at: string
          habit_id: string
          id: string
          log_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          habit_id: string
          id?: string
          log_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          habit_id?: string
          id?: string
          log_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_user_id_fkey"
            columns: ["habit_id", "user_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      habits: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_plan_days: {
        Row: {
          created_at: string
          id: string
          is_strict_veg: boolean
          plan_id: string
          updated_at: string
          user_id: string
          weekday: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_strict_veg?: boolean
          plan_id: string
          updated_at?: string
          user_id: string
          weekday: number
        }
        Update: {
          created_at?: string
          id?: string
          is_strict_veg?: boolean
          plan_id?: string
          updated_at?: string
          user_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_days_plan_id_user_id_fkey"
            columns: ["plan_id", "user_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      meal_plan_meal_ingredients: {
        Row: {
          carbs_g: number | null
          created_at: string
          diet_type: string
          fat_g: number | null
          food_item_id: string | null
          id: string
          kcal: number
          meal_id: string
          name: string
          position: number
          protein_g: number
          qty_label: string | null
          quantity: number | null
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          carbs_g?: number | null
          created_at?: string
          diet_type?: string
          fat_g?: number | null
          food_item_id?: string | null
          id?: string
          kcal?: number
          meal_id: string
          name: string
          position?: number
          protein_g?: number
          qty_label?: string | null
          quantity?: number | null
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          carbs_g?: number | null
          created_at?: string
          diet_type?: string
          fat_g?: number | null
          food_item_id?: string | null
          id?: string
          kcal?: number
          meal_id?: string
          name?: string
          position?: number
          protein_g?: number
          qty_label?: string | null
          quantity?: number | null
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_meal_ingredients_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_meal_ingredients_meal_id_user_id_fkey"
            columns: ["meal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "meal_plan_meals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      meal_plan_meals: {
        Row: {
          created_at: string
          day_id: string
          id: string
          note: string | null
          slot: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_id: string
          id?: string
          note?: string | null
          slot: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_id?: string
          id?: string
          note?: string | null
          slot?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_meals_day_id_user_id_fkey"
            columns: ["day_id", "user_id"]
            isOneToOne: false
            referencedRelation: "meal_plan_days"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nutrition_targets: {
        Row: {
          bmr_kcal: number | null
          calories_kcal: number
          created_at: string
          creatine_g: number
          effective_from: string
          id: string
          note: string | null
          protein_g: number
          steps: number
          tdee_kcal: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bmr_kcal?: number | null
          calories_kcal: number
          created_at?: string
          creatine_g?: number
          effective_from: string
          id?: string
          note?: string | null
          protein_g: number
          steps?: number
          tdee_kcal?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bmr_kcal?: number | null
          calories_kcal?: number
          created_at?: string
          creatine_g?: number
          effective_from?: string
          id?: string
          note?: string | null
          protein_g?: number
          steps?: number
          tdee_kcal?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_description: string | null
          activity_multiplier: number
          birth_year: number | null
          created_at: string
          display_name: string | null
          goal: string
          height_cm: number | null
          id: string
          sex: string | null
          starting_weight_kg: number | null
          timezone: string
          training_notes: string | null
          updated_at: string
        }
        Insert: {
          activity_description?: string | null
          activity_multiplier?: number
          birth_year?: number | null
          created_at?: string
          display_name?: string | null
          goal?: string
          height_cm?: number | null
          id: string
          sex?: string | null
          starting_weight_kg?: number | null
          timezone?: string
          training_notes?: string | null
          updated_at?: string
        }
        Update: {
          activity_description?: string | null
          activity_multiplier?: number
          birth_year?: number | null
          created_at?: string
          display_name?: string | null
          goal?: string
          height_cm?: number | null
          id?: string
          sex?: string | null
          starting_weight_kg?: number | null
          timezone?: string
          training_notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          carbs_g: number | null
          created_at: string
          diet_type: string
          fat_g: number | null
          food_item_id: string | null
          id: string
          kcal: number
          name: string
          position: number
          protein_g: number
          qty_label: string | null
          quantity: number | null
          recipe_id: string
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          carbs_g?: number | null
          created_at?: string
          diet_type?: string
          fat_g?: number | null
          food_item_id?: string | null
          id?: string
          kcal?: number
          name: string
          position?: number
          protein_g?: number
          qty_label?: string | null
          quantity?: number | null
          recipe_id: string
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          carbs_g?: number | null
          created_at?: string
          diet_type?: string
          fat_g?: number | null
          food_item_id?: string | null
          id?: string
          kcal?: number
          name?: string
          position?: number
          protein_g?: number
          qty_label?: string | null
          quantity?: number | null
          recipe_id?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_user_id_fkey"
            columns: ["recipe_id", "user_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      recipes: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          name: string
          servings: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          servings?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          servings?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          excluded_foods: string[]
          food_preferences: string | null
          ui_settings: Json
          updated_at: string
          user_id: string
          whole_eggs_only: boolean
        }
        Insert: {
          created_at?: string
          excluded_foods?: string[]
          food_preferences?: string | null
          ui_settings?: Json
          updated_at?: string
          user_id: string
          whole_eggs_only?: boolean
        }
        Update: {
          created_at?: string
          excluded_foods?: string[]
          food_preferences?: string | null
          ui_settings?: Json
          updated_at?: string
          user_id?: string
          whole_eggs_only?: boolean
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          position: number
          session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          position?: number
          session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          position?: number
          session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_session_id_user_id_fkey"
            columns: ["session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          created_at: string
          duration_min: number | null
          id: string
          notes: string | null
          session_date: string
          split: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_min?: number | null
          id?: string
          notes?: string | null
          session_date: string
          split: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_min?: number | null
          id?: string
          notes?: string | null
          session_date?: string
          split?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_sets: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          is_warmup: boolean
          reps: number
          rpe: number | null
          set_number: number
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          is_warmup?: boolean
          reps: number
          rpe?: number | null
          set_number: number
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          is_warmup?: boolean
          reps?: number
          rpe?: number | null
          set_number?: number
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_exercise_id_user_id_fkey"
            columns: ["exercise_id", "user_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      copy_my_plan_meal: {
        Args: {
          p_from_weekday: number
          p_slot: string
          p_to_weekdays: number[]
        }
        Returns: number
      }
      generate_my_grocery_list: {
        Args: { p_items: Json; p_name: string }
        Returns: string
      }
      replace_my_meal_plan: { Args: { p_payload: Json }; Returns: string }
      reset_my_day: { Args: { p_date: string }; Returns: undefined }
      reset_my_meal_plan: { Args: never; Returns: string }
      save_my_plan_meal: {
        Args: { p_meal: Json; p_slot: string; p_weekday: number }
        Returns: string
      }
      save_my_recipe: {
        Args: { p_recipe: Json; p_recipe_id: string }
        Returns: string
      }
      save_my_workout: {
        Args: { p_session_id: string; p_workout: Json }
        Returns: string
      }
      set_my_snack: {
        Args: { p_date: string; p_entry: Json; p_kind: string }
        Returns: string
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
