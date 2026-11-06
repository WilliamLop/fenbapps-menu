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
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          new_state: Json | null
          previous_state: Json | null
          restaurant_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          new_state?: Json | null
          previous_state?: Json | null
          restaurant_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          new_state?: Json | null
          previous_state?: Json | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          display_mode: string
          id: string
          is_active: boolean
          menu_id: string
          name: string
          restaurant_id: string
          slug: string
          sort_order: number
          subtitle: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_mode?: string
          id?: string
          is_active?: boolean
          menu_id: string
          name: string
          restaurant_id: string
          slug: string
          sort_order?: number
          subtitle?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_mode?: string
          id?: string
          is_active?: boolean
          menu_id?: string
          name?: string
          restaurant_id?: string
          slug?: string
          sort_order?: number
          subtitle?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_inquiries: {
        Row: {
          company_name: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          event_package_id: string | null
          event_space_id: string | null
          event_type: string
          guest_count: number
          id: string
          internal_admin_notes: string | null
          location_id: string | null
          preferred_time_slot: string
          privacy_accepted: boolean
          privacy_accepted_at: string
          privacy_policy_version: string
          reference_code: string
          restaurant_id: string
          source_ip_hash: string | null
          special_requests: string | null
          status: string
          tentative_date: string
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          event_package_id?: string | null
          event_space_id?: string | null
          event_type: string
          guest_count: number
          id?: string
          internal_admin_notes?: string | null
          location_id?: string | null
          preferred_time_slot: string
          privacy_accepted: boolean
          privacy_accepted_at?: string
          privacy_policy_version?: string
          reference_code: string
          restaurant_id: string
          source_ip_hash?: string | null
          special_requests?: string | null
          status?: string
          tentative_date: string
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          event_package_id?: string | null
          event_space_id?: string | null
          event_type?: string
          guest_count?: number
          id?: string
          internal_admin_notes?: string | null
          location_id?: string | null
          preferred_time_slot?: string
          privacy_accepted?: boolean
          privacy_accepted_at?: string
          privacy_policy_version?: string
          reference_code?: string
          restaurant_id?: string
          source_ip_hash?: string | null
          special_requests?: string | null
          status?: string
          tentative_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_inquiries_event_package_id_fkey"
            columns: ["event_package_id"]
            isOneToOne: false
            referencedRelation: "event_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_inquiries_event_space_id_fkey"
            columns: ["event_space_id"]
            isOneToOne: false
            referencedRelation: "event_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_inquiries_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_inquiries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_packages: {
        Row: {
          badge_label: string | null
          base_price: number | null
          conditions_text: string | null
          cover_image_url: string | null
          created_at: string
          description: string
          duration_hours: number | null
          event_category: string
          id: string
          includes_items: Json
          is_active: boolean
          is_featured: boolean
          max_guests: number | null
          min_guests: number
          name: string
          optional_extras: Json
          pricing_model: string
          restaurant_id: string
          slug: string
          sort_order: number
          tagline: string | null
          updated_at: string
        }
        Insert: {
          badge_label?: string | null
          base_price?: number | null
          conditions_text?: string | null
          cover_image_url?: string | null
          created_at?: string
          description: string
          duration_hours?: number | null
          event_category: string
          id?: string
          includes_items?: Json
          is_active?: boolean
          is_featured?: boolean
          max_guests?: number | null
          min_guests?: number
          name: string
          optional_extras?: Json
          pricing_model: string
          restaurant_id: string
          slug: string
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          badge_label?: string | null
          base_price?: number | null
          conditions_text?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string
          duration_hours?: number | null
          event_category?: string
          id?: string
          includes_items?: Json
          is_active?: boolean
          is_featured?: boolean
          max_guests?: number | null
          min_guests?: number
          name?: string
          optional_extras?: Json
          pricing_model?: string
          restaurant_id?: string
          slug?: string
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_packages_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_spaces: {
        Row: {
          ambiance_tags: string[]
          capacity_cocktail: number | null
          capacity_seated: number
          cover_image_url: string | null
          created_at: string
          description: string
          equipment_features: string[]
          gallery_urls: Json
          id: string
          is_active: boolean
          location_id: string | null
          min_guests: number
          name: string
          restaurant_id: string
          slug: string
          sort_order: number
          subtitle: string | null
          updated_at: string
        }
        Insert: {
          ambiance_tags?: string[]
          capacity_cocktail?: number | null
          capacity_seated: number
          cover_image_url?: string | null
          created_at?: string
          description: string
          equipment_features?: string[]
          gallery_urls?: Json
          id?: string
          is_active?: boolean
          location_id?: string | null
          min_guests?: number
          name: string
          restaurant_id: string
          slug: string
          sort_order?: number
          subtitle?: string | null
          updated_at?: string
        }
        Update: {
          ambiance_tags?: string[]
          capacity_cocktail?: number | null
          capacity_seated?: number
          cover_image_url?: string | null
          created_at?: string
          description?: string
          equipment_features?: string[]
          gallery_urls?: Json
          id?: string
          is_active?: boolean
          location_id?: string | null
          min_guests?: number
          name?: string
          restaurant_id?: string
          slug?: string
          sort_order?: number
          subtitle?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_spaces_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_spaces_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address_line: string
          city: string
          contact_phone: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          exclusive_features: string[]
          gallery_urls: Json
          google_maps_url: string | null
          highlights: string[]
          id: string
          is_active: boolean
          is_primary: boolean
          name: string
          neighborhood: string | null
          opening_hours: Json
          restaurant_id: string
          slug: string
          sort_order: number
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          address_line: string
          city?: string
          contact_phone?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          exclusive_features?: string[]
          gallery_urls?: Json
          google_maps_url?: string | null
          highlights?: string[]
          id?: string
          is_active?: boolean
          is_primary?: boolean
          name: string
          neighborhood?: string | null
          opening_hours?: Json
          restaurant_id: string
          slug: string
          sort_order?: number
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          address_line?: string
          city?: string
          contact_phone?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          exclusive_features?: string[]
          gallery_urls?: Json
          google_maps_url?: string | null
          highlights?: string[]
          id?: string
          is_active?: boolean
          is_primary?: boolean
          name?: string
          neighborhood?: string | null
          opening_hours?: Json
          restaurant_id?: string
          slug?: string
          sort_order?: number
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          location_id: string | null
          name: string
          restaurant_id: string
          schedule_label: string | null
          service_notes: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location_id?: string | null
          name: string
          restaurant_id: string
          schedule_label?: string | null
          service_notes?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location_id?: string | null
          name?: string
          restaurant_id?: string
          schedule_label?: string | null
          service_notes?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menus_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menus_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_groups: {
        Row: {
          created_at: string
          helper_text: string | null
          id: string
          is_required: boolean
          max_selections: number
          min_selections: number
          name: string
          product_id: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          helper_text?: string | null
          id?: string
          is_required?: boolean
          max_selections?: number
          min_selections?: number
          name: string
          product_id: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          helper_text?: string | null
          id?: string
          is_required?: boolean
          max_selections?: number
          min_selections?: number
          name?: string
          product_id?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_option_groups_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          created_at: string
          id: string
          is_available: boolean
          name: string
          option_group_id: string
          price_delta: number
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_available?: boolean
          name: string
          option_group_id: string
          price_delta?: number
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_available?: boolean
          name?: string
          option_group_id?: string
          price_delta?: number
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_options_option_group_id_fkey"
            columns: ["option_group_id"]
            isOneToOne: false
            referencedRelation: "product_option_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_options_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          availability_status: string
          badges: string[]
          base_price: number
          category_id: string
          compare_at_price: number | null
          created_at: string
          exclusive_location_id: string | null
          id: string
          image_alt: string | null
          image_url: string | null
          is_chef_choice: boolean
          is_featured: boolean
          is_new: boolean
          long_description: string | null
          name: string
          pairing_note: string | null
          portion_label: string | null
          restaurant_id: string
          short_description: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          availability_status?: string
          badges?: string[]
          base_price: number
          category_id: string
          compare_at_price?: number | null
          created_at?: string
          exclusive_location_id?: string | null
          id?: string
          image_alt?: string | null
          image_url?: string | null
          is_chef_choice?: boolean
          is_featured?: boolean
          is_new?: boolean
          long_description?: string | null
          name: string
          pairing_note?: string | null
          portion_label?: string | null
          restaurant_id: string
          short_description?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          availability_status?: string
          badges?: string[]
          base_price?: number
          category_id?: string
          compare_at_price?: number | null
          created_at?: string
          exclusive_location_id?: string | null
          id?: string
          image_alt?: string | null
          image_url?: string | null
          is_chef_choice?: boolean
          is_featured?: boolean
          is_new?: boolean
          long_description?: string | null
          name?: string
          pairing_note?: string | null
          portion_label?: string | null
          restaurant_id?: string
          short_description?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_exclusive_location_id_fkey"
            columns: ["exclusive_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_members: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          restaurant_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          restaurant_id: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          restaurant_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_members_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          contact_config: Json
          created_at: string
          cuisine_type: string | null
          currency_code: string
          enabled_modules: Json
          id: string
          is_demo: boolean
          is_published: boolean
          name: string
          slug: string
          story_excerpt: string | null
          tagline: string | null
          theme_config: Json
          updated_at: string
        }
        Insert: {
          contact_config?: Json
          created_at?: string
          cuisine_type?: string | null
          currency_code?: string
          enabled_modules?: Json
          id?: string
          is_demo?: boolean
          is_published?: boolean
          name: string
          slug: string
          story_excerpt?: string | null
          tagline?: string | null
          theme_config?: Json
          updated_at?: string
        }
        Update: {
          contact_config?: Json
          created_at?: string
          cuisine_type?: string | null
          currency_code?: string
          enabled_modules?: Json
          id?: string
          is_demo?: boolean
          is_published?: boolean
          name?: string
          slug?: string
          story_excerpt?: string | null
          tagline?: string | null
          theme_config?: Json
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_operational_console_snapshot: {
        Args: { p_restaurant_slug: string }
        Returns: Json
      }
      submit_public_event_inquiry: {
        Args: {
          p_company_name?: string
          p_customer_email?: string
          p_customer_name: string
          p_customer_phone: string
          p_event_package_id?: string
          p_event_space_id?: string
          p_event_type: string
          p_guest_count: number
          p_location_id?: string
          p_preferred_time_slot: string
          p_privacy_accepted: boolean
          p_restaurant_id: string
          p_source_ip_hash?: string
          p_special_requests?: string
          p_tentative_date: string
        }
        Returns: Json
      }
      update_event_inquiry_operational_state: {
        Args: {
          p_inquiry_id: string
          p_internal_notes: string
          p_restaurant_slug: string
          p_status: string
        }
        Returns: Json
      }
      update_product_operational_state: {
        Args: {
          p_availability_status: string
          p_base_price: number
          p_product_id: string
          p_restaurant_slug: string
        }
        Returns: Json
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
