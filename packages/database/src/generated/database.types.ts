export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      academy_roleplay_grades: {
        Row: {
          created_at: string;
          evidence: Json;
          graded_by_staff_id: string | null;
          id: string;
          lesson_key: string;
          retailer_id: string;
          staff_id: string;
        };
        Insert: {
          created_at?: string;
          evidence: Json;
          graded_by_staff_id?: string | null;
          id?: string;
          lesson_key: string;
          retailer_id: string;
          staff_id: string;
        };
        Update: {
          created_at?: string;
          evidence?: Json;
          graded_by_staff_id?: string | null;
          id?: string;
          lesson_key?: string;
          retailer_id?: string;
          staff_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "academy_roleplay_grades_graded_by_staff_id_fkey";
            columns: ["graded_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "academy_roleplay_grades_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "academy_roleplay_grades_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
      advertising_creatives: {
        Row: {
          asset_ref: string;
          created_at: string;
          id: string;
          order_id: string;
          retailer_id: string;
          review_state: string;
          reviewed_by_staff_id: string | null;
          rights_expires_on: string | null;
          updated_at: string;
        };
        Insert: {
          asset_ref: string;
          created_at?: string;
          id?: string;
          order_id: string;
          retailer_id: string;
          review_state?: string;
          reviewed_by_staff_id?: string | null;
          rights_expires_on?: string | null;
          updated_at?: string;
        };
        Update: {
          asset_ref?: string;
          created_at?: string;
          id?: string;
          order_id?: string;
          retailer_id?: string;
          review_state?: string;
          reviewed_by_staff_id?: string | null;
          rights_expires_on?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "advertising_creatives_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "advertising_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "advertising_creatives_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "advertising_creatives_reviewed_by_staff_id_fkey";
            columns: ["reviewed_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
      advertising_events: {
        Row: {
          created_at: string;
          dedupe_key: string;
          fraud_review_state: string;
          id: string;
          kind: string;
          occurred_at: string;
          order_id: string;
          pseudonymous_ref: string;
          retailer_id: string;
          value_minor_units: number | null;
        };
        Insert: {
          created_at?: string;
          dedupe_key: string;
          fraud_review_state?: string;
          id?: string;
          kind: string;
          occurred_at?: string;
          order_id: string;
          pseudonymous_ref: string;
          retailer_id: string;
          value_minor_units?: number | null;
        };
        Update: {
          created_at?: string;
          dedupe_key?: string;
          fraud_review_state?: string;
          id?: string;
          kind?: string;
          occurred_at?: string;
          order_id?: string;
          pseudonymous_ref?: string;
          retailer_id?: string;
          value_minor_units?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "advertising_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "advertising_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "advertising_events_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      advertising_orders: {
        Row: {
          advertiser_key: string;
          budget_minor_units: number;
          cohort_version_id: string;
          created_at: string;
          flight_end: string;
          flight_start: string;
          frequency_cap: number;
          id: string;
          live_serving: boolean;
          retailer_id: string;
          serving_contract_ref: string | null;
          spent_minor_units: number;
          updated_at: string;
        };
        Insert: {
          advertiser_key: string;
          budget_minor_units: number;
          cohort_version_id: string;
          created_at?: string;
          flight_end: string;
          flight_start: string;
          frequency_cap?: number;
          id?: string;
          live_serving?: boolean;
          retailer_id: string;
          serving_contract_ref?: string | null;
          spent_minor_units?: number;
          updated_at?: string;
        };
        Update: {
          advertiser_key?: string;
          budget_minor_units?: number;
          cohort_version_id?: string;
          created_at?: string;
          flight_end?: string;
          flight_start?: string;
          frequency_cap?: number;
          id?: string;
          live_serving?: boolean;
          retailer_id?: string;
          serving_contract_ref?: string | null;
          spent_minor_units?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "advertising_orders_cohort_version_id_fkey";
            columns: ["cohort_version_id"];
            isOneToOne: false;
            referencedRelation: "audience_cohort_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "advertising_orders_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_generations: {
        Row: {
          created_at: string;
          customer_id: string | null;
          error_message: string | null;
          id: string;
          input_summary: string;
          kind: Database["public"]["Enums"]["ai_generation_kind"];
          latency_ms: number | null;
          model: string;
          output: Json | null;
          provider: string;
          requested_by_staff_id: string | null;
          retailer_id: string;
          status: Database["public"]["Enums"]["ai_generation_status"];
        };
        Insert: {
          created_at?: string;
          customer_id?: string | null;
          error_message?: string | null;
          id?: string;
          input_summary: string;
          kind: Database["public"]["Enums"]["ai_generation_kind"];
          latency_ms?: number | null;
          model: string;
          output?: Json | null;
          provider?: string;
          requested_by_staff_id?: string | null;
          retailer_id: string;
          status: Database["public"]["Enums"]["ai_generation_status"];
        };
        Update: {
          created_at?: string;
          customer_id?: string | null;
          error_message?: string | null;
          id?: string;
          input_summary?: string;
          kind?: Database["public"]["Enums"]["ai_generation_kind"];
          latency_ms?: number | null;
          model?: string;
          output?: Json | null;
          provider?: string;
          requested_by_staff_id?: string | null;
          retailer_id?: string;
          status?: Database["public"]["Enums"]["ai_generation_status"];
        };
        Relationships: [
          {
            foreignKeyName: "ai_generations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_generations_requested_by_staff_id_fkey";
            columns: ["requested_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_generations_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      alteration_attachments: {
        Row: {
          alteration_id: string | null;
          created_at: string;
          file_name: string;
          id: string;
          kind: Database["public"]["Enums"]["alteration_attachment_kind"];
          mime_type: string;
          observation_id: string | null;
          physical_garment_id: string | null;
          proposal_id: string | null;
          retailer_id: string;
          size_bytes: number;
          storage_bucket: string;
          storage_path: string;
          task_id: string | null;
          uploaded_by_staff_id: string | null;
        };
        Insert: {
          alteration_id?: string | null;
          created_at?: string;
          file_name: string;
          id?: string;
          kind: Database["public"]["Enums"]["alteration_attachment_kind"];
          mime_type: string;
          observation_id?: string | null;
          physical_garment_id?: string | null;
          proposal_id?: string | null;
          retailer_id: string;
          size_bytes: number;
          storage_bucket: string;
          storage_path: string;
          task_id?: string | null;
          uploaded_by_staff_id?: string | null;
        };
        Update: {
          alteration_id?: string | null;
          created_at?: string;
          file_name?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["alteration_attachment_kind"];
          mime_type?: string;
          observation_id?: string | null;
          physical_garment_id?: string | null;
          proposal_id?: string | null;
          retailer_id?: string;
          size_bytes?: number;
          storage_bucket?: string;
          storage_path?: string;
          task_id?: string | null;
          uploaded_by_staff_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "alteration_attachments_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_attachments_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "customer_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_attachments_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "worker_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_attachments_observation_id_fkey";
            columns: ["observation_id"];
            isOneToOne: false;
            referencedRelation: "fitting_observations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_attachments_physical_garment_id_fkey";
            columns: ["physical_garment_id"];
            isOneToOne: false;
            referencedRelation: "physical_garments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_attachments_proposal_id_fkey";
            columns: ["proposal_id"];
            isOneToOne: false;
            referencedRelation: "price_change_proposals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_attachments_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_attachments_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "alteration_tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_attachments_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "worker_alteration_tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_attachments_uploaded_by_staff_id_fkey";
            columns: ["uploaded_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
      alteration_catalogue_categories: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          description: string;
          display_order: number;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          description?: string;
          display_order?: number;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          description?: string;
          display_order?: number;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      alteration_fulfillment_events: {
        Row: {
          actor_staff_id: string | null;
          alteration_id: string;
          completed_at: string | null;
          created_at: string;
          deleted_at: string | null;
          delivery_address: Json | null;
          id: string;
          method: Database["public"]["Enums"]["alteration_fulfillment_method"];
          released_to_name: string | null;
          retailer_id: string;
          scheduled_at: string | null;
          status: Database["public"]["Enums"]["alteration_fulfillment_status"];
          updated_at: string;
          verification_note: string | null;
        };
        Insert: {
          actor_staff_id?: string | null;
          alteration_id: string;
          completed_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          delivery_address?: Json | null;
          id?: string;
          method: Database["public"]["Enums"]["alteration_fulfillment_method"];
          released_to_name?: string | null;
          retailer_id: string;
          scheduled_at?: string | null;
          status: Database["public"]["Enums"]["alteration_fulfillment_status"];
          updated_at?: string;
          verification_note?: string | null;
        };
        Update: {
          actor_staff_id?: string | null;
          alteration_id?: string;
          completed_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          delivery_address?: Json | null;
          id?: string;
          method?: Database["public"]["Enums"]["alteration_fulfillment_method"];
          released_to_name?: string | null;
          retailer_id?: string;
          scheduled_at?: string | null;
          status?: Database["public"]["Enums"]["alteration_fulfillment_status"];
          updated_at?: string;
          verification_note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "alteration_fulfillment_events_actor_staff_id_fkey";
            columns: ["actor_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_fulfillment_events_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_fulfillment_events_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "customer_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_fulfillment_events_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "worker_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_fulfillment_events_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      alteration_operations: {
        Row: {
          active: boolean;
          category_id: string;
          code: string;
          created_at: string;
          default_duration_minutes: number | null;
          description: string;
          display_order: number;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          category_id: string;
          code: string;
          created_at?: string;
          default_duration_minutes?: number | null;
          description?: string;
          display_order?: number;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          category_id?: string;
          code?: string;
          created_at?: string;
          default_duration_minutes?: number | null;
          description?: string;
          display_order?: number;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alteration_operations_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "alteration_catalogue_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      alteration_price_list_items: {
        Row: {
          amount_minor_units: number;
          created_at: string;
          currency: string;
          id: string;
          operation_id: string;
          price_list_id: string;
          retailer_id: string;
          updated_at: string;
        };
        Insert: {
          amount_minor_units: number;
          created_at?: string;
          currency: string;
          id?: string;
          operation_id: string;
          price_list_id: string;
          retailer_id: string;
          updated_at?: string;
        };
        Update: {
          amount_minor_units?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          operation_id?: string;
          price_list_id?: string;
          retailer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alteration_price_list_items_operation_id_fkey";
            columns: ["operation_id"];
            isOneToOne: false;
            referencedRelation: "alteration_operations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_price_list_items_price_list_id_fkey";
            columns: ["price_list_id"];
            isOneToOne: false;
            referencedRelation: "alteration_price_lists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_price_list_items_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      alteration_price_lists: {
        Row: {
          active: boolean;
          created_at: string;
          currency: string;
          deleted_at: string | null;
          effective_from: string;
          effective_until: string | null;
          id: string;
          kind: Database["public"]["Enums"]["alteration_price_list_kind"];
          name: string;
          retailer_id: string;
          updated_at: string;
          workshop_id: string | null;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          currency: string;
          deleted_at?: string | null;
          effective_from?: string;
          effective_until?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["alteration_price_list_kind"];
          name: string;
          retailer_id: string;
          updated_at?: string;
          workshop_id?: string | null;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          currency?: string;
          deleted_at?: string | null;
          effective_from?: string;
          effective_until?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["alteration_price_list_kind"];
          name?: string;
          retailer_id?: string;
          updated_at?: string;
          workshop_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "alteration_price_lists_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_price_lists_workshop_id_fkey";
            columns: ["workshop_id"];
            isOneToOne: false;
            referencedRelation: "workshops";
            referencedColumns: ["id"];
          },
        ];
      };
      alteration_pricing_history: {
        Row: {
          actor_staff_id: string | null;
          alteration_id: string;
          amount_minor_units: number;
          created_at: string;
          currency: string;
          event_type: string;
          id: string;
          reason: string | null;
          retailer_id: string;
          task_id: string | null;
        };
        Insert: {
          actor_staff_id?: string | null;
          alteration_id: string;
          amount_minor_units: number;
          created_at?: string;
          currency: string;
          event_type: string;
          id?: string;
          reason?: string | null;
          retailer_id: string;
          task_id?: string | null;
        };
        Update: {
          actor_staff_id?: string | null;
          alteration_id?: string;
          amount_minor_units?: number;
          created_at?: string;
          currency?: string;
          event_type?: string;
          id?: string;
          reason?: string | null;
          retailer_id?: string;
          task_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "alteration_pricing_history_actor_staff_id_fkey";
            columns: ["actor_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_pricing_history_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_pricing_history_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "customer_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_pricing_history_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "worker_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_pricing_history_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_pricing_history_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "alteration_tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_pricing_history_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "worker_alteration_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      alteration_status_history: {
        Row: {
          actor_staff_id: string | null;
          actor_user_id: string | null;
          alteration_id: string;
          created_at: string;
          customer_visible: boolean;
          from_status:
            Database["public"]["Enums"]["alteration_work_order_status"] | null;
          id: string;
          note: string | null;
          retailer_id: string;
          to_status: Database["public"]["Enums"]["alteration_work_order_status"];
        };
        Insert: {
          actor_staff_id?: string | null;
          actor_user_id?: string | null;
          alteration_id: string;
          created_at?: string;
          customer_visible?: boolean;
          from_status?:
            Database["public"]["Enums"]["alteration_work_order_status"] | null;
          id?: string;
          note?: string | null;
          retailer_id: string;
          to_status: Database["public"]["Enums"]["alteration_work_order_status"];
        };
        Update: {
          actor_staff_id?: string | null;
          actor_user_id?: string | null;
          alteration_id?: string;
          created_at?: string;
          customer_visible?: boolean;
          from_status?:
            Database["public"]["Enums"]["alteration_work_order_status"] | null;
          id?: string;
          note?: string | null;
          retailer_id?: string;
          to_status?: Database["public"]["Enums"]["alteration_work_order_status"];
        };
        Relationships: [
          {
            foreignKeyName: "alteration_status_history_actor_staff_id_fkey";
            columns: ["actor_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_status_history_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_status_history_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "customer_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_status_history_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "worker_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_status_history_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      alteration_task_notes: {
        Row: {
          actor_staff_id: string | null;
          alteration_id: string;
          created_at: string;
          id: string;
          note: string;
          retailer_id: string;
          task_id: string;
        };
        Insert: {
          actor_staff_id?: string | null;
          alteration_id: string;
          created_at?: string;
          id?: string;
          note: string;
          retailer_id: string;
          task_id: string;
        };
        Update: {
          actor_staff_id?: string | null;
          alteration_id?: string;
          created_at?: string;
          id?: string;
          note?: string;
          retailer_id?: string;
          task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alteration_task_notes_actor_staff_id_fkey";
            columns: ["actor_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_task_notes_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_task_notes_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "customer_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_task_notes_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "worker_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_task_notes_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_task_notes_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "alteration_tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_task_notes_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "worker_alteration_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      alteration_tasks: {
        Row: {
          agreed_price_amount_minor_units: number | null;
          agreed_price_currency: string | null;
          alteration_id: string;
          assigned_worker_id: string | null;
          classification: Database["public"]["Enums"]["work_classification"];
          created_at: string;
          deleted_at: string | null;
          id: string;
          instructions: string | null;
          operation_id: string | null;
          original_quote_amount_minor_units: number;
          original_quote_currency: string;
          retailer_id: string;
          status: Database["public"]["Enums"]["alteration_task_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          agreed_price_amount_minor_units?: number | null;
          agreed_price_currency?: string | null;
          alteration_id: string;
          assigned_worker_id?: string | null;
          classification: Database["public"]["Enums"]["work_classification"];
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          instructions?: string | null;
          operation_id?: string | null;
          original_quote_amount_minor_units?: number;
          original_quote_currency: string;
          retailer_id: string;
          status?: Database["public"]["Enums"]["alteration_task_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          agreed_price_amount_minor_units?: number | null;
          agreed_price_currency?: string | null;
          alteration_id?: string;
          assigned_worker_id?: string | null;
          classification?: Database["public"]["Enums"]["work_classification"];
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          instructions?: string | null;
          operation_id?: string | null;
          original_quote_amount_minor_units?: number;
          original_quote_currency?: string;
          retailer_id?: string;
          status?: Database["public"]["Enums"]["alteration_task_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alteration_tasks_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_tasks_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "customer_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_tasks_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "worker_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_tasks_assigned_worker_id_fkey";
            columns: ["assigned_worker_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_tasks_operation_id_fkey";
            columns: ["operation_id"];
            isOneToOne: false;
            referencedRelation: "alteration_operations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_tasks_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      alteration_work_orders: {
        Row: {
          agreed_total_amount_minor_units: number | null;
          agreed_total_currency: string | null;
          canceled_at: string | null;
          cancellation_reason: string | null;
          created_at: string;
          customer_id: string;
          customer_notification_ready_at: string | null;
          customer_notified_at: string | null;
          deleted_at: string | null;
          due_date: string | null;
          fitting_session_id: string | null;
          id: string;
          original_quote_amount_minor_units: number;
          original_quote_currency: string;
          physical_garment_id: string;
          retailer_id: string;
          status: Database["public"]["Enums"]["alteration_work_order_status"];
          updated_at: string;
          work_order_number: string;
        };
        Insert: {
          agreed_total_amount_minor_units?: number | null;
          agreed_total_currency?: string | null;
          canceled_at?: string | null;
          cancellation_reason?: string | null;
          created_at?: string;
          customer_id: string;
          customer_notification_ready_at?: string | null;
          customer_notified_at?: string | null;
          deleted_at?: string | null;
          due_date?: string | null;
          fitting_session_id?: string | null;
          id?: string;
          original_quote_amount_minor_units?: number;
          original_quote_currency: string;
          physical_garment_id: string;
          retailer_id: string;
          status?: Database["public"]["Enums"]["alteration_work_order_status"];
          updated_at?: string;
          work_order_number?: string;
        };
        Update: {
          agreed_total_amount_minor_units?: number | null;
          agreed_total_currency?: string | null;
          canceled_at?: string | null;
          cancellation_reason?: string | null;
          created_at?: string;
          customer_id?: string;
          customer_notification_ready_at?: string | null;
          customer_notified_at?: string | null;
          deleted_at?: string | null;
          due_date?: string | null;
          fitting_session_id?: string | null;
          id?: string;
          original_quote_amount_minor_units?: number;
          original_quote_currency?: string;
          physical_garment_id?: string;
          retailer_id?: string;
          status?: Database["public"]["Enums"]["alteration_work_order_status"];
          updated_at?: string;
          work_order_number?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alteration_work_orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_work_orders_fitting_session_id_fkey";
            columns: ["fitting_session_id"];
            isOneToOne: false;
            referencedRelation: "fitting_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_work_orders_physical_garment_id_fkey";
            columns: ["physical_garment_id"];
            isOneToOne: false;
            referencedRelation: "physical_garments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_work_orders_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      appointment_closeouts: {
        Row: {
          appointment_id: string;
          created_at: string;
          customer_id: string;
          follow_up_date: string | null;
          freeform_note: string | null;
          id: string;
          next_step: string | null;
          retailer_id: string;
          staff_id: string;
        };
        Insert: {
          appointment_id: string;
          created_at?: string;
          customer_id: string;
          follow_up_date?: string | null;
          freeform_note?: string | null;
          id?: string;
          next_step?: string | null;
          retailer_id: string;
          staff_id: string;
        };
        Update: {
          appointment_id?: string;
          created_at?: string;
          customer_id?: string;
          follow_up_date?: string | null;
          freeform_note?: string | null;
          id?: string;
          next_step?: string | null;
          retailer_id?: string;
          staff_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointment_closeouts_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: true;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_closeouts_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_closeouts_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_closeouts_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
      appointments: {
        Row: {
          branch_id: string | null;
          created_at: string;
          customer_id: string;
          deleted_at: string | null;
          ends_at: string;
          id: string;
          location_id: string | null;
          notes: string | null;
          retailer_id: string;
          staff_id: string | null;
          starts_at: string;
          status: Database["public"]["Enums"]["appointment_status"];
          type: Database["public"]["Enums"]["appointment_type"];
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          customer_id: string;
          deleted_at?: string | null;
          ends_at: string;
          id?: string;
          location_id?: string | null;
          notes?: string | null;
          retailer_id: string;
          staff_id?: string | null;
          starts_at: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          type: Database["public"]["Enums"]["appointment_type"];
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          customer_id?: string;
          deleted_at?: string | null;
          ends_at?: string;
          id?: string;
          location_id?: string | null;
          notes?: string | null;
          retailer_id?: string;
          staff_id?: string | null;
          starts_at?: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          type?: Database["public"]["Enums"]["appointment_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "retailer_branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
      audience_cohort_versions: {
        Row: {
          cohort_key: string;
          computed_at: string;
          created_at: string;
          id: string;
          retailer_id: string;
          rule_hash: string;
          size_at_version: number;
          version: number;
        };
        Insert: {
          cohort_key: string;
          computed_at?: string;
          created_at?: string;
          id?: string;
          retailer_id: string;
          rule_hash: string;
          size_at_version: number;
          version: number;
        };
        Update: {
          cohort_key?: string;
          computed_at?: string;
          created_at?: string;
          id?: string;
          retailer_id?: string;
          rule_hash?: string;
          size_at_version?: number;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "audience_cohort_versions_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      audience_forecasts: {
        Row: {
          cohort_version_id: string;
          computed_at: string;
          created_at: string;
          id: string;
          policy_ref: string;
          reachable_size: number;
          retailer_id: string;
        };
        Insert: {
          cohort_version_id: string;
          computed_at?: string;
          created_at?: string;
          id?: string;
          policy_ref: string;
          reachable_size: number;
          retailer_id: string;
        };
        Update: {
          cohort_version_id?: string;
          computed_at?: string;
          created_at?: string;
          id?: string;
          policy_ref?: string;
          reachable_size?: number;
          retailer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audience_forecasts_cohort_version_id_fkey";
            columns: ["cohort_version_id"];
            isOneToOne: false;
            referencedRelation: "audience_cohort_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audience_forecasts_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log_entries: {
        Row: {
          action: string;
          actor_staff_id: string | null;
          actor_user_id: string | null;
          after_state: Json | null;
          before_state: Json | null;
          entity_id: string;
          entity_type: string;
          id: string;
          occurred_at: string;
          retailer_id: string | null;
        };
        Insert: {
          action: string;
          actor_staff_id?: string | null;
          actor_user_id?: string | null;
          after_state?: Json | null;
          before_state?: Json | null;
          entity_id: string;
          entity_type: string;
          id?: string;
          occurred_at?: string;
          retailer_id?: string | null;
        };
        Update: {
          action?: string;
          actor_staff_id?: string | null;
          actor_user_id?: string | null;
          after_state?: Json | null;
          before_state?: Json | null;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          occurred_at?: string;
          retailer_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_entries_actor_staff_id_fkey";
            columns: ["actor_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_log_entries_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      availability_windows: {
        Row: {
          created_at: string;
          day_of_week: number;
          end_time: string;
          id: string;
          retailer_id: string;
          staff_id: string;
          start_time: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          day_of_week: number;
          end_time: string;
          id?: string;
          retailer_id: string;
          staff_id: string;
          start_time: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          day_of_week?: number;
          end_time?: string;
          id?: string;
          retailer_id?: string;
          staff_id?: string;
          start_time?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "availability_windows_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "availability_windows_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
      behavioral_events: {
        Row: {
          anonymized_at: string | null;
          anonymous_session_id: string | null;
          consent_basis: string;
          consent_snapshot: Json;
          correlation_id: string | null;
          created_at: string;
          customer_id: string | null;
          device_class: string | null;
          id: string;
          idempotency_key: string | null;
          name: string;
          occurred_at: string;
          page_path: string | null;
          properties: Json;
          purpose: string;
          received_at: string | null;
          retailer_id: string;
          retention_class: string;
          retention_expires_at: string;
          session_id: string | null;
          source: string;
        };
        Insert: {
          anonymized_at?: string | null;
          anonymous_session_id?: string | null;
          consent_basis?: string;
          consent_snapshot?: Json;
          correlation_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          device_class?: string | null;
          id?: string;
          idempotency_key?: string | null;
          name: string;
          occurred_at?: string;
          page_path?: string | null;
          properties?: Json;
          purpose?: string;
          received_at?: string | null;
          retailer_id: string;
          retention_class?: string;
          retention_expires_at?: string;
          session_id?: string | null;
          source: string;
        };
        Update: {
          anonymized_at?: string | null;
          anonymous_session_id?: string | null;
          consent_basis?: string;
          consent_snapshot?: Json;
          correlation_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          device_class?: string | null;
          id?: string;
          idempotency_key?: string | null;
          name?: string;
          occurred_at?: string;
          page_path?: string | null;
          properties?: Json;
          purpose?: string;
          received_at?: string | null;
          retailer_id?: string;
          retention_class?: string;
          retention_expires_at?: string;
          session_id?: string | null;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: "behavioral_events_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "behavioral_events_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "behavioral_events_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "interaction_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_audience_rules: {
        Row: {
          active: boolean;
          campaign_id: string;
          concept_id: string | null;
          created_at: string;
          explanation: string;
          id: string;
          loyalty_tier: string | null;
          product_id: string | null;
          require_personalization_consent: boolean;
          retailer_id: string;
          rule_kind: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          campaign_id: string;
          concept_id?: string | null;
          created_at?: string;
          explanation: string;
          id?: string;
          loyalty_tier?: string | null;
          product_id?: string | null;
          require_personalization_consent?: boolean;
          retailer_id: string;
          rule_kind: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          campaign_id?: string;
          concept_id?: string | null;
          created_at?: string;
          explanation?: string;
          id?: string;
          loyalty_tier?: string | null;
          product_id?: string | null;
          require_personalization_consent?: boolean;
          retailer_id?: string;
          rule_kind?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_audience_rules_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_audience_rules_campaign_retailer_fk";
            columns: ["campaign_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "campaign_audience_rules_concept_id_fkey";
            columns: ["concept_id"];
            isOneToOne: false;
            referencedRelation: "metadata_concepts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_audience_rules_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_audience_rules_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_challenge_enrollments: {
        Row: {
          campaign_id: string;
          completed_at: string | null;
          created_at: string;
          customer_id: string;
          id: string;
          retailer_id: string;
          started_at: string;
          status: string;
          updated_at: string;
          withdrawn_at: string | null;
        };
        Insert: {
          campaign_id: string;
          completed_at?: string | null;
          created_at?: string;
          customer_id: string;
          id?: string;
          retailer_id: string;
          started_at?: string;
          status?: string;
          updated_at?: string;
          withdrawn_at?: string | null;
        };
        Update: {
          campaign_id?: string;
          completed_at?: string | null;
          created_at?: string;
          customer_id?: string;
          id?: string;
          retailer_id?: string;
          started_at?: string;
          status?: string;
          updated_at?: string;
          withdrawn_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_challenge_enrollments_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_challenge_enrollments_campaign_retailer_fk";
            columns: ["campaign_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "campaign_challenge_enrollments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_challenge_enrollments_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "campaign_challenge_enrollments_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_challenge_look_slots: {
        Row: {
          created_at: string;
          display_order: number;
          id: string;
          look_id: string;
          product_id: string | null;
          retailer_id: string;
          slot_kind: string;
          source: string | null;
          wardrobe_item_id: string | null;
        };
        Insert: {
          created_at?: string;
          display_order?: number;
          id?: string;
          look_id: string;
          product_id?: string | null;
          retailer_id: string;
          slot_kind: string;
          source?: string | null;
          wardrobe_item_id?: string | null;
        };
        Update: {
          created_at?: string;
          display_order?: number;
          id?: string;
          look_id?: string;
          product_id?: string | null;
          retailer_id?: string;
          slot_kind?: string;
          source?: string | null;
          wardrobe_item_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_challenge_look_slots_look_id_fkey";
            columns: ["look_id"];
            isOneToOne: false;
            referencedRelation: "campaign_challenge_looks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_challenge_look_slots_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_challenge_look_slots_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_challenge_look_slots_wardrobe_item_id_fkey";
            columns: ["wardrobe_item_id"];
            isOneToOne: false;
            referencedRelation: "wardrobe_items";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_challenge_looks: {
        Row: {
          created_at: string;
          customer_id: string;
          day_index: number;
          enrollment_id: string;
          id: string;
          retailer_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          day_index: number;
          enrollment_id: string;
          id?: string;
          retailer_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          day_index?: number;
          enrollment_id?: string;
          id?: string;
          retailer_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_challenge_looks_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_challenge_looks_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "campaign_challenge_looks_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "campaign_challenge_enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_challenge_looks_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_completions: {
        Row: {
          campaign_id: string;
          completed_at: string;
          customer_id: string;
          enrollment_id: string;
          id: string;
          retailer_id: string;
          reward_grant_id: string | null;
        };
        Insert: {
          campaign_id: string;
          completed_at?: string;
          customer_id: string;
          enrollment_id: string;
          id?: string;
          retailer_id: string;
          reward_grant_id?: string | null;
        };
        Update: {
          campaign_id?: string;
          completed_at?: string;
          customer_id?: string;
          enrollment_id?: string;
          id?: string;
          retailer_id?: string;
          reward_grant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_completions_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_completions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_completions_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "campaign_completions_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: true;
            referencedRelation: "campaign_challenge_enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_completions_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_completions_reward_grant_id_fkey";
            columns: ["reward_grant_id"];
            isOneToOne: false;
            referencedRelation: "campaign_reward_grants";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_delivery_audits: {
        Row: {
          campaign_id: string;
          created_at: string;
          customer_id: string;
          explanation: string | null;
          for_date: string;
          id: string;
          notification_id: string | null;
          outcome: string;
          personalization_consent: string | null;
          retailer_id: string;
          scheduled_for: string;
          suppression_reason: string | null;
        };
        Insert: {
          campaign_id: string;
          created_at?: string;
          customer_id: string;
          explanation?: string | null;
          for_date: string;
          id?: string;
          notification_id?: string | null;
          outcome: string;
          personalization_consent?: string | null;
          retailer_id: string;
          scheduled_for: string;
          suppression_reason?: string | null;
        };
        Update: {
          campaign_id?: string;
          created_at?: string;
          customer_id?: string;
          explanation?: string | null;
          for_date?: string;
          id?: string;
          notification_id?: string | null;
          outcome?: string;
          personalization_consent?: string | null;
          retailer_id?: string;
          scheduled_for?: string;
          suppression_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_delivery_audits_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_delivery_audits_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_delivery_audits_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "campaign_delivery_audits_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_delivery_audits_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_library_entries: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          key: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          id?: string;
          key: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          key?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      campaign_library_versions: {
        Row: {
          activated_at: string | null;
          created_at: string;
          entry_id: string;
          id: string;
          snapshot: Json;
          status: string;
          updated_at: string;
          version_number: number;
        };
        Insert: {
          activated_at?: string | null;
          created_at?: string;
          entry_id: string;
          id?: string;
          snapshot: Json;
          status: string;
          updated_at?: string;
          version_number: number;
        };
        Update: {
          activated_at?: string | null;
          created_at?: string;
          entry_id?: string;
          id?: string;
          snapshot?: Json;
          status?: string;
          updated_at?: string;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_library_versions_entry_id_fkey";
            columns: ["entry_id"];
            isOneToOne: false;
            referencedRelation: "campaign_library_entries";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_reward_grants: {
        Row: {
          campaign_id: string;
          created_at: string;
          customer_id: string;
          enrollment_id: string;
          expires_at: string | null;
          id: string;
          label: string;
          loyalty_ledger_entry_id: string | null;
          retailer_id: string;
          reward_kind: string;
        };
        Insert: {
          campaign_id: string;
          created_at?: string;
          customer_id: string;
          enrollment_id: string;
          expires_at?: string | null;
          id?: string;
          label: string;
          loyalty_ledger_entry_id?: string | null;
          retailer_id: string;
          reward_kind: string;
        };
        Update: {
          campaign_id?: string;
          created_at?: string;
          customer_id?: string;
          enrollment_id?: string;
          expires_at?: string | null;
          id?: string;
          label?: string;
          loyalty_ledger_entry_id?: string | null;
          retailer_id?: string;
          reward_kind?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_reward_grants_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_reward_grants_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_reward_grants_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "campaign_reward_grants_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: true;
            referencedRelation: "campaign_challenge_enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_reward_grants_loyalty_ledger_entry_id_fkey";
            columns: ["loyalty_ledger_entry_id"];
            isOneToOne: false;
            referencedRelation: "loyalty_ledger_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_reward_grants_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_target_products: {
        Row: {
          active: boolean;
          campaign_id: string;
          created_at: string;
          product_id: string;
          retailer_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          campaign_id: string;
          created_at?: string;
          product_id: string;
          retailer_id: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          campaign_id?: string;
          created_at?: string;
          product_id?: string;
          retailer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_target_products_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_target_products_campaign_retailer_fk";
            columns: ["campaign_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "campaign_target_products_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_target_products_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      campaigns: {
        Row: {
          created_at: string;
          created_by_staff_id: string | null;
          ends_at: string | null;
          explanation: string;
          frequency: string;
          id: string;
          kind: string;
          last_activated_at: string | null;
          last_activation_missions_created: number | null;
          last_rehearsal_report: Json | null;
          last_rehearsed_at: string | null;
          library_entry_id: string | null;
          library_pinned_at: string | null;
          library_version_id: string | null;
          preferred_local_hour: number;
          quiet_end_minute: number | null;
          quiet_start_minute: number | null;
          retailer_id: string;
          reward_cap_per_customer: number;
          reward_kind: string | null;
          reward_label: string | null;
          short_lived_offer_hours: number;
          starts_at: string | null;
          status: string;
          summary: string;
          timezone: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by_staff_id?: string | null;
          ends_at?: string | null;
          explanation: string;
          frequency?: string;
          id?: string;
          kind: string;
          last_activated_at?: string | null;
          last_activation_missions_created?: number | null;
          last_rehearsal_report?: Json | null;
          last_rehearsed_at?: string | null;
          library_entry_id?: string | null;
          library_pinned_at?: string | null;
          library_version_id?: string | null;
          preferred_local_hour?: number;
          quiet_end_minute?: number | null;
          quiet_start_minute?: number | null;
          retailer_id: string;
          reward_cap_per_customer?: number;
          reward_kind?: string | null;
          reward_label?: string | null;
          short_lived_offer_hours?: number;
          starts_at?: string | null;
          status?: string;
          summary: string;
          timezone?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by_staff_id?: string | null;
          ends_at?: string | null;
          explanation?: string;
          frequency?: string;
          id?: string;
          kind?: string;
          last_activated_at?: string | null;
          last_activation_missions_created?: number | null;
          last_rehearsal_report?: Json | null;
          last_rehearsed_at?: string | null;
          library_entry_id?: string | null;
          library_pinned_at?: string | null;
          library_version_id?: string | null;
          preferred_local_hour?: number;
          quiet_end_minute?: number | null;
          quiet_start_minute?: number | null;
          retailer_id?: string;
          reward_cap_per_customer?: number;
          reward_kind?: string | null;
          reward_label?: string | null;
          short_lived_offer_hours?: number;
          starts_at?: string | null;
          status?: string;
          summary?: string;
          timezone?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_staff_id_fkey";
            columns: ["created_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaigns_library_entry_id_fkey";
            columns: ["library_entry_id"];
            isOneToOne: false;
            referencedRelation: "campaign_library_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaigns_library_version_id_fkey";
            columns: ["library_version_id"];
            isOneToOne: false;
            referencedRelation: "campaign_library_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaigns_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      catalogue_import_rows: {
        Row: {
          created_at: string;
          external_sku: string | null;
          id: string;
          import_id: string;
          last_publish_attempt_at: string | null;
          proposed_product: Json | null;
          publish_error: string | null;
          published_at: string | null;
          published_by_staff_id: string | null;
          published_product_id: string | null;
          published_variant_id: string | null;
          raw_payload: Json;
          retailer_id: string;
          row_number: number;
          status: Database["public"]["Enums"]["catalogue_import_row_status"];
          updated_at: string;
          validation_errors: Json;
        };
        Insert: {
          created_at?: string;
          external_sku?: string | null;
          id?: string;
          import_id: string;
          last_publish_attempt_at?: string | null;
          proposed_product?: Json | null;
          publish_error?: string | null;
          published_at?: string | null;
          published_by_staff_id?: string | null;
          published_product_id?: string | null;
          published_variant_id?: string | null;
          raw_payload?: Json;
          retailer_id: string;
          row_number: number;
          status?: Database["public"]["Enums"]["catalogue_import_row_status"];
          updated_at?: string;
          validation_errors?: Json;
        };
        Update: {
          created_at?: string;
          external_sku?: string | null;
          id?: string;
          import_id?: string;
          last_publish_attempt_at?: string | null;
          proposed_product?: Json | null;
          publish_error?: string | null;
          published_at?: string | null;
          published_by_staff_id?: string | null;
          published_product_id?: string | null;
          published_variant_id?: string | null;
          raw_payload?: Json;
          retailer_id?: string;
          row_number?: number;
          status?: Database["public"]["Enums"]["catalogue_import_row_status"];
          updated_at?: string;
          validation_errors?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "catalogue_import_rows_import_id_fkey";
            columns: ["import_id"];
            isOneToOne: false;
            referencedRelation: "catalogue_imports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalogue_import_rows_published_by_staff_id_fkey";
            columns: ["published_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalogue_import_rows_published_product_id_fkey";
            columns: ["published_product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalogue_import_rows_published_variant_id_fkey";
            columns: ["published_variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalogue_import_rows_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      catalogue_imports: {
        Row: {
          completed_at: string | null;
          contract_version: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          retailer_id: string;
          row_count: number;
          source_filename: string;
          source_type: Database["public"]["Enums"]["catalogue_import_source_type"];
          status: Database["public"]["Enums"]["catalogue_import_status"];
          updated_at: string;
          uploaded_by_staff_id: string;
        };
        Insert: {
          completed_at?: string | null;
          contract_version?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          retailer_id: string;
          row_count?: number;
          source_filename: string;
          source_type: Database["public"]["Enums"]["catalogue_import_source_type"];
          status?: Database["public"]["Enums"]["catalogue_import_status"];
          updated_at?: string;
          uploaded_by_staff_id: string;
        };
        Update: {
          completed_at?: string | null;
          contract_version?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          retailer_id?: string;
          row_count?: number;
          source_filename?: string;
          source_type?: Database["public"]["Enums"]["catalogue_import_source_type"];
          status?: Database["public"]["Enums"]["catalogue_import_status"];
          updated_at?: string;
          uploaded_by_staff_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "catalogue_imports_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalogue_imports_uploaded_by_staff_id_fkey";
            columns: ["uploaded_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
      chain_of_custody_events: {
        Row: {
          actor_staff_id: string | null;
          alteration_id: string;
          condition_note: string | null;
          event_type: Database["public"]["Enums"]["custody_event_type"];
          from_party: string | null;
          id: string;
          occurred_at: string;
          retailer_id: string;
          to_party: string | null;
        };
        Insert: {
          actor_staff_id?: string | null;
          alteration_id: string;
          condition_note?: string | null;
          event_type: Database["public"]["Enums"]["custody_event_type"];
          from_party?: string | null;
          id?: string;
          occurred_at?: string;
          retailer_id: string;
          to_party?: string | null;
        };
        Update: {
          actor_staff_id?: string | null;
          alteration_id?: string;
          condition_note?: string | null;
          event_type?: Database["public"]["Enums"]["custody_event_type"];
          from_party?: string | null;
          id?: string;
          occurred_at?: string;
          retailer_id?: string;
          to_party?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "chain_of_custody_events_actor_staff_id_fkey";
            columns: ["actor_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chain_of_custody_events_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chain_of_custody_events_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "customer_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chain_of_custody_events_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "worker_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chain_of_custody_events_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      cited_recommendations: {
        Row: {
          confidence: string;
          created_at: string;
          derived_from_fact_ids: string[];
          id: string;
          kind: string;
          retailer_id: string;
          sample_size: number;
          sources: Json;
          statement: string;
          updated_at: string;
          window_from: string;
          window_to: string;
          withdrawn_at: string | null;
          withdrawn_reason: string | null;
        };
        Insert: {
          confidence: string;
          created_at?: string;
          derived_from_fact_ids?: string[];
          id?: string;
          kind: string;
          retailer_id: string;
          sample_size: number;
          sources: Json;
          statement: string;
          updated_at?: string;
          window_from: string;
          window_to: string;
          withdrawn_at?: string | null;
          withdrawn_reason?: string | null;
        };
        Update: {
          confidence?: string;
          created_at?: string;
          derived_from_fact_ids?: string[];
          id?: string;
          kind?: string;
          retailer_id?: string;
          sample_size?: number;
          sources?: Json;
          statement?: string;
          updated_at?: string;
          window_from?: string;
          window_to?: string;
          withdrawn_at?: string | null;
          withdrawn_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cited_recommendations_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      clienteling_notes: {
        Row: {
          author_staff_id: string;
          body: string;
          created_at: string;
          customer_id: string;
          deleted_at: string | null;
          id: string;
          pinned: boolean;
          retailer_id: string;
          updated_at: string;
        };
        Insert: {
          author_staff_id: string;
          body: string;
          created_at?: string;
          customer_id: string;
          deleted_at?: string | null;
          id?: string;
          pinned?: boolean;
          retailer_id: string;
          updated_at?: string;
        };
        Update: {
          author_staff_id?: string;
          body?: string;
          created_at?: string;
          customer_id?: string;
          deleted_at?: string | null;
          id?: string;
          pinned?: boolean;
          retailer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clienteling_notes_author_staff_id_fkey";
            columns: ["author_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clienteling_notes_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clienteling_notes_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      clienteling_opportunities: {
        Row: {
          assigned_staff_id: string | null;
          best_time_window: string | null;
          branch_label: string | null;
          campaign_id: string | null;
          channel: string;
          confidence: number;
          contact_pressure: boolean;
          cooldown_until: string | null;
          created_at: string;
          customer_id: string;
          deleted_at: string | null;
          due_at: string | null;
          evidence: Json;
          expires_at: string | null;
          id: string;
          opportunity_type: string;
          outcome_appointment_id: string | null;
          outcome_message_id: string | null;
          outcome_order_id: string | null;
          priority: number;
          projector_version: string;
          retailer_id: string;
          status: string;
          suggested_action: string;
          updated_at: string;
          why_now: string;
        };
        Insert: {
          assigned_staff_id?: string | null;
          best_time_window?: string | null;
          branch_label?: string | null;
          campaign_id?: string | null;
          channel: string;
          confidence?: number;
          contact_pressure?: boolean;
          cooldown_until?: string | null;
          created_at?: string;
          customer_id: string;
          deleted_at?: string | null;
          due_at?: string | null;
          evidence?: Json;
          expires_at?: string | null;
          id?: string;
          opportunity_type: string;
          outcome_appointment_id?: string | null;
          outcome_message_id?: string | null;
          outcome_order_id?: string | null;
          priority?: number;
          projector_version: string;
          retailer_id: string;
          status?: string;
          suggested_action: string;
          updated_at?: string;
          why_now: string;
        };
        Update: {
          assigned_staff_id?: string | null;
          best_time_window?: string | null;
          branch_label?: string | null;
          campaign_id?: string | null;
          channel?: string;
          confidence?: number;
          contact_pressure?: boolean;
          cooldown_until?: string | null;
          created_at?: string;
          customer_id?: string;
          deleted_at?: string | null;
          due_at?: string | null;
          evidence?: Json;
          expires_at?: string | null;
          id?: string;
          opportunity_type?: string;
          outcome_appointment_id?: string | null;
          outcome_message_id?: string | null;
          outcome_order_id?: string | null;
          priority?: number;
          projector_version?: string;
          retailer_id?: string;
          status?: string;
          suggested_action?: string;
          updated_at?: string;
          why_now?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clienteling_opportunities_assigned_staff_id_fkey";
            columns: ["assigned_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clienteling_opportunities_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clienteling_opportunities_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clienteling_opportunities_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      collections: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          name: string;
          retailer_id: string;
          season: string | null;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          retailer_id: string;
          season?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          retailer_id?: string;
          season?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "collections_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      commercial_features: {
        Row: {
          category: string;
          created_at: string;
          description: string;
          display_order: number;
          key: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          description?: string;
          display_order?: number;
          key: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string;
          display_order?: number;
          key?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      commercial_inquiries: {
        Row: {
          company_name: string;
          contact_name: string;
          created_at: string;
          email: string;
          id: string;
          inquiry_type: Database["public"]["Enums"]["commercial_inquiry_type"];
          objective: string;
          requested_plan_key: string | null;
          source: string;
          status: string;
          updated_at: string;
          website_url: string | null;
        };
        Insert: {
          company_name: string;
          contact_name: string;
          created_at?: string;
          email: string;
          id?: string;
          inquiry_type: Database["public"]["Enums"]["commercial_inquiry_type"];
          objective: string;
          requested_plan_key?: string | null;
          source?: string;
          status?: string;
          updated_at?: string;
          website_url?: string | null;
        };
        Update: {
          company_name?: string;
          contact_name?: string;
          created_at?: string;
          email?: string;
          id?: string;
          inquiry_type?: Database["public"]["Enums"]["commercial_inquiry_type"];
          objective?: string;
          requested_plan_key?: string | null;
          source?: string;
          status?: string;
          updated_at?: string;
          website_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "commercial_inquiries_requested_plan_key_fkey";
            columns: ["requested_plan_key"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["key"];
          },
        ];
      };
      commercial_prospects: {
        Row: {
          company_name: string;
          created_at: string;
          created_by_user_id: string | null;
          deleted_at: string | null;
          id: string;
          next_action: string | null;
          next_action_due_at: string | null;
          observed_opportunities: string[];
          primary_contact_email: string;
          primary_contact_name: string;
          primary_contact_phone: string | null;
          recommended_plan_id: string | null;
          sales_notes: string;
          source: string;
          stage: Database["public"]["Enums"]["commercial_prospect_stage"];
          updated_at: string;
          website_url: string | null;
        };
        Insert: {
          company_name: string;
          created_at?: string;
          created_by_user_id?: string | null;
          deleted_at?: string | null;
          id?: string;
          next_action?: string | null;
          next_action_due_at?: string | null;
          observed_opportunities?: string[];
          primary_contact_email: string;
          primary_contact_name: string;
          primary_contact_phone?: string | null;
          recommended_plan_id?: string | null;
          sales_notes?: string;
          source?: string;
          stage?: Database["public"]["Enums"]["commercial_prospect_stage"];
          updated_at?: string;
          website_url?: string | null;
        };
        Update: {
          company_name?: string;
          created_at?: string;
          created_by_user_id?: string | null;
          deleted_at?: string | null;
          id?: string;
          next_action?: string | null;
          next_action_due_at?: string | null;
          observed_opportunities?: string[];
          primary_contact_email?: string;
          primary_contact_name?: string;
          primary_contact_phone?: string | null;
          recommended_plan_id?: string | null;
          sales_notes?: string;
          source?: string;
          stage?: Database["public"]["Enums"]["commercial_prospect_stage"];
          updated_at?: string;
          website_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "commercial_prospects_recommended_plan_id_fkey";
            columns: ["recommended_plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      completion_reviews: {
        Row: {
          alteration_id: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          notes: string | null;
          retailer_id: string;
          reviewed_at: string | null;
          reviewed_by_staff_id: string | null;
          status: Database["public"]["Enums"]["completion_review_status"];
          updated_at: string;
        };
        Insert: {
          alteration_id: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          notes?: string | null;
          retailer_id: string;
          reviewed_at?: string | null;
          reviewed_by_staff_id?: string | null;
          status?: Database["public"]["Enums"]["completion_review_status"];
          updated_at?: string;
        };
        Update: {
          alteration_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          notes?: string | null;
          retailer_id?: string;
          reviewed_at?: string | null;
          reviewed_by_staff_id?: string | null;
          status?: Database["public"]["Enums"]["completion_review_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "completion_reviews_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "completion_reviews_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "customer_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "completion_reviews_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "worker_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "completion_reviews_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "completion_reviews_reviewed_by_staff_id_fkey";
            columns: ["reviewed_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
      consultancy_deliverables: {
        Row: {
          created_at: string;
          delivered_at: string | null;
          id: string;
          project_id: string;
          retailer_id: string;
          retailer_visible: boolean;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          delivered_at?: string | null;
          id?: string;
          project_id: string;
          retailer_id: string;
          retailer_visible?: boolean;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          delivered_at?: string | null;
          id?: string;
          project_id?: string;
          retailer_id?: string;
          retailer_visible?: boolean;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consultancy_deliverables_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "consultancy_projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consultancy_deliverables_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      consultancy_projects: {
        Row: {
          created_at: string;
          id: string;
          retailer_approved_at: string | null;
          retailer_id: string;
          state: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          retailer_approved_at?: string | null;
          retailer_id: string;
          state?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          retailer_approved_at?: string | null;
          retailer_id?: string;
          state?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consultancy_projects_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          created_at: string;
          customer_id: string;
          deleted_at: string | null;
          id: string;
          intent: string | null;
          last_message_at: string | null;
          outcome_appointment_id: string | null;
          outcome_order_id: string | null;
          outcome_recorded_at: string | null;
          retailer_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          deleted_at?: string | null;
          id?: string;
          intent?: string | null;
          last_message_at?: string | null;
          outcome_appointment_id?: string | null;
          outcome_order_id?: string | null;
          outcome_recorded_at?: string | null;
          retailer_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          deleted_at?: string | null;
          id?: string;
          intent?: string | null;
          last_message_at?: string | null;
          outcome_appointment_id?: string | null;
          outcome_order_id?: string | null;
          outcome_recorded_at?: string | null;
          retailer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_outcome_appointment_id_fkey";
            columns: ["outcome_appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_outcome_order_id_fkey";
            columns: ["outcome_order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      corporate_accounts: {
        Row: {
          account_reference: string;
          active: boolean;
          created_at: string;
          deleted_at: string | null;
          id: string;
          legal_name: string;
          retailer_id: string;
          updated_at: string;
        };
        Insert: {
          account_reference: string;
          active?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          legal_name: string;
          retailer_id: string;
          updated_at?: string;
        };
        Update: {
          account_reference?: string;
          active?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          legal_name?: string;
          retailer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "corporate_accounts_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      corporate_entitlement_versions: {
        Row: {
          created_at: string;
          effective_from: string;
          id: string;
          programme_id: string;
          retailer_id: string;
          rules: Json;
          version: number;
        };
        Insert: {
          created_at?: string;
          effective_from: string;
          id?: string;
          programme_id: string;
          retailer_id: string;
          rules: Json;
          version: number;
        };
        Update: {
          created_at?: string;
          effective_from?: string;
          id?: string;
          programme_id?: string;
          retailer_id?: string;
          rules?: Json;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "corporate_entitlement_versions_programme_id_fkey";
            columns: ["programme_id"];
            isOneToOne: false;
            referencedRelation: "corporate_programmes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "corporate_entitlement_versions_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      corporate_exceptions: {
        Row: {
          action: string | null;
          created_at: string;
          detail: string;
          garment_key: string | null;
          id: string;
          kind: string;
          programme_id: string;
          quantity: number | null;
          resolved_at: string | null;
          retailer_id: string;
          updated_at: string;
          wearer_id: string | null;
        };
        Insert: {
          action?: string | null;
          created_at?: string;
          detail: string;
          garment_key?: string | null;
          id?: string;
          kind: string;
          programme_id: string;
          quantity?: number | null;
          resolved_at?: string | null;
          retailer_id: string;
          updated_at?: string;
          wearer_id?: string | null;
        };
        Update: {
          action?: string | null;
          created_at?: string;
          detail?: string;
          garment_key?: string | null;
          id?: string;
          kind?: string;
          programme_id?: string;
          quantity?: number | null;
          resolved_at?: string | null;
          retailer_id?: string;
          updated_at?: string;
          wearer_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "corporate_exceptions_programme_id_fkey";
            columns: ["programme_id"];
            isOneToOne: false;
            referencedRelation: "corporate_programmes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "corporate_exceptions_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "corporate_exceptions_wearer_id_fkey";
            columns: ["wearer_id"];
            isOneToOne: false;
            referencedRelation: "corporate_wearers";
            referencedColumns: ["id"];
          },
        ];
      };
      corporate_issue_records: {
        Row: {
          created_at: string;
          entitlement_version_id: string;
          garment_key: string;
          id: string;
          issued_on: string;
          order_id: string | null;
          quantity: number;
          retailer_id: string;
          wearer_id: string;
        };
        Insert: {
          created_at?: string;
          entitlement_version_id: string;
          garment_key: string;
          id?: string;
          issued_on: string;
          order_id?: string | null;
          quantity: number;
          retailer_id: string;
          wearer_id: string;
        };
        Update: {
          created_at?: string;
          entitlement_version_id?: string;
          garment_key?: string;
          id?: string;
          issued_on?: string;
          order_id?: string | null;
          quantity?: number;
          retailer_id?: string;
          wearer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "corporate_issue_records_entitlement_version_id_fkey";
            columns: ["entitlement_version_id"];
            isOneToOne: false;
            referencedRelation: "corporate_entitlement_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "corporate_issue_records_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "corporate_issue_records_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "corporate_issue_records_wearer_id_fkey";
            columns: ["wearer_id"];
            isOneToOne: false;
            referencedRelation: "corporate_wearers";
            referencedColumns: ["id"];
          },
        ];
      };
      corporate_programmes: {
        Row: {
          account_id: string;
          active: boolean;
          created_at: string;
          deleted_at: string | null;
          id: string;
          name: string;
          retailer_id: string;
          site_keys: string[];
          updated_at: string;
        };
        Insert: {
          account_id: string;
          active?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          retailer_id: string;
          site_keys?: string[];
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          active?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          retailer_id?: string;
          site_keys?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "corporate_programmes_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "corporate_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "corporate_programmes_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      corporate_wearers: {
        Row: {
          active: boolean;
          created_at: string;
          customer_id: string | null;
          deleted_at: string | null;
          display_name: string;
          employee_reference: string;
          garment_adaptation_note: string | null;
          id: string;
          joined_on: string;
          programme_id: string;
          retailer_id: string;
          role_key: string;
          site_key: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          customer_id?: string | null;
          deleted_at?: string | null;
          display_name: string;
          employee_reference: string;
          garment_adaptation_note?: string | null;
          id?: string;
          joined_on: string;
          programme_id: string;
          retailer_id: string;
          role_key: string;
          site_key?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          customer_id?: string | null;
          deleted_at?: string | null;
          display_name?: string;
          employee_reference?: string;
          garment_adaptation_note?: string | null;
          id?: string;
          joined_on?: string;
          programme_id?: string;
          retailer_id?: string;
          role_key?: string;
          site_key?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "corporate_wearers_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "corporate_wearers_programme_id_fkey";
            columns: ["programme_id"];
            isOneToOne: false;
            referencedRelation: "corporate_programmes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "corporate_wearers_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      coverage_plan_intervals: {
        Row: {
          created_at: string;
          end_time: string;
          id: string;
          plan_id: string;
          required_headcount: number;
          required_skills: string[];
          retailer_id: string;
          start_time: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          end_time: string;
          id?: string;
          plan_id: string;
          required_headcount: number;
          required_skills?: string[];
          retailer_id: string;
          start_time: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          end_time?: string;
          id?: string;
          plan_id?: string;
          required_headcount?: number;
          required_skills?: string[];
          retailer_id?: string;
          start_time?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "coverage_plan_intervals_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "coverage_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coverage_plan_intervals_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      coverage_plans: {
        Row: {
          branch_id: string | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          plan_date: string;
          published_at: string | null;
          published_by_staff_id: string | null;
          retailer_id: string;
          state: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          plan_date: string;
          published_at?: string | null;
          published_by_staff_id?: string | null;
          retailer_id: string;
          state?: string;
          timezone: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          plan_date?: string;
          published_at?: string | null;
          published_by_staff_id?: string | null;
          retailer_id?: string;
          state?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "coverage_plans_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "retailer_branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coverage_plans_published_by_staff_id_fkey";
            columns: ["published_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coverage_plans_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_account_links: {
        Row: {
          customer_id: string;
          linked_at: string;
          retailer_id: string;
          user_id: string;
        };
        Insert: {
          customer_id: string;
          linked_at?: string;
          retailer_id: string;
          user_id: string;
        };
        Update: {
          customer_id?: string;
          linked_at?: string;
          retailer_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_account_links_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_account_links_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_consent_events: {
        Row: {
          actor_user_id: string | null;
          created_at: string;
          customer_id: string;
          id: string;
          previous_status: string | null;
          purpose: string;
          reason: string | null;
          retailer_id: string;
          status: string;
        };
        Insert: {
          actor_user_id?: string | null;
          created_at?: string;
          customer_id: string;
          id?: string;
          previous_status?: string | null;
          purpose: string;
          reason?: string | null;
          retailer_id: string;
          status: string;
        };
        Update: {
          actor_user_id?: string | null;
          created_at?: string;
          customer_id?: string;
          id?: string;
          previous_status?: string | null;
          purpose?: string;
          reason?: string | null;
          retailer_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_consent_events_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_consent_events_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "customer_consent_events_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_fact_corrections: {
        Row: {
          actor_customer_id: string | null;
          actor_staff_id: string | null;
          created_at: string;
          customer_id: string;
          fact_id: string;
          id: string;
          previous_snapshot: Json;
          reason: string;
          retailer_id: string;
        };
        Insert: {
          actor_customer_id?: string | null;
          actor_staff_id?: string | null;
          created_at?: string;
          customer_id: string;
          fact_id: string;
          id?: string;
          previous_snapshot: Json;
          reason: string;
          retailer_id: string;
        };
        Update: {
          actor_customer_id?: string | null;
          actor_staff_id?: string | null;
          created_at?: string;
          customer_id?: string;
          fact_id?: string;
          id?: string;
          previous_snapshot?: Json;
          reason?: string;
          retailer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_fact_corrections_actor_customer_id_fkey";
            columns: ["actor_customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_fact_corrections_actor_staff_id_fkey";
            columns: ["actor_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_fact_corrections_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_fact_corrections_fact_id_fkey";
            columns: ["fact_id"];
            isOneToOne: false;
            referencedRelation: "customer_facts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_fact_corrections_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_facts: {
        Row: {
          author_customer_id: string | null;
          author_staff_id: string | null;
          confidence: number;
          correction_of_fact_id: string | null;
          created_at: string;
          customer_id: string;
          deleted_at: string | null;
          evidence: Json;
          expires_at: string | null;
          fact_type: string;
          id: string;
          observed_at: string;
          provenance_class: string;
          retailer_id: string;
          review_by: string | null;
          sensitivity: string;
          superseded_by_fact_id: string | null;
          updated_at: string;
          valid_from: string | null;
          valid_until: string | null;
          value_concept_id: string | null;
          value_label: string;
          value_text: string | null;
          visibility: string;
        };
        Insert: {
          author_customer_id?: string | null;
          author_staff_id?: string | null;
          confidence?: number;
          correction_of_fact_id?: string | null;
          created_at?: string;
          customer_id: string;
          deleted_at?: string | null;
          evidence?: Json;
          expires_at?: string | null;
          fact_type: string;
          id?: string;
          observed_at: string;
          provenance_class: string;
          retailer_id: string;
          review_by?: string | null;
          sensitivity?: string;
          superseded_by_fact_id?: string | null;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
          value_concept_id?: string | null;
          value_label: string;
          value_text?: string | null;
          visibility?: string;
        };
        Update: {
          author_customer_id?: string | null;
          author_staff_id?: string | null;
          confidence?: number;
          correction_of_fact_id?: string | null;
          created_at?: string;
          customer_id?: string;
          deleted_at?: string | null;
          evidence?: Json;
          expires_at?: string | null;
          fact_type?: string;
          id?: string;
          observed_at?: string;
          provenance_class?: string;
          retailer_id?: string;
          review_by?: string | null;
          sensitivity?: string;
          superseded_by_fact_id?: string | null;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
          value_concept_id?: string | null;
          value_label?: string;
          value_text?: string | null;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_facts_author_customer_id_fkey";
            columns: ["author_customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_facts_author_staff_id_fkey";
            columns: ["author_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_facts_correction_of_fact_id_fkey";
            columns: ["correction_of_fact_id"];
            isOneToOne: false;
            referencedRelation: "customer_facts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_facts_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_facts_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_facts_superseded_by_fact_id_fkey";
            columns: ["superseded_by_fact_id"];
            isOneToOne: false;
            referencedRelation: "customer_facts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_facts_value_concept_id_fkey";
            columns: ["value_concept_id"];
            isOneToOne: false;
            referencedRelation: "metadata_concepts";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_measurement_candidates: {
        Row: {
          compared_to_version_id: string | null;
          created_at: string;
          customer_id: string;
          decision: string;
          decision_version: number;
          deltas: Json;
          id: string;
          quality_passed: boolean;
          quality_signals: Json;
          rationale: string;
          resolved_at: string | null;
          resolved_by_staff_id: string | null;
          retailer_id: string;
          self_scan_id: string | null;
          updated_at: string;
          values: Json;
        };
        Insert: {
          compared_to_version_id?: string | null;
          created_at?: string;
          customer_id: string;
          decision: string;
          decision_version: number;
          deltas?: Json;
          id?: string;
          quality_passed: boolean;
          quality_signals?: Json;
          rationale: string;
          resolved_at?: string | null;
          resolved_by_staff_id?: string | null;
          retailer_id: string;
          self_scan_id?: string | null;
          updated_at?: string;
          values: Json;
        };
        Update: {
          compared_to_version_id?: string | null;
          created_at?: string;
          customer_id?: string;
          decision?: string;
          decision_version?: number;
          deltas?: Json;
          id?: string;
          quality_passed?: boolean;
          quality_signals?: Json;
          rationale?: string;
          resolved_at?: string | null;
          resolved_by_staff_id?: string | null;
          retailer_id?: string;
          self_scan_id?: string | null;
          updated_at?: string;
          values?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "customer_measurement_candidates_compared_to_version_id_fkey";
            columns: ["compared_to_version_id"];
            isOneToOne: false;
            referencedRelation: "customer_measurement_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_measurement_candidates_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_measurement_candidates_resolved_by_staff_id_fkey";
            columns: ["resolved_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_measurement_candidates_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_measurement_candidates_self_scan_id_fkey";
            columns: ["self_scan_id"];
            isOneToOne: false;
            referencedRelation: "wardrobe_self_scans";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_measurement_versions: {
        Row: {
          approved_at: string;
          approved_by_staff_id: string;
          created_at: string;
          customer_id: string;
          id: string;
          retailer_id: string;
          review_note: string | null;
          reviewed_candidate_id: string | null;
          values: Json;
          version: number;
        };
        Insert: {
          approved_at?: string;
          approved_by_staff_id: string;
          created_at?: string;
          customer_id: string;
          id?: string;
          retailer_id: string;
          review_note?: string | null;
          reviewed_candidate_id?: string | null;
          values: Json;
          version: number;
        };
        Update: {
          approved_at?: string;
          approved_by_staff_id?: string;
          created_at?: string;
          customer_id?: string;
          id?: string;
          retailer_id?: string;
          review_note?: string | null;
          reviewed_candidate_id?: string | null;
          values?: Json;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "customer_measurement_versions_approved_by_staff_id_fkey";
            columns: ["approved_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_measurement_versions_candidate_fk";
            columns: ["reviewed_candidate_id"];
            isOneToOne: false;
            referencedRelation: "customer_measurement_candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_measurement_versions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_measurement_versions_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_moments: {
        Row: {
          appointment_id: string | null;
          branch_id: string | null;
          created_at: string;
          customer_id: string;
          deleted_at: string | null;
          id: string;
          label: string;
          moment_type: string;
          notes: string | null;
          occurs_on: string;
          recurrence: string;
          retailer_id: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          appointment_id?: string | null;
          branch_id?: string | null;
          created_at?: string;
          customer_id: string;
          deleted_at?: string | null;
          id?: string;
          label: string;
          moment_type: string;
          notes?: string | null;
          occurs_on: string;
          recurrence?: string;
          retailer_id: string;
          timezone: string;
          updated_at?: string;
        };
        Update: {
          appointment_id?: string | null;
          branch_id?: string | null;
          created_at?: string;
          customer_id?: string;
          deleted_at?: string | null;
          id?: string;
          label?: string;
          moment_type?: string;
          notes?: string | null;
          occurs_on?: string;
          recurrence?: string;
          retailer_id?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_moments_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_moments_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "retailer_branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_moments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_moments_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_preferences: {
        Row: {
          communication_channels: string[];
          created_at: string;
          customer_id: string;
          location_opt_in: boolean;
          location_withdrawn_at: string | null;
          marketing_opt_in: boolean;
          marketing_withdrawn_at: string | null;
          personalization_opt_in: boolean;
          personalization_withdrawn_at: string | null;
          preferred_currency: string;
          preferred_locale: string;
          style_notes: string | null;
          updated_at: string;
        };
        Insert: {
          communication_channels?: string[];
          created_at?: string;
          customer_id: string;
          location_opt_in?: boolean;
          location_withdrawn_at?: string | null;
          marketing_opt_in?: boolean;
          marketing_withdrawn_at?: string | null;
          personalization_opt_in?: boolean;
          personalization_withdrawn_at?: string | null;
          preferred_currency?: string;
          preferred_locale?: string;
          style_notes?: string | null;
          updated_at?: string;
        };
        Update: {
          communication_channels?: string[];
          created_at?: string;
          customer_id?: string;
          location_opt_in?: boolean;
          location_withdrawn_at?: string | null;
          marketing_opt_in?: boolean;
          marketing_withdrawn_at?: string | null;
          personalization_opt_in?: boolean;
          personalization_withdrawn_at?: string | null;
          preferred_currency?: string;
          preferred_locale?: string;
          style_notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_preferences_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: true;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_style_preference_evidence: {
        Row: {
          concept_id: string;
          confidence: number;
          created_at: string;
          customer_id: string;
          id: string;
          polarity: string;
          retailer_id: string;
          source: string;
          source_event_id: string | null;
          suppressed_at: string | null;
          suppressed_by: string | null;
          suppression_reason: string | null;
        };
        Insert: {
          concept_id: string;
          confidence: number;
          created_at?: string;
          customer_id: string;
          id?: string;
          polarity: string;
          retailer_id: string;
          source: string;
          source_event_id?: string | null;
          suppressed_at?: string | null;
          suppressed_by?: string | null;
          suppression_reason?: string | null;
        };
        Update: {
          concept_id?: string;
          confidence?: number;
          created_at?: string;
          customer_id?: string;
          id?: string;
          polarity?: string;
          retailer_id?: string;
          source?: string;
          source_event_id?: string | null;
          suppressed_at?: string | null;
          suppressed_by?: string | null;
          suppression_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customer_style_preference_evidence_concept_id_fkey";
            columns: ["concept_id"];
            isOneToOne: false;
            referencedRelation: "metadata_concepts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_style_preference_evidence_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_style_preference_evidence_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "customer_style_preference_evidence_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_style_preference_evidence_source_event_id_fkey";
            columns: ["source_event_id"];
            isOneToOne: false;
            referencedRelation: "behavioral_events";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_style_profiles: {
        Row: {
          confidence: Json;
          created_at: string;
          customer_id: string;
          explicit_preferences: Json;
          id: string;
          inferred_preferences: Json;
          recomputed_at: string | null;
          retailer_id: string;
          updated_at: string;
        };
        Insert: {
          confidence?: Json;
          created_at?: string;
          customer_id: string;
          explicit_preferences?: Json;
          id?: string;
          inferred_preferences?: Json;
          recomputed_at?: string | null;
          retailer_id: string;
          updated_at?: string;
        };
        Update: {
          confidence?: Json;
          created_at?: string;
          customer_id?: string;
          explicit_preferences?: Json;
          id?: string;
          inferred_preferences?: Json;
          recomputed_at?: string | null;
          retailer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_style_profiles_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_style_profiles_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "customer_style_profiles_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          acquisition_source: string | null;
          assigned_staff_id: string | null;
          created_at: string;
          deleted_at: string | null;
          email: string | null;
          full_name: string;
          id: string;
          lifecycle_stage: Database["public"]["Enums"]["customer_lifecycle_stage"];
          phone: string | null;
          preferred_carrier: string | null;
          retailer_id: string;
          shipping_addresses: Json;
          tags: string[];
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          acquisition_source?: string | null;
          assigned_staff_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          full_name: string;
          id?: string;
          lifecycle_stage?: Database["public"]["Enums"]["customer_lifecycle_stage"];
          phone?: string | null;
          preferred_carrier?: string | null;
          retailer_id: string;
          shipping_addresses?: Json;
          tags?: string[];
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          acquisition_source?: string | null;
          assigned_staff_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          lifecycle_stage?: Database["public"]["Enums"]["customer_lifecycle_stage"];
          phone?: string | null;
          preferred_carrier?: string | null;
          retailer_id?: string;
          shipping_addresses?: Json;
          tags?: string[];
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customers_assigned_staff_id_fkey";
            columns: ["assigned_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customers_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      email_outbox: {
        Row: {
          attempts: number;
          created_at: string;
          html_body: string;
          id: string;
          last_error: string | null;
          notification_id: string | null;
          recipient_email: string;
          sent_at: string | null;
          status: string;
          subject: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          html_body: string;
          id?: string;
          last_error?: string | null;
          notification_id?: string | null;
          recipient_email: string;
          sent_at?: string | null;
          status?: string;
          subject: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          html_body?: string;
          id?: string;
          last_error?: string | null;
          notification_id?: string | null;
          recipient_email?: string;
          sent_at?: string | null;
          status?: string;
          subject?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_outbox_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
        ];
      };
      entity_metadata_assignments: {
        Row: {
          concept_id: string;
          confidence: number | null;
          created_at: string;
          deleted_at: string | null;
          evidence: Json | null;
          id: string;
          retailer_id: string;
          review_status: Database["public"]["Enums"]["metadata_review_status"];
          reviewed_at: string | null;
          reviewed_by_staff_id: string | null;
          source: Database["public"]["Enums"]["metadata_source"];
          supplier_value: string | null;
          target_id: string;
          target_type: Database["public"]["Enums"]["metadata_target_type"];
          updated_at: string;
        };
        Insert: {
          concept_id: string;
          confidence?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          evidence?: Json | null;
          id?: string;
          retailer_id: string;
          review_status?: Database["public"]["Enums"]["metadata_review_status"];
          reviewed_at?: string | null;
          reviewed_by_staff_id?: string | null;
          source: Database["public"]["Enums"]["metadata_source"];
          supplier_value?: string | null;
          target_id: string;
          target_type: Database["public"]["Enums"]["metadata_target_type"];
          updated_at?: string;
        };
        Update: {
          concept_id?: string;
          confidence?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          evidence?: Json | null;
          id?: string;
          retailer_id?: string;
          review_status?: Database["public"]["Enums"]["metadata_review_status"];
          reviewed_at?: string | null;
          reviewed_by_staff_id?: string | null;
          source?: Database["public"]["Enums"]["metadata_source"];
          supplier_value?: string | null;
          target_id?: string;
          target_type?: Database["public"]["Enums"]["metadata_target_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entity_metadata_assignments_concept_id_fkey";
            columns: ["concept_id"];
            isOneToOne: false;
            referencedRelation: "metadata_concepts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entity_metadata_assignments_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entity_metadata_assignments_reviewed_by_staff_id_fkey";
            columns: ["reviewed_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
      event_rsvps: {
        Row: {
          created_at: string;
          customer_id: string;
          event_id: string;
          responded_at: string | null;
          status: Database["public"]["Enums"]["event_rsvp_status"];
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          event_id: string;
          responded_at?: string | null;
          status?: Database["public"]["Enums"]["event_rsvp_status"];
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          event_id?: string;
          responded_at?: string | null;
          status?: Database["public"]["Enums"]["event_rsvp_status"];
        };
        Relationships: [
          {
            foreignKeyName: "event_rsvps_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_rsvps_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "retailer_events";
            referencedColumns: ["id"];
          },
        ];
      };
      external_identities: {
        Row: {
          canonical_id: string;
          canonical_object_type: string;
          conflict_summary: string | null;
          connection_id: string;
          created_at: string;
          deleted_at: string | null;
          domain: string;
          external_id: string;
          external_object_type: string;
          external_updated_at: string | null;
          external_version: string | null;
          id: string;
          mapping_version: string;
          raw_event_id: string | null;
          reconciliation_status: string;
          retailer_id: string;
          updated_at: string;
        };
        Insert: {
          canonical_id: string;
          canonical_object_type: string;
          conflict_summary?: string | null;
          connection_id: string;
          created_at?: string;
          deleted_at?: string | null;
          domain: string;
          external_id: string;
          external_object_type: string;
          external_updated_at?: string | null;
          external_version?: string | null;
          id?: string;
          mapping_version: string;
          raw_event_id?: string | null;
          reconciliation_status?: string;
          retailer_id: string;
          updated_at?: string;
        };
        Update: {
          canonical_id?: string;
          canonical_object_type?: string;
          conflict_summary?: string | null;
          connection_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          domain?: string;
          external_id?: string;
          external_object_type?: string;
          external_updated_at?: string | null;
          external_version?: string | null;
          id?: string;
          mapping_version?: string;
          raw_event_id?: string | null;
          reconciliation_status?: string;
          retailer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "external_identities_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "integration_connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "external_identities_raw_event_id_fkey";
            columns: ["raw_event_id"];
            isOneToOne: false;
            referencedRelation: "integration_raw_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "external_identities_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      fabric_button_rules: {
        Row: {
          allowed_button_keys: string[];
          created_at: string;
          fabric_key: string;
          id: string;
          note: string;
          retailer_id: string;
          updated_at: string;
        };
        Insert: {
          allowed_button_keys: string[];
          created_at?: string;
          fabric_key: string;
          id?: string;
          note: string;
          retailer_id: string;
          updated_at?: string;
        };
        Update: {
          allowed_button_keys?: string[];
          created_at?: string;
          fabric_key?: string;
          id?: string;
          note?: string;
          retailer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fabric_button_rules_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      familiarity_presets: {
        Row: {
          created_at: string;
          display_name: string;
          key: string;
          navigation: Json;
          terminology: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          key: string;
          navigation: Json;
          terminology: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          key?: string;
          navigation?: Json;
          terminology?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      fitting_observations: {
        Row: {
          area: string;
          classification: Database["public"]["Enums"]["work_classification"];
          created_at: string;
          fitting_session_id: string;
          id: string;
          observation: string;
          physical_garment_id: string;
          recorded_by_staff_id: string | null;
          retailer_id: string;
        };
        Insert: {
          area: string;
          classification: Database["public"]["Enums"]["work_classification"];
          created_at?: string;
          fitting_session_id: string;
          id?: string;
          observation: string;
          physical_garment_id: string;
          recorded_by_staff_id?: string | null;
          retailer_id: string;
        };
        Update: {
          area?: string;
          classification?: Database["public"]["Enums"]["work_classification"];
          created_at?: string;
          fitting_session_id?: string;
          id?: string;
          observation?: string;
          physical_garment_id?: string;
          recorded_by_staff_id?: string | null;
          retailer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fitting_observations_fitting_session_id_fkey";
            columns: ["fitting_session_id"];
            isOneToOne: false;
            referencedRelation: "fitting_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fitting_observations_physical_garment_id_fkey";
            columns: ["physical_garment_id"];
            isOneToOne: false;
            referencedRelation: "physical_garments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fitting_observations_recorded_by_staff_id_fkey";
            columns: ["recorded_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fitting_observations_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      fitting_sessions: {
        Row: {
          appointment_id: string | null;
          created_at: string;
          customer_id: string;
          deleted_at: string | null;
          fitted_by_staff_id: string | null;
          id: string;
          notes: string | null;
          occurred_at: string;
          retailer_id: string;
          updated_at: string;
        };
        Insert: {
          appointment_id?: string | null;
          created_at?: string;
          customer_id: string;
          deleted_at?: string | null;
          fitted_by_staff_id?: string | null;
          id?: string;
          notes?: string | null;
          occurred_at?: string;
          retailer_id: string;
          updated_at?: string;
        };
        Update: {
          appointment_id?: string | null;
          created_at?: string;
          customer_id?: string;
          deleted_at?: string | null;
          fitted_by_staff_id?: string | null;
          id?: string;
          notes?: string | null;
          occurred_at?: string;
          retailer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fitting_sessions_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fitting_sessions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fitting_sessions_fitted_by_staff_id_fkey";
            columns: ["fitted_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fitting_sessions_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      governed_releases: {
        Row: {
          cohort_size_at_release: number;
          contract_ref: string | null;
          created_at: string;
          customer_request_ref: string | null;
          entitlement_ref: string;
          id: string;
          minimum_n: number;
          mode: string;
          purpose: string;
          released_at: string;
          retailer_id: string;
        };
        Insert: {
          cohort_size_at_release: number;
          contract_ref?: string | null;
          created_at?: string;
          customer_request_ref?: string | null;
          entitlement_ref: string;
          id?: string;
          minimum_n?: number;
          mode: string;
          purpose: string;
          released_at?: string;
          retailer_id: string;
        };
        Update: {
          cohort_size_at_release?: number;
          contract_ref?: string | null;
          created_at?: string;
          customer_request_ref?: string | null;
          entitlement_ref?: string;
          id?: string;
          minimum_n?: number;
          mode?: string;
          purpose?: string;
          released_at?: string;
          retailer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "governed_releases_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      guided_tiers: {
        Row: {
          active: boolean;
          created_at: string;
          display_name: string;
          id: string;
          included_package_keys: string[];
          price_minor_units: number;
          retailer_id: string;
          tier_key: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          display_name: string;
          id?: string;
          included_package_keys: string[];
          price_minor_units: number;
          retailer_id: string;
          tier_key: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          display_name?: string;
          id?: string;
          included_package_keys?: string[];
          price_minor_units?: number;
          retailer_id?: string;
          tier_key?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guided_tiers_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      honeymoon_programme_actions: {
        Row: {
          created_at: string;
          due_hint: string;
          id: string;
          kind: string;
          programme_id: string;
          requires_payment_approval: boolean;
          retailer_id: string;
          suppressed: boolean;
          suppression_reason: string | null;
          title: string;
        };
        Insert: {
          created_at?: string;
          due_hint: string;
          id?: string;
          kind: string;
          programme_id: string;
          requires_payment_approval?: boolean;
          retailer_id: string;
          suppressed?: boolean;
          suppression_reason?: string | null;
          title: string;
        };
        Update: {
          created_at?: string;
          due_hint?: string;
          id?: string;
          kind?: string;
          programme_id?: string;
          requires_payment_approval?: boolean;
          retailer_id?: string;
          suppressed?: boolean;
          suppression_reason?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "honeymoon_programme_actions_programme_id_fkey";
            columns: ["programme_id"];
            isOneToOne: false;
            referencedRelation: "honeymoon_programmes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "honeymoon_programme_actions_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      honeymoon_programmes: {
        Row: {
          created_at: string;
          customer_id: string;
          id: string;
          library_version_id: string | null;
          order_id: string;
          retailer_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          id?: string;
          library_version_id?: string | null;
          order_id: string;
          retailer_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          id?: string;
          library_version_id?: string | null;
          order_id?: string;
          retailer_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "honeymoon_programmes_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "honeymoon_programmes_library_version_id_fkey";
            columns: ["library_version_id"];
            isOneToOne: false;
            referencedRelation: "campaign_library_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "honeymoon_programmes_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "honeymoon_programmes_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      import_enrichment_prompt_contracts: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          prompt_markdown: string;
          response_schema_version: string;
          slug: string;
          title: string;
          updated_at: string;
          updated_by_user_id: string | null;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          prompt_markdown: string;
          response_schema_version?: string;
          slug: string;
          title: string;
          updated_at?: string;
          updated_by_user_id?: string | null;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          prompt_markdown?: string;
          response_schema_version?: string;
          slug?: string;
          title?: string;
          updated_at?: string;
          updated_by_user_id?: string | null;
        };
        Relationships: [];
      };
      integration_connection_secrets: {
        Row: {
          connection_id: string;
          created_at: string;
          id: string;
          kind: string;
          last_rotated_at: string | null;
          retailer_id: string;
          revoked_at: string | null;
          secret_ref: string | null;
          updated_at: string;
        };
        Insert: {
          connection_id: string;
          created_at?: string;
          id?: string;
          kind: string;
          last_rotated_at?: string | null;
          retailer_id: string;
          revoked_at?: string | null;
          secret_ref?: string | null;
          updated_at?: string;
        };
        Update: {
          connection_id?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          last_rotated_at?: string | null;
          retailer_id?: string;
          revoked_at?: string | null;
          secret_ref?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integration_connection_secrets_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "integration_connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "integration_connection_secrets_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_connections: {
        Row: {
          created_at: string;
          deep_link_base_url: string | null;
          deleted_at: string | null;
          display_name: string;
          health_status: string;
          id: string;
          lag_seconds: number;
          last_error_at: string | null;
          last_error_summary: string | null;
          last_success_at: string | null;
          operational_state: string;
          operational_state_changed_at: string;
          operational_state_changed_by: string | null;
          operational_state_reason: string | null;
          provider: string;
          retailer_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deep_link_base_url?: string | null;
          deleted_at?: string | null;
          display_name: string;
          health_status?: string;
          id?: string;
          lag_seconds?: number;
          last_error_at?: string | null;
          last_error_summary?: string | null;
          last_success_at?: string | null;
          operational_state?: string;
          operational_state_changed_at?: string;
          operational_state_changed_by?: string | null;
          operational_state_reason?: string | null;
          provider: string;
          retailer_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deep_link_base_url?: string | null;
          deleted_at?: string | null;
          display_name?: string;
          health_status?: string;
          id?: string;
          lag_seconds?: number;
          last_error_at?: string | null;
          last_error_summary?: string | null;
          last_success_at?: string | null;
          operational_state?: string;
          operational_state_changed_at?: string;
          operational_state_changed_by?: string | null;
          operational_state_reason?: string | null;
          provider?: string;
          retailer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integration_connections_operational_state_changed_by_fkey";
            columns: ["operational_state_changed_by"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "integration_connections_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_dead_letters: {
        Row: {
          connection_id: string;
          created_at: string;
          failure_detail: Json;
          failure_reason: string;
          first_failed_at: string;
          id: string;
          last_attempted_at: string;
          provider_event_id: string | null;
          resolution: string | null;
          resolved_at: string | null;
          retailer_id: string;
          retry_count: number;
          run_id: string | null;
        };
        Insert: {
          connection_id: string;
          created_at?: string;
          failure_detail?: Json;
          failure_reason: string;
          first_failed_at?: string;
          id?: string;
          last_attempted_at?: string;
          provider_event_id?: string | null;
          resolution?: string | null;
          resolved_at?: string | null;
          retailer_id: string;
          retry_count?: number;
          run_id?: string | null;
        };
        Update: {
          connection_id?: string;
          created_at?: string;
          failure_detail?: Json;
          failure_reason?: string;
          first_failed_at?: string;
          id?: string;
          last_attempted_at?: string;
          provider_event_id?: string | null;
          resolution?: string | null;
          resolved_at?: string | null;
          retailer_id?: string;
          retry_count?: number;
          run_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "integration_dead_letters_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "integration_connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "integration_dead_letters_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "integration_dead_letters_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "integration_sync_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_handoff_tasks: {
        Row: {
          connection_id: string;
          created_at: string;
          deep_link_url: string;
          external_id: string;
          external_object_type: string;
          id: string;
          instruction: string;
          retailer_id: string;
          status: string;
          updated_at: string;
          write_back_claimed: boolean;
        };
        Insert: {
          connection_id: string;
          created_at?: string;
          deep_link_url: string;
          external_id: string;
          external_object_type: string;
          id?: string;
          instruction: string;
          retailer_id: string;
          status?: string;
          updated_at?: string;
          write_back_claimed?: boolean;
        };
        Update: {
          connection_id?: string;
          created_at?: string;
          deep_link_url?: string;
          external_id?: string;
          external_object_type?: string;
          id?: string;
          instruction?: string;
          retailer_id?: string;
          status?: string;
          updated_at?: string;
          write_back_claimed?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "integration_handoff_tasks_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "integration_connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "integration_handoff_tasks_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_raw_events: {
        Row: {
          connection_id: string;
          created_at: string;
          direction: string;
          id: string;
          mapping_version: string;
          payload: Json;
          payload_hash: string;
          provider_event_id: string;
          received_at: string;
          retailer_id: string;
        };
        Insert: {
          connection_id: string;
          created_at?: string;
          direction: string;
          id?: string;
          mapping_version: string;
          payload?: Json;
          payload_hash: string;
          provider_event_id: string;
          received_at?: string;
          retailer_id: string;
        };
        Update: {
          connection_id?: string;
          created_at?: string;
          direction?: string;
          id?: string;
          mapping_version?: string;
          payload?: Json;
          payload_hash?: string;
          provider_event_id?: string;
          received_at?: string;
          retailer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integration_raw_events_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "integration_connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "integration_raw_events_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_reconciliation_reports: {
        Row: {
          conflict_count: number;
          connection_id: string;
          created_at: string;
          dead_letter_count: number;
          generated_at: string;
          id: string;
          matched_count: number;
          resource: string;
          retailer_id: string;
          run_id: string | null;
          stale_count: number;
        };
        Insert: {
          conflict_count?: number;
          connection_id: string;
          created_at?: string;
          dead_letter_count?: number;
          generated_at?: string;
          id?: string;
          matched_count?: number;
          resource: string;
          retailer_id: string;
          run_id?: string | null;
          stale_count?: number;
        };
        Update: {
          conflict_count?: number;
          connection_id?: string;
          created_at?: string;
          dead_letter_count?: number;
          generated_at?: string;
          id?: string;
          matched_count?: number;
          resource?: string;
          retailer_id?: string;
          run_id?: string | null;
          stale_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "integration_reconciliation_reports_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "integration_connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "integration_reconciliation_reports_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "integration_reconciliation_reports_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "integration_sync_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_sync_cursors: {
        Row: {
          connection_id: string;
          created_at: string;
          cursor_value: Json;
          id: string;
          last_synced_at: string | null;
          resource: string;
          retailer_id: string;
          updated_at: string;
        };
        Insert: {
          connection_id: string;
          created_at?: string;
          cursor_value?: Json;
          id?: string;
          last_synced_at?: string | null;
          resource: string;
          retailer_id: string;
          updated_at?: string;
        };
        Update: {
          connection_id?: string;
          created_at?: string;
          cursor_value?: Json;
          id?: string;
          last_synced_at?: string | null;
          resource?: string;
          retailer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integration_sync_cursors_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "integration_connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "integration_sync_cursors_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_sync_runs: {
        Row: {
          connection_id: string;
          created_at: string;
          error_summary: string | null;
          finished_at: string | null;
          id: string;
          records_failed: number;
          records_processed: number;
          retailer_id: string;
          started_at: string;
          status: string;
          trigger_kind: string;
        };
        Insert: {
          connection_id: string;
          created_at?: string;
          error_summary?: string | null;
          finished_at?: string | null;
          id?: string;
          records_failed?: number;
          records_processed?: number;
          retailer_id: string;
          started_at?: string;
          status?: string;
          trigger_kind: string;
        };
        Update: {
          connection_id?: string;
          created_at?: string;
          error_summary?: string | null;
          finished_at?: string | null;
          id?: string;
          records_failed?: number;
          records_processed?: number;
          retailer_id?: string;
          started_at?: string;
          status?: string;
          trigger_kind?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integration_sync_runs_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "integration_connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "integration_sync_runs_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      intelligence_policy_configs: {
        Row: {
          allow_activation: boolean;
          allow_advisor_display: boolean;
          allow_anonymous_capture: boolean;
          allow_customer_display: boolean;
          allow_export: boolean;
          allow_personalization_projection: boolean;
          created_at: string;
          deleted_at: string | null;
          field_mask: string[];
          id: string;
          jurisdiction_tag: string | null;
          policy_version: string;
          retailer_id: string | null;
          retention_days_personalization: number;
          updated_at: string;
        };
        Insert: {
          allow_activation?: boolean;
          allow_advisor_display?: boolean;
          allow_anonymous_capture?: boolean;
          allow_customer_display?: boolean;
          allow_export?: boolean;
          allow_personalization_projection?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          field_mask?: string[];
          id?: string;
          jurisdiction_tag?: string | null;
          policy_version?: string;
          retailer_id?: string | null;
          retention_days_personalization?: number;
          updated_at?: string;
        };
        Update: {
          allow_activation?: boolean;
          allow_advisor_display?: boolean;
          allow_anonymous_capture?: boolean;
          allow_customer_display?: boolean;
          allow_export?: boolean;
          allow_personalization_projection?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          field_mask?: string[];
          id?: string;
          jurisdiction_tag?: string | null;
          policy_version?: string;
          retailer_id?: string | null;
          retention_days_personalization?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "intelligence_policy_configs_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      intelligence_projection_health: {
        Row: {
          correction_rate: number;
          created_at: string;
          explainability_ok: boolean;
          id: string;
          lag_seconds: number;
          notes: string | null;
          observed_at: string;
          projector_version: string;
          retailer_id: string | null;
          status: string;
        };
        Insert: {
          correction_rate?: number;
          created_at?: string;
          explainability_ok?: boolean;
          id?: string;
          lag_seconds?: number;
          notes?: string | null;
          observed_at?: string;
          projector_version: string;
          retailer_id?: string | null;
          status: string;
        };
        Update: {
          correction_rate?: number;
          created_at?: string;
          explainability_ok?: boolean;
          id?: string;
          lag_seconds?: number;
          notes?: string | null;
          observed_at?: string;
          projector_version?: string;
          retailer_id?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "intelligence_projection_health_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      interaction_sessions: {
        Row: {
          anonymous_session_id: string | null;
          created_at: string;
          customer_id: string | null;
          device_class: string;
          ended_at: string | null;
          id: string;
          last_seen_at: string;
          locale: string | null;
          retailer_id: string;
          started_at: string;
          state: string;
          timezone: string | null;
          updated_at: string;
          user_agent_class: string | null;
        };
        Insert: {
          anonymous_session_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          device_class?: string;
          ended_at?: string | null;
          id?: string;
          last_seen_at?: string;
          locale?: string | null;
          retailer_id: string;
          started_at?: string;
          state?: string;
          timezone?: string | null;
          updated_at?: string;
          user_agent_class?: string | null;
        };
        Update: {
          anonymous_session_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          device_class?: string;
          ended_at?: string | null;
          id?: string;
          last_seen_at?: string;
          locale?: string | null;
          retailer_id?: string;
          started_at?: string;
          state?: string;
          timezone?: string | null;
          updated_at?: string;
          user_agent_class?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "interaction_sessions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interaction_sessions_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      knowledge_articles: {
        Row: {
          audience: string;
          author_staff_id: string | null;
          body: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          licence_ref: string | null;
          provenance: string;
          published_at: string | null;
          retailer_id: string;
          review_state: string;
          reviewed_by_staff_id: string | null;
          rights_expire_on: string | null;
          territories: string[];
          title: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          audience: string;
          author_staff_id?: string | null;
          body: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          licence_ref?: string | null;
          provenance: string;
          published_at?: string | null;
          retailer_id: string;
          review_state?: string;
          reviewed_by_staff_id?: string | null;
          rights_expire_on?: string | null;
          territories?: string[];
          title: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          audience?: string;
          author_staff_id?: string | null;
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          licence_ref?: string | null;
          provenance?: string;
          published_at?: string | null;
          retailer_id?: string;
          review_state?: string;
          reviewed_by_staff_id?: string | null;
          rights_expire_on?: string | null;
          territories?: string[];
          title?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_articles_author_staff_id_fkey";
            columns: ["author_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "knowledge_articles_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "knowledge_articles_reviewed_by_staff_id_fkey";
            columns: ["reviewed_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
      knowledge_object_concepts: {
        Row: {
          concept_id: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          knowledge_object_id: string;
          match_strength: number;
          updated_at: string;
        };
        Insert: {
          concept_id: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          knowledge_object_id: string;
          match_strength?: number;
          updated_at?: string;
        };
        Update: {
          concept_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          knowledge_object_id?: string;
          match_strength?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_object_concepts_concept_id_fkey";
            columns: ["concept_id"];
            isOneToOne: false;
            referencedRelation: "metadata_concepts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "knowledge_object_concepts_knowledge_object_id_fkey";
            columns: ["knowledge_object_id"];
            isOneToOne: false;
            referencedRelation: "knowledge_objects";
            referencedColumns: ["id"];
          },
        ];
      };
      knowledge_object_relations: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          source_knowledge_object_id: string;
          target_knowledge_object_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          source_knowledge_object_id: string;
          target_knowledge_object_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          source_knowledge_object_id?: string;
          target_knowledge_object_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_object_relations_source_knowledge_object_id_fkey";
            columns: ["source_knowledge_object_id"];
            isOneToOne: false;
            referencedRelation: "knowledge_objects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "knowledge_object_relations_target_knowledge_object_id_fkey";
            columns: ["target_knowledge_object_id"];
            isOneToOne: false;
            referencedRelation: "knowledge_objects";
            referencedColumns: ["id"];
          },
        ];
      };
      knowledge_objects: {
        Row: {
          active: boolean;
          body: string | null;
          commercial_intent: Database["public"]["Enums"]["knowledge_commercial_intent"];
          created_at: string;
          deleted_at: string | null;
          display_types: Database["public"]["Enums"]["knowledge_display_type"][];
          id: string;
          image_url: string | null;
          priority: number;
          retailer_id: string | null;
          slug: string;
          summary: string;
          title: string;
          topic: Database["public"]["Enums"]["knowledge_topic"];
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          body?: string | null;
          commercial_intent: Database["public"]["Enums"]["knowledge_commercial_intent"];
          created_at?: string;
          deleted_at?: string | null;
          display_types: Database["public"]["Enums"]["knowledge_display_type"][];
          id?: string;
          image_url?: string | null;
          priority?: number;
          retailer_id?: string | null;
          slug: string;
          summary: string;
          title: string;
          topic: Database["public"]["Enums"]["knowledge_topic"];
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          body?: string | null;
          commercial_intent?: Database["public"]["Enums"]["knowledge_commercial_intent"];
          created_at?: string;
          deleted_at?: string | null;
          display_types?: Database["public"]["Enums"]["knowledge_display_type"][];
          id?: string;
          image_url?: string | null;
          priority?: number;
          retailer_id?: string | null;
          slug?: string;
          summary?: string;
          title?: string;
          topic?: Database["public"]["Enums"]["knowledge_topic"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_objects_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      legacy_alteration_updates: {
        Row: {
          alteration_id: string;
          created_at: string;
          id: string;
          note: string | null;
          retailer_id: string;
          staff_id: string | null;
          status: Database["public"]["Enums"]["alteration_status"];
        };
        Insert: {
          alteration_id: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          retailer_id: string;
          staff_id?: string | null;
          status: Database["public"]["Enums"]["alteration_status"];
        };
        Update: {
          alteration_id?: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          retailer_id?: string;
          staff_id?: string | null;
          status?: Database["public"]["Enums"]["alteration_status"];
        };
        Relationships: [
          {
            foreignKeyName: "alteration_updates_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "legacy_alterations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_updates_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_updates_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
      legacy_alterations: {
        Row: {
          appointment_id_for_fitting: string | null;
          created_at: string;
          customer_id: string;
          deleted_at: string | null;
          due_date: string | null;
          id: string;
          instructions: string;
          order_line_id: string | null;
          retailer_id: string;
          status: Database["public"]["Enums"]["alteration_status"];
          tailor_reference: string | null;
          updated_at: string;
        };
        Insert: {
          appointment_id_for_fitting?: string | null;
          created_at?: string;
          customer_id: string;
          deleted_at?: string | null;
          due_date?: string | null;
          id?: string;
          instructions: string;
          order_line_id?: string | null;
          retailer_id: string;
          status?: Database["public"]["Enums"]["alteration_status"];
          tailor_reference?: string | null;
          updated_at?: string;
        };
        Update: {
          appointment_id_for_fitting?: string | null;
          created_at?: string;
          customer_id?: string;
          deleted_at?: string | null;
          due_date?: string | null;
          id?: string;
          instructions?: string;
          order_line_id?: string | null;
          retailer_id?: string;
          status?: Database["public"]["Enums"]["alteration_status"];
          tailor_reference?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alterations_appointment_id_for_fitting_fkey";
            columns: ["appointment_id_for_fitting"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alterations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alterations_order_line_id_fkey";
            columns: ["order_line_id"];
            isOneToOne: false;
            referencedRelation: "order_lines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alterations_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      legacy_customer_fit_profile_entries: {
        Row: {
          customer_id: string;
          fit_preferences: string | null;
          id: string;
          measurements: Json;
          recorded_at: string;
          recorded_by_staff_id: string | null;
          retailer_id: string;
          style_notes: string | null;
        };
        Insert: {
          customer_id: string;
          fit_preferences?: string | null;
          id?: string;
          measurements?: Json;
          recorded_at?: string;
          recorded_by_staff_id?: string | null;
          retailer_id: string;
          style_notes?: string | null;
        };
        Update: {
          customer_id?: string;
          fit_preferences?: string | null;
          id?: string;
          measurements?: Json;
          recorded_at?: string;
          recorded_by_staff_id?: string | null;
          retailer_id?: string;
          style_notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customer_fit_profile_entries_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_fit_profile_entries_recorded_by_staff_id_fkey";
            columns: ["recorded_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_fit_profile_entries_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      loyalty_accounts: {
        Row: {
          created_at: string;
          customer_id: string;
          deleted_at: string | null;
          id: string;
          lifetime_points: number;
          points_balance: number;
          retailer_id: string;
          tier: Database["public"]["Enums"]["loyalty_tier"];
          tier_anniversary_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          deleted_at?: string | null;
          id?: string;
          lifetime_points?: number;
          points_balance?: number;
          retailer_id: string;
          tier?: Database["public"]["Enums"]["loyalty_tier"];
          tier_anniversary_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          deleted_at?: string | null;
          id?: string;
          lifetime_points?: number;
          points_balance?: number;
          retailer_id?: string;
          tier?: Database["public"]["Enums"]["loyalty_tier"];
          tier_anniversary_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "loyalty_accounts_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loyalty_accounts_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      loyalty_ledger_entries: {
        Row: {
          created_at: string;
          id: string;
          loyalty_account_id: string;
          note: string | null;
          points: number;
          related_order_id: string | null;
          type: Database["public"]["Enums"]["loyalty_entry_type"];
        };
        Insert: {
          created_at?: string;
          id?: string;
          loyalty_account_id: string;
          note?: string | null;
          points: number;
          related_order_id?: string | null;
          type: Database["public"]["Enums"]["loyalty_entry_type"];
        };
        Update: {
          created_at?: string;
          id?: string;
          loyalty_account_id?: string;
          note?: string | null;
          points?: number;
          related_order_id?: string | null;
          type?: Database["public"]["Enums"]["loyalty_entry_type"];
        };
        Relationships: [
          {
            foreignKeyName: "loyalty_ledger_entries_loyalty_account_id_fkey";
            columns: ["loyalty_account_id"];
            isOneToOne: false;
            referencedRelation: "loyalty_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loyalty_ledger_entries_related_order_id_fkey";
            columns: ["related_order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      loyalty_milestone_awards: {
        Row: {
          awarded_at: string;
          customer_id: string;
          definition_id: string | null;
          explanation: string;
          id: string;
          idempotency_key: string;
          kind: Database["public"]["Enums"]["loyalty_milestone_kind"];
          label: string;
          loyalty_account_id: string;
          loyalty_ledger_entry_id: string | null;
          points: number;
          related_concept_id: string | null;
          related_order_id: string | null;
          retailer_id: string;
          reverse_ledger_entry_id: string | null;
          reversed_at: string | null;
          status: Database["public"]["Enums"]["loyalty_milestone_award_status"];
        };
        Insert: {
          awarded_at?: string;
          customer_id: string;
          definition_id?: string | null;
          explanation: string;
          id?: string;
          idempotency_key: string;
          kind: Database["public"]["Enums"]["loyalty_milestone_kind"];
          label: string;
          loyalty_account_id: string;
          loyalty_ledger_entry_id?: string | null;
          points: number;
          related_concept_id?: string | null;
          related_order_id?: string | null;
          retailer_id: string;
          reverse_ledger_entry_id?: string | null;
          reversed_at?: string | null;
          status?: Database["public"]["Enums"]["loyalty_milestone_award_status"];
        };
        Update: {
          awarded_at?: string;
          customer_id?: string;
          definition_id?: string | null;
          explanation?: string;
          id?: string;
          idempotency_key?: string;
          kind?: Database["public"]["Enums"]["loyalty_milestone_kind"];
          label?: string;
          loyalty_account_id?: string;
          loyalty_ledger_entry_id?: string | null;
          points?: number;
          related_concept_id?: string | null;
          related_order_id?: string | null;
          retailer_id?: string;
          reverse_ledger_entry_id?: string | null;
          reversed_at?: string | null;
          status?: Database["public"]["Enums"]["loyalty_milestone_award_status"];
        };
        Relationships: [
          {
            foreignKeyName: "loyalty_milestone_awards_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loyalty_milestone_awards_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "loyalty_milestone_awards_definition_id_fkey";
            columns: ["definition_id"];
            isOneToOne: false;
            referencedRelation: "loyalty_milestone_definitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loyalty_milestone_awards_loyalty_account_id_fkey";
            columns: ["loyalty_account_id"];
            isOneToOne: false;
            referencedRelation: "loyalty_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loyalty_milestone_awards_loyalty_ledger_entry_id_fkey";
            columns: ["loyalty_ledger_entry_id"];
            isOneToOne: false;
            referencedRelation: "loyalty_ledger_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loyalty_milestone_awards_related_concept_id_fkey";
            columns: ["related_concept_id"];
            isOneToOne: false;
            referencedRelation: "metadata_concepts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loyalty_milestone_awards_related_order_id_fkey";
            columns: ["related_order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loyalty_milestone_awards_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loyalty_milestone_awards_reverse_ledger_entry_id_fkey";
            columns: ["reverse_ledger_entry_id"];
            isOneToOne: false;
            referencedRelation: "loyalty_ledger_entries";
            referencedColumns: ["id"];
          },
        ];
      };
      loyalty_milestone_definitions: {
        Row: {
          active: boolean;
          created_at: string;
          custom_key: string | null;
          explanation: string;
          id: string;
          kind: Database["public"]["Enums"]["loyalty_milestone_kind"];
          label: string;
          match_concept_ids: string[];
          points: number;
          retailer_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          custom_key?: string | null;
          explanation: string;
          id?: string;
          kind: Database["public"]["Enums"]["loyalty_milestone_kind"];
          label: string;
          match_concept_ids?: string[];
          points: number;
          retailer_id: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          custom_key?: string | null;
          explanation?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["loyalty_milestone_kind"];
          label?: string;
          match_concept_ids?: string[];
          points?: number;
          retailer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "loyalty_milestone_definitions_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      loyalty_programs: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          enabled: boolean;
          id: string;
          name: string;
          points_per_currency_unit: number;
          referral_points: number;
          retailer_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          enabled?: boolean;
          id?: string;
          name?: string;
          points_per_currency_unit?: number;
          referral_points?: number;
          retailer_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          enabled?: boolean;
          id?: string;
          name?: string;
          points_per_currency_unit?: number;
          referral_points?: number;
          retailer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "loyalty_programs_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: true;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      managed_service_offerings: {
        Row: {
          billing_interval: string | null;
          created_at: string;
          description: string;
          display_order: number;
          id: string;
          is_public: boolean;
          key: string;
          name: string;
          price_amount_minor_units: number | null;
          price_currency: string | null;
          price_is_from: boolean;
          updated_at: string;
        };
        Insert: {
          billing_interval?: string | null;
          created_at?: string;
          description?: string;
          display_order?: number;
          id?: string;
          is_public?: boolean;
          key: string;
          name: string;
          price_amount_minor_units?: number | null;
          price_currency?: string | null;
          price_is_from?: boolean;
          updated_at?: string;
        };
        Update: {
          billing_interval?: string | null;
          created_at?: string;
          description?: string;
          display_order?: number;
          id?: string;
          is_public?: boolean;
          key?: string;
          name?: string;
          price_amount_minor_units?: number | null;
          price_currency?: string | null;
          price_is_from?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      merchant_group_buys: {
        Row: {
          closes_on: string;
          committed_quantity: number;
          created_at: string;
          id: string;
          listing_id: string;
          retailer_id: string;
          target_quantity: number;
          updated_at: string;
        };
        Insert: {
          closes_on: string;
          committed_quantity?: number;
          created_at?: string;
          id?: string;
          listing_id: string;
          retailer_id: string;
          target_quantity: number;
          updated_at?: string;
        };
        Update: {
          closes_on?: string;
          committed_quantity?: number;
          created_at?: string;
          id?: string;
          listing_id?: string;
          retailer_id?: string;
          target_quantity?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_group_buys_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "merchant_listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "merchant_group_buys_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      merchant_listings: {
        Row: {
          category: string;
          created_at: string;
          customizable: boolean;
          id: string;
          minimum_order_quantity: number;
          price_tiers: Json;
          retailer_id: string;
          sample_available: boolean;
          supplier_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          customizable?: boolean;
          id?: string;
          minimum_order_quantity: number;
          price_tiers: Json;
          retailer_id: string;
          sample_available?: boolean;
          supplier_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          customizable?: boolean;
          id?: string;
          minimum_order_quantity?: number;
          price_tiers?: Json;
          retailer_id?: string;
          sample_available?: boolean;
          supplier_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_listings_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "merchant_listings_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "merchant_suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      merchant_purchase_orders: {
        Row: {
          approved_at: string | null;
          approved_by_staff_id: string | null;
          created_at: string;
          currency: string;
          id: string;
          po_number: string;
          raised_by_staff_id: string | null;
          retailer_id: string;
          rfq_id: string | null;
          state: string;
          supplier_id: string;
          total_minor_units: number;
          updated_at: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by_staff_id?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          po_number: string;
          raised_by_staff_id?: string | null;
          retailer_id: string;
          rfq_id?: string | null;
          state?: string;
          supplier_id: string;
          total_minor_units: number;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by_staff_id?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          po_number?: string;
          raised_by_staff_id?: string | null;
          retailer_id?: string;
          rfq_id?: string | null;
          state?: string;
          supplier_id?: string;
          total_minor_units?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_purchase_orders_approved_by_staff_id_fkey";
            columns: ["approved_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "merchant_purchase_orders_raised_by_staff_id_fkey";
            columns: ["raised_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "merchant_purchase_orders_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "merchant_purchase_orders_rfq_id_fkey";
            columns: ["rfq_id"];
            isOneToOne: false;
            referencedRelation: "merchant_rfqs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "merchant_purchase_orders_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "merchant_suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      merchant_rfqs: {
        Row: {
          created_at: string;
          id: string;
          listing_id: string;
          proof_approved_at: string | null;
          quantity: number;
          quote_expires_on: string | null;
          quoted_unit_price_minor_units: number | null;
          retailer_id: string;
          state: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          listing_id: string;
          proof_approved_at?: string | null;
          quantity: number;
          quote_expires_on?: string | null;
          quoted_unit_price_minor_units?: number | null;
          retailer_id: string;
          state?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          listing_id?: string;
          proof_approved_at?: string | null;
          quantity?: number;
          quote_expires_on?: string | null;
          quoted_unit_price_minor_units?: number | null;
          retailer_id?: string;
          state?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_rfqs_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "merchant_listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "merchant_rfqs_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      merchant_shipment_issues: {
        Row: {
          affected_quantity: number;
          created_at: string;
          evidence_refs: string[];
          id: string;
          kind: string;
          resolved_at: string | null;
          retailer_id: string;
          shipment_id: string;
          updated_at: string;
        };
        Insert: {
          affected_quantity: number;
          created_at?: string;
          evidence_refs?: string[];
          id?: string;
          kind: string;
          resolved_at?: string | null;
          retailer_id: string;
          shipment_id: string;
          updated_at?: string;
        };
        Update: {
          affected_quantity?: number;
          created_at?: string;
          evidence_refs?: string[];
          id?: string;
          kind?: string;
          resolved_at?: string | null;
          retailer_id?: string;
          shipment_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_shipment_issues_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "merchant_shipment_issues_shipment_id_fkey";
            columns: ["shipment_id"];
            isOneToOne: false;
            referencedRelation: "merchant_shipments";
            referencedColumns: ["id"];
          },
        ];
      };
      merchant_shipments: {
        Row: {
          carrier_reference: string | null;
          created_at: string;
          id: string;
          purchase_order_id: string;
          quantity: number;
          received_on: string | null;
          retailer_id: string;
          shipped_on: string | null;
          updated_at: string;
        };
        Insert: {
          carrier_reference?: string | null;
          created_at?: string;
          id?: string;
          purchase_order_id: string;
          quantity: number;
          received_on?: string | null;
          retailer_id: string;
          shipped_on?: string | null;
          updated_at?: string;
        };
        Update: {
          carrier_reference?: string | null;
          created_at?: string;
          id?: string;
          purchase_order_id?: string;
          quantity?: number;
          received_on?: string | null;
          retailer_id?: string;
          shipped_on?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_shipments_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "merchant_purchase_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "merchant_shipments_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      merchant_suppliers: {
        Row: {
          active: boolean;
          created_at: string;
          display_name: string;
          id: string;
          retailer_id: string;
          supplier_key: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          display_name: string;
          id?: string;
          retailer_id: string;
          supplier_key: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          display_name?: string;
          id?: string;
          retailer_id?: string;
          supplier_key?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_suppliers_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      message_attachments: {
        Row: {
          created_at: string;
          file_name: string;
          id: string;
          message_id: string;
          mime_type: string;
          retailer_id: string;
          size_bytes: number;
          storage_bucket: string;
          storage_path: string;
          uploaded_by_staff_id: string | null;
          uploaded_by_user_id: string | null;
        };
        Insert: {
          created_at?: string;
          file_name: string;
          id?: string;
          message_id: string;
          mime_type: string;
          retailer_id: string;
          size_bytes: number;
          storage_bucket: string;
          storage_path: string;
          uploaded_by_staff_id?: string | null;
          uploaded_by_user_id?: string | null;
        };
        Update: {
          created_at?: string;
          file_name?: string;
          id?: string;
          message_id?: string;
          mime_type?: string;
          retailer_id?: string;
          size_bytes?: number;
          storage_bucket?: string;
          storage_path?: string;
          uploaded_by_staff_id?: string | null;
          uploaded_by_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_attachments_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_attachments_uploaded_by_staff_id_fkey";
            columns: ["uploaded_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          body: string;
          conversation_id: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          read_by_customer_at: string | null;
          read_by_staff_at: string | null;
          sender_staff_id: string | null;
          sender_type: Database["public"]["Enums"]["message_sender_type"];
          sender_user_id: string | null;
          updated_at: string;
        };
        Insert: {
          body: string;
          conversation_id: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          read_by_customer_at?: string | null;
          read_by_staff_at?: string | null;
          sender_staff_id?: string | null;
          sender_type: Database["public"]["Enums"]["message_sender_type"];
          sender_user_id?: string | null;
          updated_at?: string;
        };
        Update: {
          body?: string;
          conversation_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          read_by_customer_at?: string | null;
          read_by_staff_at?: string | null;
          sender_staff_id?: string | null;
          sender_type?: Database["public"]["Enums"]["message_sender_type"];
          sender_user_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_staff_id_fkey";
            columns: ["sender_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
      metadata_assignment_reviews: {
        Row: {
          assignment_id: string;
          confidence: number | null;
          created_at: string;
          evidence: Json | null;
          id: string;
          previous_status:
            Database["public"]["Enums"]["metadata_review_status"] | null;
          retailer_id: string;
          review_status: Database["public"]["Enums"]["metadata_review_status"];
          reviewed_by_staff_id: string;
          source: Database["public"]["Enums"]["metadata_source"];
          supplier_value: string | null;
        };
        Insert: {
          assignment_id: string;
          confidence?: number | null;
          created_at?: string;
          evidence?: Json | null;
          id?: string;
          previous_status?:
            Database["public"]["Enums"]["metadata_review_status"] | null;
          retailer_id: string;
          review_status: Database["public"]["Enums"]["metadata_review_status"];
          reviewed_by_staff_id: string;
          source: Database["public"]["Enums"]["metadata_source"];
          supplier_value?: string | null;
        };
        Update: {
          assignment_id?: string;
          confidence?: number | null;
          created_at?: string;
          evidence?: Json | null;
          id?: string;
          previous_status?:
            Database["public"]["Enums"]["metadata_review_status"] | null;
          retailer_id?: string;
          review_status?: Database["public"]["Enums"]["metadata_review_status"];
          reviewed_by_staff_id?: string;
          source?: Database["public"]["Enums"]["metadata_source"];
          supplier_value?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "metadata_assignment_reviews_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "entity_metadata_assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metadata_assignment_reviews_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metadata_assignment_reviews_reviewed_by_staff_id_fkey";
            columns: ["reviewed_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
      metadata_concept_edges: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          kind: Database["public"]["Enums"]["metadata_edge_kind"];
          retailer_id: string | null;
          source_concept_id: string;
          target_concept_id: string;
          updated_at: string;
          weight: number;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["metadata_edge_kind"];
          retailer_id?: string | null;
          source_concept_id: string;
          target_concept_id: string;
          updated_at?: string;
          weight?: number;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["metadata_edge_kind"];
          retailer_id?: string | null;
          source_concept_id?: string;
          target_concept_id?: string;
          updated_at?: string;
          weight?: number;
        };
        Relationships: [
          {
            foreignKeyName: "metadata_concept_edges_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metadata_concept_edges_source_concept_id_fkey";
            columns: ["source_concept_id"];
            isOneToOne: false;
            referencedRelation: "metadata_concepts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metadata_concept_edges_target_concept_id_fkey";
            columns: ["target_concept_id"];
            isOneToOne: false;
            referencedRelation: "metadata_concepts";
            referencedColumns: ["id"];
          },
        ];
      };
      metadata_concepts: {
        Row: {
          active: boolean;
          attributes: Json;
          canonical_name: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          image_url: string | null;
          kind: Database["public"]["Enums"]["metadata_concept_kind"];
          retailer_id: string | null;
          slug: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          attributes?: Json;
          canonical_name: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          image_url?: string | null;
          kind: Database["public"]["Enums"]["metadata_concept_kind"];
          retailer_id?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          attributes?: Json;
          canonical_name?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          image_url?: string | null;
          kind?: Database["public"]["Enums"]["metadata_concept_kind"];
          retailer_id?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "metadata_concepts_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      metadata_review_tasks: {
        Row: {
          assignment_id: string | null;
          confidence: number | null;
          created_at: string;
          evidence: string | null;
          field_key: string | null;
          id: string;
          import_row_id: string | null;
          proposed_concept_id: string | null;
          proposed_value: string;
          retailer_id: string;
          reviewed_at: string | null;
          reviewed_by_staff_id: string | null;
          source: Database["public"]["Enums"]["metadata_source"];
          status: Database["public"]["Enums"]["metadata_review_task_status"];
          updated_at: string;
        };
        Insert: {
          assignment_id?: string | null;
          confidence?: number | null;
          created_at?: string;
          evidence?: string | null;
          field_key?: string | null;
          id?: string;
          import_row_id?: string | null;
          proposed_concept_id?: string | null;
          proposed_value: string;
          retailer_id: string;
          reviewed_at?: string | null;
          reviewed_by_staff_id?: string | null;
          source: Database["public"]["Enums"]["metadata_source"];
          status?: Database["public"]["Enums"]["metadata_review_task_status"];
          updated_at?: string;
        };
        Update: {
          assignment_id?: string | null;
          confidence?: number | null;
          created_at?: string;
          evidence?: string | null;
          field_key?: string | null;
          id?: string;
          import_row_id?: string | null;
          proposed_concept_id?: string | null;
          proposed_value?: string;
          retailer_id?: string;
          reviewed_at?: string | null;
          reviewed_by_staff_id?: string | null;
          source?: Database["public"]["Enums"]["metadata_source"];
          status?: Database["public"]["Enums"]["metadata_review_task_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "metadata_review_tasks_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "entity_metadata_assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metadata_review_tasks_import_row_id_fkey";
            columns: ["import_row_id"];
            isOneToOne: false;
            referencedRelation: "catalogue_import_rows";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metadata_review_tasks_proposed_concept_id_fkey";
            columns: ["proposed_concept_id"];
            isOneToOne: false;
            referencedRelation: "metadata_concepts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metadata_review_tasks_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metadata_review_tasks_reviewed_by_staff_id_fkey";
            columns: ["reviewed_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
      migration_jobs: {
        Row: {
          connection_id: string | null;
          contract_version: string;
          created_at: string;
          display_name: string;
          dry_run_report: Json | null;
          id: string;
          last_error: string | null;
          reconcile_report: Json | null;
          retailer_id: string;
          rollback_ref: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          connection_id?: string | null;
          contract_version?: string;
          created_at?: string;
          display_name: string;
          dry_run_report?: Json | null;
          id?: string;
          last_error?: string | null;
          reconcile_report?: Json | null;
          retailer_id: string;
          rollback_ref?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          connection_id?: string | null;
          contract_version?: string;
          created_at?: string;
          display_name?: string;
          dry_run_report?: Json | null;
          id?: string;
          last_error?: string | null;
          reconcile_report?: Json | null;
          retailer_id?: string;
          rollback_ref?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "migration_jobs_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "integration_connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "migration_jobs_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      migration_publish_receipts: {
        Row: {
          canonical_id: string;
          created_at: string;
          entity_kind: string;
          external_id: string;
          id: string;
          job_id: string;
          money_minor: number;
          retailer_id: string;
          stock_units: number;
        };
        Insert: {
          canonical_id: string;
          created_at?: string;
          entity_kind: string;
          external_id: string;
          id?: string;
          job_id: string;
          money_minor?: number;
          retailer_id: string;
          stock_units?: number;
        };
        Update: {
          canonical_id?: string;
          created_at?: string;
          entity_kind?: string;
          external_id?: string;
          id?: string;
          job_id?: string;
          money_minor?: number;
          retailer_id?: string;
          stock_units?: number;
        };
        Relationships: [
          {
            foreignKeyName: "migration_publish_receipts_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "migration_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "migration_publish_receipts_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      migration_staged_rows: {
        Row: {
          canonical_id: string | null;
          created_at: string;
          entity_kind: string;
          external_id: string;
          id: string;
          job_id: string;
          payload: Json;
          raw_event_id: string | null;
          rejection_code: string | null;
          rejection_message: string | null;
          retailer_id: string;
          row_number: number;
          status: string;
          updated_at: string;
        };
        Insert: {
          canonical_id?: string | null;
          created_at?: string;
          entity_kind: string;
          external_id: string;
          id?: string;
          job_id: string;
          payload?: Json;
          raw_event_id?: string | null;
          rejection_code?: string | null;
          rejection_message?: string | null;
          retailer_id: string;
          row_number: number;
          status?: string;
          updated_at?: string;
        };
        Update: {
          canonical_id?: string | null;
          created_at?: string;
          entity_kind?: string;
          external_id?: string;
          id?: string;
          job_id?: string;
          payload?: Json;
          raw_event_id?: string | null;
          rejection_code?: string | null;
          rejection_message?: string | null;
          retailer_id?: string;
          row_number?: number;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "migration_staged_rows_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "migration_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "migration_staged_rows_raw_event_id_fkey";
            columns: ["raw_event_id"];
            isOneToOne: false;
            referencedRelation: "integration_raw_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "migration_staged_rows_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      morning_routine_delivery_audits: {
        Row: {
          created_at: string;
          customer_id: string;
          for_date: string;
          id: string;
          notification_id: string | null;
          outcome: string;
          retailer_id: string;
          scheduled_for: string;
          selection_id: string | null;
          suppression_reason: string | null;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          for_date: string;
          id?: string;
          notification_id?: string | null;
          outcome: string;
          retailer_id: string;
          scheduled_for: string;
          selection_id?: string | null;
          suppression_reason?: string | null;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          for_date?: string;
          id?: string;
          notification_id?: string | null;
          outcome?: string;
          retailer_id?: string;
          scheduled_for?: string;
          selection_id?: string | null;
          suppression_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "morning_routine_delivery_audits_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "morning_routine_delivery_audits_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "morning_routine_delivery_audits_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "morning_routine_delivery_audits_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "morning_routine_delivery_audits_selection_id_fkey";
            columns: ["selection_id"];
            isOneToOne: false;
            referencedRelation: "morning_routine_selections";
            referencedColumns: ["id"];
          },
        ];
      };
      morning_routine_eligible_products: {
        Row: {
          active: boolean;
          created_at: string;
          created_by_staff_id: string | null;
          product_id: string;
          retailer_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by_staff_id?: string | null;
          product_id: string;
          retailer_id: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by_staff_id?: string | null;
          product_id?: string;
          retailer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "morning_routine_eligible_products_created_by_staff_id_fkey";
            columns: ["created_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "morning_routine_eligible_products_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "morning_routine_eligible_products_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      morning_routine_recommendations: {
        Row: {
          actions: Json;
          category_code: string | null;
          created_at: string;
          customer_id: string;
          display_name: string;
          explanation: Json;
          factors: Json;
          id: string;
          primary_image_url: string | null;
          product_id: string | null;
          product_slug: string | null;
          product_variant_id: string | null;
          rank: number;
          retailer_id: string;
          score: number;
          selection_id: string;
          source: string;
          wardrobe_item_id: string | null;
        };
        Insert: {
          actions?: Json;
          category_code?: string | null;
          created_at?: string;
          customer_id: string;
          display_name: string;
          explanation?: Json;
          factors?: Json;
          id?: string;
          primary_image_url?: string | null;
          product_id?: string | null;
          product_slug?: string | null;
          product_variant_id?: string | null;
          rank: number;
          retailer_id: string;
          score: number;
          selection_id: string;
          source: string;
          wardrobe_item_id?: string | null;
        };
        Update: {
          actions?: Json;
          category_code?: string | null;
          created_at?: string;
          customer_id?: string;
          display_name?: string;
          explanation?: Json;
          factors?: Json;
          id?: string;
          primary_image_url?: string | null;
          product_id?: string | null;
          product_slug?: string | null;
          product_variant_id?: string | null;
          rank?: number;
          retailer_id?: string;
          score?: number;
          selection_id?: string;
          source?: string;
          wardrobe_item_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "morning_routine_recommendations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "morning_routine_recommendations_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "morning_routine_recommendations_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "morning_routine_recommendations_product_variant_id_fkey";
            columns: ["product_variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "morning_routine_recommendations_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "morning_routine_recommendations_selection_id_fkey";
            columns: ["selection_id"];
            isOneToOne: false;
            referencedRelation: "morning_routine_selections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "morning_routine_recommendations_wardrobe_item_id_fkey";
            columns: ["wardrobe_item_id"];
            isOneToOne: false;
            referencedRelation: "wardrobe_items";
            referencedColumns: ["id"];
          },
        ];
      };
      morning_routine_retailer_settings: {
        Row: {
          paused: boolean;
          retailer_id: string;
          updated_at: string;
        };
        Insert: {
          paused?: boolean;
          retailer_id: string;
          updated_at?: string;
        };
        Update: {
          paused?: boolean;
          retailer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "morning_routine_retailer_settings_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: true;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      morning_routine_selections: {
        Row: {
          calendar_status: string;
          created_at: string;
          customer_id: string;
          for_date: string;
          id: string;
          location_consent: string;
          location_kind: string;
          location_label: string | null;
          location_status: string;
          occasion_labels: Json;
          personalization_consent: string;
          personalization_status: string;
          retailer_id: string;
          review_status: string;
          summary: string;
          weather_status: string;
          weather_summary: string | null;
        };
        Insert: {
          calendar_status: string;
          created_at?: string;
          customer_id: string;
          for_date: string;
          id?: string;
          location_consent: string;
          location_kind: string;
          location_label?: string | null;
          location_status: string;
          occasion_labels?: Json;
          personalization_consent: string;
          personalization_status: string;
          retailer_id: string;
          review_status?: string;
          summary: string;
          weather_status: string;
          weather_summary?: string | null;
        };
        Update: {
          calendar_status?: string;
          created_at?: string;
          customer_id?: string;
          for_date?: string;
          id?: string;
          location_consent?: string;
          location_kind?: string;
          location_label?: string | null;
          location_status?: string;
          occasion_labels?: Json;
          personalization_consent?: string;
          personalization_status?: string;
          retailer_id?: string;
          review_status?: string;
          summary?: string;
          weather_status?: string;
          weather_summary?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "morning_routine_selections_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "morning_routine_selections_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "morning_routine_selections_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      morning_routine_subscriptions: {
        Row: {
          channels: string[];
          created_at: string;
          customer_id: string;
          frequency: string;
          id: string;
          opted_in: boolean;
          opted_in_at: string | null;
          opted_out_at: string | null;
          preferred_local_hour: number;
          quiet_end_minute: number | null;
          quiet_start_minute: number | null;
          retailer_id: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          channels?: string[];
          created_at?: string;
          customer_id: string;
          frequency?: string;
          id?: string;
          opted_in?: boolean;
          opted_in_at?: string | null;
          opted_out_at?: string | null;
          preferred_local_hour?: number;
          quiet_end_minute?: number | null;
          quiet_start_minute?: number | null;
          retailer_id: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          channels?: string[];
          created_at?: string;
          customer_id?: string;
          frequency?: string;
          id?: string;
          opted_in?: boolean;
          opted_in_at?: string | null;
          opted_out_at?: string | null;
          preferred_local_hour?: number;
          quiet_end_minute?: number | null;
          quiet_start_minute?: number | null;
          retailer_id?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "morning_routine_subscriptions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: true;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "morning_routine_subscriptions_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "morning_routine_subscriptions_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      network_attribution_events: {
        Row: {
          created_at: string;
          event: string;
          id: string;
          listing_id: string;
          occurred_at: string;
          provider_event_key: string;
          pseudonymous_ref: string;
          retailer_id: string;
          state: string;
          value_minor_units: number | null;
        };
        Insert: {
          created_at?: string;
          event: string;
          id?: string;
          listing_id: string;
          occurred_at?: string;
          provider_event_key: string;
          pseudonymous_ref: string;
          retailer_id: string;
          state?: string;
          value_minor_units?: number | null;
        };
        Update: {
          created_at?: string;
          event?: string;
          id?: string;
          listing_id?: string;
          occurred_at?: string;
          provider_event_key?: string;
          pseudonymous_ref?: string;
          retailer_id?: string;
          state?: string;
          value_minor_units?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "network_attribution_events_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "network_listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "network_attribution_events_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      network_listings: {
        Row: {
          active: boolean;
          created_at: string;
          curated_by_retailer: boolean;
          description: string | null;
          destination_url: string;
          id: string;
          partner_id: string;
          retailer_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          curated_by_retailer?: boolean;
          description?: string | null;
          destination_url: string;
          id?: string;
          partner_id: string;
          retailer_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          curated_by_retailer?: boolean;
          description?: string | null;
          destination_url?: string;
          id?: string;
          partner_id?: string;
          retailer_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "network_listings_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "network_partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "network_listings_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      network_partners: {
        Row: {
          active: boolean;
          created_at: string;
          disclosure_text: string;
          display_name: string;
          id: string;
          partner_key: string;
          retailer_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          disclosure_text: string;
          display_name: string;
          id?: string;
          partner_key: string;
          retailer_id: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          disclosure_text?: string;
          display_name?: string;
          id?: string;
          partner_key?: string;
          retailer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "network_partners_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      network_pseudonym_map: {
        Row: {
          created_at: string;
          customer_id: string;
          id: string;
          partner_id: string;
          pseudonymous_ref: string;
          retailer_id: string;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          id?: string;
          partner_id: string;
          pseudonymous_ref: string;
          retailer_id: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          id?: string;
          partner_id?: string;
          pseudonymous_ref?: string;
          retailer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "network_pseudonym_map_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "network_pseudonym_map_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "network_partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "network_pseudonym_map_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      network_reward_entries: {
        Row: {
          attribution_event_id: string | null;
          created_at: string;
          currency: string;
          customer_id: string;
          expires_on: string;
          funding_source: string;
          id: string;
          retailer_id: string;
          reverses_entry_id: string | null;
          state: string;
          value_minor_units: number;
        };
        Insert: {
          attribution_event_id?: string | null;
          created_at?: string;
          currency?: string;
          customer_id: string;
          expires_on: string;
          funding_source: string;
          id?: string;
          retailer_id: string;
          reverses_entry_id?: string | null;
          state?: string;
          value_minor_units: number;
        };
        Update: {
          attribution_event_id?: string | null;
          created_at?: string;
          currency?: string;
          customer_id?: string;
          expires_on?: string;
          funding_source?: string;
          id?: string;
          retailer_id?: string;
          reverses_entry_id?: string | null;
          state?: string;
          value_minor_units?: number;
        };
        Relationships: [
          {
            foreignKeyName: "network_reward_entries_attribution_event_id_fkey";
            columns: ["attribution_event_id"];
            isOneToOne: false;
            referencedRelation: "network_attribution_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "network_reward_entries_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "network_reward_entries_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "network_reward_entries_reverses_entry_id_fkey";
            columns: ["reverses_entry_id"];
            isOneToOne: false;
            referencedRelation: "network_reward_entries";
            referencedColumns: ["id"];
          },
        ];
      };
      newsletter_subscribers: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          retailer_id: string;
          subscribed_at: string;
          unsubscribed_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          retailer_id: string;
          subscribed_at?: string;
          unsubscribed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          retailer_id?: string;
          subscribed_at?: string;
          unsubscribed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "newsletter_subscribers_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          action_href: string | null;
          body: string;
          category: Database["public"]["Enums"]["notification_category"];
          channel: Database["public"]["Enums"]["notification_channel"];
          created_at: string;
          customer_id: string | null;
          deleted_at: string | null;
          id: string;
          read_at: string | null;
          recipient_user_id: string;
          retailer_id: string;
          sent_at: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          action_href?: string | null;
          body: string;
          category: Database["public"]["Enums"]["notification_category"];
          channel?: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          customer_id?: string | null;
          deleted_at?: string | null;
          id?: string;
          read_at?: string | null;
          recipient_user_id: string;
          retailer_id: string;
          sent_at?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          action_href?: string | null;
          body?: string;
          category?: Database["public"]["Enums"]["notification_category"];
          channel?: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          customer_id?: string | null;
          deleted_at?: string | null;
          id?: string;
          read_at?: string | null;
          recipient_user_id?: string;
          retailer_id?: string;
          sent_at?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      order_lines: {
        Row: {
          created_at: string;
          id: string;
          order_id: string;
          product_variant_id: string;
          quantity: number;
          requires_alteration: boolean;
          requires_production: boolean;
          unit_price_amount_minor_units: number;
          unit_price_currency: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          order_id: string;
          product_variant_id: string;
          quantity: number;
          requires_alteration?: boolean;
          requires_production?: boolean;
          unit_price_amount_minor_units: number;
          unit_price_currency: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          order_id?: string;
          product_variant_id?: string;
          quantity?: number;
          requires_alteration?: boolean;
          requires_production?: boolean;
          unit_price_amount_minor_units?: number;
          unit_price_currency?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_lines_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_lines_product_variant_id_fkey";
            columns: ["product_variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          channel: Database["public"]["Enums"]["order_channel"];
          created_at: string;
          currency: string;
          customer_id: string;
          deleted_at: string | null;
          id: string;
          order_number: string;
          placed_at: string | null;
          retailer_id: string;
          shipping_address: Json | null;
          staff_id: string | null;
          status: Database["public"]["Enums"]["order_status"];
          subtotal_amount_minor_units: number;
          total_amount_minor_units: number;
          updated_at: string;
        };
        Insert: {
          channel?: Database["public"]["Enums"]["order_channel"];
          created_at?: string;
          currency: string;
          customer_id: string;
          deleted_at?: string | null;
          id?: string;
          order_number: string;
          placed_at?: string | null;
          retailer_id: string;
          shipping_address?: Json | null;
          staff_id?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal_amount_minor_units: number;
          total_amount_minor_units: number;
          updated_at?: string;
        };
        Update: {
          channel?: Database["public"]["Enums"]["order_channel"];
          created_at?: string;
          currency?: string;
          customer_id?: string;
          deleted_at?: string | null;
          id?: string;
          order_number?: string;
          placed_at?: string | null;
          retailer_id?: string;
          shipping_address?: Json | null;
          staff_id?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal_amount_minor_units?: number;
          total_amount_minor_units?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
      outfit_slots: {
        Row: {
          available: boolean;
          created_at: string;
          display_order: number;
          id: string;
          label: string;
          outfit_id: string;
          product_id: string | null;
          retailer_id: string;
          slot_kind: string;
          wardrobe_item_id: string | null;
        };
        Insert: {
          available?: boolean;
          created_at?: string;
          display_order?: number;
          id?: string;
          label: string;
          outfit_id: string;
          product_id?: string | null;
          retailer_id: string;
          slot_kind: string;
          wardrobe_item_id?: string | null;
        };
        Update: {
          available?: boolean;
          created_at?: string;
          display_order?: number;
          id?: string;
          label?: string;
          outfit_id?: string;
          product_id?: string | null;
          retailer_id?: string;
          slot_kind?: string;
          wardrobe_item_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "outfit_slots_outfit_id_fkey";
            columns: ["outfit_id"];
            isOneToOne: false;
            referencedRelation: "outfits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "outfit_slots_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "outfit_slots_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "outfit_slots_wardrobe_item_id_fkey";
            columns: ["wardrobe_item_id"];
            isOneToOne: false;
            referencedRelation: "wardrobe_items";
            referencedColumns: ["id"];
          },
        ];
      };
      outfits: {
        Row: {
          created_at: string;
          created_by_staff_id: string;
          customer_id: string;
          deleted_at: string | null;
          id: string;
          notes: string | null;
          occasion_label: string | null;
          retailer_id: string;
          roadmap_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by_staff_id: string;
          customer_id: string;
          deleted_at?: string | null;
          id?: string;
          notes?: string | null;
          occasion_label?: string | null;
          retailer_id: string;
          roadmap_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by_staff_id?: string;
          customer_id?: string;
          deleted_at?: string | null;
          id?: string;
          notes?: string | null;
          occasion_label?: string | null;
          retailer_id?: string;
          roadmap_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "outfits_created_by_staff_id_fkey";
            columns: ["created_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "outfits_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "outfits_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "outfits_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "outfits_roadmap_id_fkey";
            columns: ["roadmap_id"];
            isOneToOne: false;
            referencedRelation: "wardrobe_roadmaps";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount_minor_units: number;
          captured_at: string | null;
          created_at: string;
          currency: string;
          id: string;
          order_id: string;
          platform_fee_amount_minor_units: number;
          provider: string;
          provider_payment_intent_id: string;
          status: Database["public"]["Enums"]["payment_status"];
          updated_at: string;
        };
        Insert: {
          amount_minor_units: number;
          captured_at?: string | null;
          created_at?: string;
          currency: string;
          id?: string;
          order_id: string;
          platform_fee_amount_minor_units?: number;
          provider?: string;
          provider_payment_intent_id: string;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Update: {
          amount_minor_units?: number;
          captured_at?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          order_id?: string;
          platform_fee_amount_minor_units?: number;
          provider?: string;
          provider_payment_intent_id?: string;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      physical_garments: {
        Row: {
          brand: string | null;
          category_code: string;
          created_at: string;
          customer_id: string;
          deleted_at: string | null;
          description: string;
          external_reference: string | null;
          garment_type: string;
          id: string;
          identification_state: Database["public"]["Enums"]["garment_identification_state"];
          identifying_photo_url: string | null;
          intake_condition: string;
          label_metadata: Json;
          legacy_alteration_id: string | null;
          order_line_id: string | null;
          retailer_id: string;
          source_kind: Database["public"]["Enums"]["garment_source_kind"];
          supplier_order_reference: string | null;
          updated_at: string;
        };
        Insert: {
          brand?: string | null;
          category_code: string;
          created_at?: string;
          customer_id: string;
          deleted_at?: string | null;
          description: string;
          external_reference?: string | null;
          garment_type: string;
          id?: string;
          identification_state?: Database["public"]["Enums"]["garment_identification_state"];
          identifying_photo_url?: string | null;
          intake_condition: string;
          label_metadata?: Json;
          legacy_alteration_id?: string | null;
          order_line_id?: string | null;
          retailer_id: string;
          source_kind: Database["public"]["Enums"]["garment_source_kind"];
          supplier_order_reference?: string | null;
          updated_at?: string;
        };
        Update: {
          brand?: string | null;
          category_code?: string;
          created_at?: string;
          customer_id?: string;
          deleted_at?: string | null;
          description?: string;
          external_reference?: string | null;
          garment_type?: string;
          id?: string;
          identification_state?: Database["public"]["Enums"]["garment_identification_state"];
          identifying_photo_url?: string | null;
          intake_condition?: string;
          label_metadata?: Json;
          legacy_alteration_id?: string | null;
          order_line_id?: string | null;
          retailer_id?: string;
          source_kind?: Database["public"]["Enums"]["garment_source_kind"];
          supplier_order_reference?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "physical_garments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "physical_garments_order_line_id_fkey";
            columns: ["order_line_id"];
            isOneToOne: false;
            referencedRelation: "order_lines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "physical_garments_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_modules: {
        Row: {
          authority_domains: string[];
          created_at: string;
          dependency_keys: string[];
          description: string;
          family_order: number;
          job_keys: string[];
          key: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          authority_domains?: string[];
          created_at?: string;
          dependency_keys?: string[];
          description: string;
          family_order: number;
          job_keys?: string[];
          key: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          authority_domains?: string[];
          created_at?: string;
          dependency_keys?: string[];
          description?: string;
          family_order?: number;
          job_keys?: string[];
          key?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_staff_members: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          deleted_at: string | null;
          full_name: string;
          id: string;
          invited_at: string;
          role: Database["public"]["Enums"]["platform_role"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          full_name: string;
          id?: string;
          invited_at?: string;
          role: Database["public"]["Enums"]["platform_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          full_name?: string;
          id?: string;
          invited_at?: string;
          role?: Database["public"]["Enums"]["platform_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      pos_payments: {
        Row: {
          amount_minor_units: number;
          captured_at: string;
          created_at: string;
          currency: string;
          id: string;
          provider: string;
          provider_reference: string;
          retailer_id: string;
          transaction_id: string;
        };
        Insert: {
          amount_minor_units: number;
          captured_at?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          provider: string;
          provider_reference: string;
          retailer_id: string;
          transaction_id: string;
        };
        Update: {
          amount_minor_units?: number;
          captured_at?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          provider?: string;
          provider_reference?: string;
          retailer_id?: string;
          transaction_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pos_payments_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_payments_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "pos_transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_payments_transaction_same_retailer_fk";
            columns: ["retailer_id", "transaction_id"];
            isOneToOne: false;
            referencedRelation: "pos_transactions";
            referencedColumns: ["retailer_id", "id"];
          },
        ];
      };
      pos_transaction_lines: {
        Row: {
          alteration_id: string | null;
          created_at: string;
          currency: string;
          id: string;
          kind: string;
          production_spec_id: string | null;
          quantity: number;
          reservation_entry_id: string | null;
          retailer_id: string;
          returned_quantity: number;
          returns_line_id: string | null;
          transaction_id: string;
          unit_price_minor_units: number;
          updated_at: string;
          variant_id: string | null;
        };
        Insert: {
          alteration_id?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          kind: string;
          production_spec_id?: string | null;
          quantity: number;
          reservation_entry_id?: string | null;
          retailer_id: string;
          returned_quantity?: number;
          returns_line_id?: string | null;
          transaction_id: string;
          unit_price_minor_units: number;
          updated_at?: string;
          variant_id?: string | null;
        };
        Update: {
          alteration_id?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          kind?: string;
          production_spec_id?: string | null;
          quantity?: number;
          reservation_entry_id?: string | null;
          retailer_id?: string;
          returned_quantity?: number;
          returns_line_id?: string | null;
          transaction_id?: string;
          unit_price_minor_units?: number;
          updated_at?: string;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pos_lines_alteration_same_retailer_fk";
            columns: ["retailer_id", "alteration_id"];
            isOneToOne: false;
            referencedRelation: "alteration_work_orders";
            referencedColumns: ["retailer_id", "id"];
          },
          {
            foreignKeyName: "pos_lines_alteration_same_retailer_fk";
            columns: ["retailer_id", "alteration_id"];
            isOneToOne: false;
            referencedRelation: "customer_alteration_work_orders";
            referencedColumns: ["retailer_id", "id"];
          },
          {
            foreignKeyName: "pos_lines_alteration_same_retailer_fk";
            columns: ["retailer_id", "alteration_id"];
            isOneToOne: false;
            referencedRelation: "worker_alteration_work_orders";
            referencedColumns: ["retailer_id", "id"];
          },
          {
            foreignKeyName: "pos_lines_production_same_retailer_fk";
            columns: ["retailer_id", "production_spec_id"];
            isOneToOne: false;
            referencedRelation: "production_specs";
            referencedColumns: ["retailer_id", "id"];
          },
          {
            foreignKeyName: "pos_lines_reservation_same_retailer_fk";
            columns: ["retailer_id", "reservation_entry_id"];
            isOneToOne: false;
            referencedRelation: "stock_ledger_entries";
            referencedColumns: ["retailer_id", "id"];
          },
          {
            foreignKeyName: "pos_lines_returns_line_same_retailer_fk";
            columns: ["retailer_id", "returns_line_id"];
            isOneToOne: false;
            referencedRelation: "pos_transaction_lines";
            referencedColumns: ["retailer_id", "id"];
          },
          {
            foreignKeyName: "pos_lines_transaction_same_retailer_fk";
            columns: ["retailer_id", "transaction_id"];
            isOneToOne: false;
            referencedRelation: "pos_transactions";
            referencedColumns: ["retailer_id", "id"];
          },
          {
            foreignKeyName: "pos_transaction_lines_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_transaction_lines_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "customer_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_transaction_lines_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "worker_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_transaction_lines_production_spec_id_fkey";
            columns: ["production_spec_id"];
            isOneToOne: false;
            referencedRelation: "production_specs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_transaction_lines_reservation_entry_id_fkey";
            columns: ["reservation_entry_id"];
            isOneToOne: false;
            referencedRelation: "stock_ledger_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_transaction_lines_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_transaction_lines_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "pos_transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_transaction_lines_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      pos_transactions: {
        Row: {
          completed_at: string | null;
          created_at: string;
          customer_id: string | null;
          id: string;
          location_id: string;
          retailer_id: string;
          returns_transaction_id: string | null;
          staff_id: string | null;
          state: string;
          updated_at: string;
          void_reason: string | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          location_id: string;
          retailer_id: string;
          returns_transaction_id?: string | null;
          staff_id?: string | null;
          state?: string;
          updated_at?: string;
          void_reason?: string | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          location_id?: string;
          retailer_id?: string;
          returns_transaction_id?: string | null;
          staff_id?: string | null;
          state?: string;
          updated_at?: string;
          void_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pos_transactions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_transactions_customer_same_retailer_fk";
            columns: ["retailer_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["retailer_id", "id"];
          },
          {
            foreignKeyName: "pos_transactions_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "stock_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_transactions_location_same_retailer_fk";
            columns: ["retailer_id", "location_id"];
            isOneToOne: false;
            referencedRelation: "stock_locations";
            referencedColumns: ["retailer_id", "id"];
          },
          {
            foreignKeyName: "pos_transactions_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_transactions_return_same_retailer_fk";
            columns: ["retailer_id", "returns_transaction_id"];
            isOneToOne: false;
            referencedRelation: "pos_transactions";
            referencedColumns: ["retailer_id", "id"];
          },
          {
            foreignKeyName: "pos_transactions_returns_transaction_id_fkey";
            columns: ["returns_transaction_id"];
            isOneToOne: false;
            referencedRelation: "pos_transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_transactions_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_transactions_staff_same_retailer_fk";
            columns: ["retailer_id", "staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["retailer_id", "id"];
          },
        ];
      };
      price_change_proposals: {
        Row: {
          alteration_id: string;
          created_at: string;
          currency: string;
          decided_at: string | null;
          decided_by_staff_id: string | null;
          decision_reason: string | null;
          deleted_at: string | null;
          evidence_attachment_id: string | null;
          explanation: string;
          id: string;
          original_amount_minor_units: number;
          proposed_amount_minor_units: number;
          proposed_by_staff_id: string;
          retailer_id: string;
          status: Database["public"]["Enums"]["price_change_proposal_status"];
          task_id: string | null;
          updated_at: string;
        };
        Insert: {
          alteration_id: string;
          created_at?: string;
          currency: string;
          decided_at?: string | null;
          decided_by_staff_id?: string | null;
          decision_reason?: string | null;
          deleted_at?: string | null;
          evidence_attachment_id?: string | null;
          explanation: string;
          id?: string;
          original_amount_minor_units: number;
          proposed_amount_minor_units: number;
          proposed_by_staff_id: string;
          retailer_id: string;
          status?: Database["public"]["Enums"]["price_change_proposal_status"];
          task_id?: string | null;
          updated_at?: string;
        };
        Update: {
          alteration_id?: string;
          created_at?: string;
          currency?: string;
          decided_at?: string | null;
          decided_by_staff_id?: string | null;
          decision_reason?: string | null;
          deleted_at?: string | null;
          evidence_attachment_id?: string | null;
          explanation?: string;
          id?: string;
          original_amount_minor_units?: number;
          proposed_amount_minor_units?: number;
          proposed_by_staff_id?: string;
          retailer_id?: string;
          status?: Database["public"]["Enums"]["price_change_proposal_status"];
          task_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "price_change_proposals_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_change_proposals_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "customer_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_change_proposals_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "worker_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_change_proposals_decided_by_staff_id_fkey";
            columns: ["decided_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_change_proposals_evidence_attachment_id_fkey";
            columns: ["evidence_attachment_id"];
            isOneToOne: false;
            referencedRelation: "alteration_attachments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_change_proposals_proposed_by_staff_id_fkey";
            columns: ["proposed_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_change_proposals_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_change_proposals_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "alteration_tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_change_proposals_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "worker_alteration_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      product_collections: {
        Row: {
          collection_id: string;
          product_id: string;
        };
        Insert: {
          collection_id: string;
          product_id: string;
        };
        Update: {
          collection_id?: string;
          product_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_collections_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "collections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_collections_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_fabric_composition: {
        Row: {
          created_at: string;
          fibre_concept_id: string;
          percentage: number;
          profile_id: string;
          retailer_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          fibre_concept_id: string;
          percentage: number;
          profile_id: string;
          retailer_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          fibre_concept_id?: string;
          percentage?: number;
          profile_id?: string;
          retailer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_fabric_composition_fibre_concept_id_fkey";
            columns: ["fibre_concept_id"];
            isOneToOne: false;
            referencedRelation: "metadata_concepts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_fabric_composition_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "product_fabric_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_fabric_composition_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      product_fabric_profiles: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          fabric_weight_grams_per_square_metre: number | null;
          id: string;
          product_id: string;
          product_variant_id: string | null;
          retailer_id: string;
          supplier_reference: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          fabric_weight_grams_per_square_metre?: number | null;
          id?: string;
          product_id: string;
          product_variant_id?: string | null;
          retailer_id: string;
          supplier_reference?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          fabric_weight_grams_per_square_metre?: number | null;
          id?: string;
          product_id?: string;
          product_variant_id?: string | null;
          retailer_id?: string;
          supplier_reference?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_fabric_profiles_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_fabric_profiles_product_variant_id_fkey";
            columns: ["product_variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_fabric_profiles_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      product_hypotheses: {
        Row: {
          created_at: string;
          evidence_kinds: string[];
          id: string;
          retailer_id: string;
          state: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          evidence_kinds?: string[];
          id?: string;
          retailer_id: string;
          state?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          evidence_kinds?: string[];
          id?: string;
          retailer_id?: string;
          state?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_hypotheses_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          color: string | null;
          compare_at_price_amount_minor_units: number | null;
          compare_at_price_currency: string | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          inventory_quantity: number;
          lead_time_days: number | null;
          price_amount_minor_units: number;
          price_currency: string;
          product_id: string;
          size: string | null;
          sku: string;
          updated_at: string;
        };
        Insert: {
          color?: string | null;
          compare_at_price_amount_minor_units?: number | null;
          compare_at_price_currency?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          inventory_quantity?: number;
          lead_time_days?: number | null;
          price_amount_minor_units: number;
          price_currency: string;
          product_id: string;
          size?: string | null;
          sku: string;
          updated_at?: string;
        };
        Update: {
          color?: string | null;
          compare_at_price_amount_minor_units?: number | null;
          compare_at_price_currency?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          inventory_quantity?: number;
          lead_time_days?: number | null;
          price_amount_minor_units?: number;
          price_currency?: string;
          product_id?: string;
          size?: string | null;
          sku?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      production_material_lines: {
        Row: {
          consumed_units: number | null;
          created_at: string;
          id: string;
          material_key: string;
          piece_id: string | null;
          planned_units: number;
          retailer_id: string;
          spec_id: string;
          unit: string;
          updated_at: string;
        };
        Insert: {
          consumed_units?: number | null;
          created_at?: string;
          id?: string;
          material_key: string;
          piece_id?: string | null;
          planned_units: number;
          retailer_id: string;
          spec_id: string;
          unit: string;
          updated_at?: string;
        };
        Update: {
          consumed_units?: number | null;
          created_at?: string;
          id?: string;
          material_key?: string;
          piece_id?: string | null;
          planned_units?: number;
          retailer_id?: string;
          spec_id?: string;
          unit?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "production_material_lines_piece_id_fkey";
            columns: ["piece_id"];
            isOneToOne: false;
            referencedRelation: "production_pieces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "production_material_lines_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "production_material_lines_spec_id_fkey";
            columns: ["spec_id"];
            isOneToOne: false;
            referencedRelation: "production_specs";
            referencedColumns: ["id"];
          },
        ];
      };
      production_pieces: {
        Row: {
          barcode: string;
          completed_on: string | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          maker_staff_id: string | null;
          order_id: string;
          piece_kind: string;
          piece_sequence: number;
          promised_on: string | null;
          retailer_id: string;
          spec_id: string;
          stage: string;
          updated_at: string;
        };
        Insert: {
          barcode: string;
          completed_on?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          maker_staff_id?: string | null;
          order_id: string;
          piece_kind: string;
          piece_sequence: number;
          promised_on?: string | null;
          retailer_id: string;
          spec_id: string;
          stage?: string;
          updated_at?: string;
        };
        Update: {
          barcode?: string;
          completed_on?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          maker_staff_id?: string | null;
          order_id?: string;
          piece_kind?: string;
          piece_sequence?: number;
          promised_on?: string | null;
          retailer_id?: string;
          spec_id?: string;
          stage?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "production_pieces_maker_staff_id_fkey";
            columns: ["maker_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "production_pieces_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "production_pieces_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "production_pieces_spec_id_fkey";
            columns: ["spec_id"];
            isOneToOne: false;
            referencedRelation: "production_specs";
            referencedColumns: ["id"];
          },
        ];
      };
      production_spec_amendments: {
        Row: {
          amended_by_staff_id: string;
          changes: Json;
          cost_decision: string;
          created_at: string;
          id: string;
          reason: string;
          retailer_id: string;
          spec_id: string;
        };
        Insert: {
          amended_by_staff_id: string;
          changes?: Json;
          cost_decision: string;
          created_at?: string;
          id?: string;
          reason: string;
          retailer_id: string;
          spec_id: string;
        };
        Update: {
          amended_by_staff_id?: string;
          changes?: Json;
          cost_decision?: string;
          created_at?: string;
          id?: string;
          reason?: string;
          retailer_id?: string;
          spec_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "production_spec_amendments_amended_by_staff_id_fkey";
            columns: ["amended_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "production_spec_amendments_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "production_spec_amendments_spec_id_fkey";
            columns: ["spec_id"];
            isOneToOne: false;
            referencedRelation: "production_specs";
            referencedColumns: ["id"];
          },
        ];
      };
      production_specs: {
        Row: {
          created_at: string;
          customer_id: string;
          id: string;
          locked_at: string | null;
          measurement_version_id: string;
          order_id: string;
          retailer_id: string;
          spec: Json;
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          id?: string;
          locked_at?: string | null;
          measurement_version_id: string;
          order_id: string;
          retailer_id: string;
          spec?: Json;
          updated_at?: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          id?: string;
          locked_at?: string | null;
          measurement_version_id?: string;
          order_id?: string;
          retailer_id?: string;
          spec?: Json;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "production_specs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "production_specs_measurement_version_id_fkey";
            columns: ["measurement_version_id"];
            isOneToOne: false;
            referencedRelation: "customer_measurement_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "production_specs_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "production_specs_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      production_stage_events: {
        Row: {
          defect_note: string | null;
          from_stage: string;
          id: string;
          inspector_staff_id: string | null;
          occurred_at: string;
          piece_id: string;
          recorded_by_staff_id: string | null;
          retailer_id: string;
          to_stage: string;
        };
        Insert: {
          defect_note?: string | null;
          from_stage: string;
          id?: string;
          inspector_staff_id?: string | null;
          occurred_at?: string;
          piece_id: string;
          recorded_by_staff_id?: string | null;
          retailer_id: string;
          to_stage: string;
        };
        Update: {
          defect_note?: string | null;
          from_stage?: string;
          id?: string;
          inspector_staff_id?: string | null;
          occurred_at?: string;
          piece_id?: string;
          recorded_by_staff_id?: string | null;
          retailer_id?: string;
          to_stage?: string;
        };
        Relationships: [
          {
            foreignKeyName: "production_stage_events_inspector_staff_id_fkey";
            columns: ["inspector_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "production_stage_events_piece_id_fkey";
            columns: ["piece_id"];
            isOneToOne: false;
            referencedRelation: "production_pieces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "production_stage_events_recorded_by_staff_id_fkey";
            columns: ["recorded_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "production_stage_events_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      production_work_tickets: {
        Row: {
          assigned_outworker_reference: string | null;
          created_at: string;
          due_on: string;
          id: string;
          instructions: string;
          issued_at: string;
          piece_id: string;
          retailer_id: string;
          returned_at: string | null;
          updated_at: string;
        };
        Insert: {
          assigned_outworker_reference?: string | null;
          created_at?: string;
          due_on: string;
          id?: string;
          instructions: string;
          issued_at?: string;
          piece_id: string;
          retailer_id: string;
          returned_at?: string | null;
          updated_at?: string;
        };
        Update: {
          assigned_outworker_reference?: string | null;
          created_at?: string;
          due_on?: string;
          id?: string;
          instructions?: string;
          issued_at?: string;
          piece_id?: string;
          retailer_id?: string;
          returned_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "production_work_tickets_piece_id_fkey";
            columns: ["piece_id"];
            isOneToOne: false;
            referencedRelation: "production_pieces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "production_work_tickets_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          description: string;
          id: string;
          is_alterable: boolean;
          is_made_to_order: boolean;
          name: string;
          primary_image_url: string | null;
          retailer_id: string;
          slug: string;
          status: Database["public"]["Enums"]["product_status"];
          swatch_image_url: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          description?: string;
          id?: string;
          is_alterable?: boolean;
          is_made_to_order?: boolean;
          name: string;
          primary_image_url?: string | null;
          retailer_id: string;
          slug: string;
          status?: Database["public"]["Enums"]["product_status"];
          swatch_image_url?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          description?: string;
          id?: string;
          is_alterable?: boolean;
          is_made_to_order?: boolean;
          name?: string;
          primary_image_url?: string | null;
          retailer_id?: string;
          slug?: string;
          status?: Database["public"]["Enums"]["product_status"];
          swatch_image_url?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      prospect_demo_configuration_versions: {
        Row: {
          change_note: string;
          changed_by_user_id: string | null;
          configuration_id: string;
          created_at: string;
          id: string;
          snapshot: Json;
          version_number: number;
        };
        Insert: {
          change_note: string;
          changed_by_user_id?: string | null;
          configuration_id: string;
          created_at?: string;
          id?: string;
          snapshot: Json;
          version_number: number;
        };
        Update: {
          change_note?: string;
          changed_by_user_id?: string | null;
          configuration_id?: string;
          created_at?: string;
          id?: string;
          snapshot?: Json;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "prospect_demo_configuration_versions_configuration_id_fkey";
            columns: ["configuration_id"];
            isOneToOne: false;
            referencedRelation: "prospect_demo_configurations";
            referencedColumns: ["id"];
          },
        ];
      };
      prospect_demo_configurations: {
        Row: {
          created_at: string;
          current_version: number;
          id: string;
          locations: Json;
          marketing_headline: string;
          personalized_introduction: string;
          plan_id: string | null;
          product_image_urls: string[];
          product_mix: string[];
          prospect_id: string;
          status: Database["public"]["Enums"]["demo_configuration_status"];
          theme: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          current_version?: number;
          id?: string;
          locations?: Json;
          marketing_headline?: string;
          personalized_introduction?: string;
          plan_id?: string | null;
          product_image_urls?: string[];
          product_mix?: string[];
          prospect_id: string;
          status?: Database["public"]["Enums"]["demo_configuration_status"];
          theme?: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          current_version?: number;
          id?: string;
          locations?: Json;
          marketing_headline?: string;
          personalized_introduction?: string;
          plan_id?: string | null;
          product_image_urls?: string[];
          product_mix?: string[];
          prospect_id?: string;
          status?: Database["public"]["Enums"]["demo_configuration_status"];
          theme?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prospect_demo_configurations_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prospect_demo_configurations_prospect_id_fkey";
            columns: ["prospect_id"];
            isOneToOne: true;
            referencedRelation: "commercial_prospects";
            referencedColumns: ["id"];
          },
        ];
      };
      prospect_demo_engagement_events: {
        Row: {
          environment_id: string;
          event_name: string;
          id: string;
          occurred_at: string;
        };
        Insert: {
          environment_id: string;
          event_name: string;
          id?: string;
          occurred_at?: string;
        };
        Update: {
          environment_id?: string;
          event_name?: string;
          id?: string;
          occurred_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prospect_demo_engagement_events_environment_id_fkey";
            columns: ["environment_id"];
            isOneToOne: false;
            referencedRelation: "prospect_demo_environments";
            referencedColumns: ["id"];
          },
        ];
      };
      prospect_demo_environments: {
        Row: {
          access_code_hash: string | null;
          configuration_id: string;
          configuration_version: number;
          created_at: string;
          created_by_user_id: string | null;
          expires_at: string;
          founder_outreach_pack: string | null;
          generated_at: string;
          id: string;
          prospect_id: string;
          public_token: string;
          published_at: string | null;
          retailer_id: string | null;
          retailer_slug: string | null;
          revoked_at: string | null;
          status: Database["public"]["Enums"]["prospect_demo_environment_status"];
          synthetic_data: Json;
          updated_at: string;
        };
        Insert: {
          access_code_hash?: string | null;
          configuration_id: string;
          configuration_version: number;
          created_at?: string;
          created_by_user_id?: string | null;
          expires_at: string;
          founder_outreach_pack?: string | null;
          generated_at?: string;
          id?: string;
          prospect_id: string;
          public_token: string;
          published_at?: string | null;
          retailer_id?: string | null;
          retailer_slug?: string | null;
          revoked_at?: string | null;
          status?: Database["public"]["Enums"]["prospect_demo_environment_status"];
          synthetic_data: Json;
          updated_at?: string;
        };
        Update: {
          access_code_hash?: string | null;
          configuration_id?: string;
          configuration_version?: number;
          created_at?: string;
          created_by_user_id?: string | null;
          expires_at?: string;
          founder_outreach_pack?: string | null;
          generated_at?: string;
          id?: string;
          prospect_id?: string;
          public_token?: string;
          published_at?: string | null;
          retailer_id?: string | null;
          retailer_slug?: string | null;
          revoked_at?: string | null;
          status?: Database["public"]["Enums"]["prospect_demo_environment_status"];
          synthetic_data?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prospect_demo_environments_configuration_id_fkey";
            columns: ["configuration_id"];
            isOneToOne: false;
            referencedRelation: "prospect_demo_configurations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prospect_demo_environments_prospect_id_fkey";
            columns: ["prospect_id"];
            isOneToOne: true;
            referencedRelation: "commercial_prospects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prospect_demo_environments_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      prospect_demo_modules: {
        Row: {
          configuration_id: string;
          feature_key: string;
        };
        Insert: {
          configuration_id: string;
          feature_key: string;
        };
        Update: {
          configuration_id?: string;
          feature_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prospect_demo_modules_configuration_id_fkey";
            columns: ["configuration_id"];
            isOneToOne: false;
            referencedRelation: "prospect_demo_configurations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prospect_demo_modules_feature_key_fkey";
            columns: ["feature_key"];
            isOneToOne: false;
            referencedRelation: "commercial_features";
            referencedColumns: ["key"];
          },
        ];
      };
      prospect_demo_previews: {
        Row: {
          created_at: string;
          device: string;
          environment_id: string;
          id: string;
          preview_data: Json;
          role: string;
        };
        Insert: {
          created_at?: string;
          device: string;
          environment_id: string;
          id?: string;
          preview_data: Json;
          role: string;
        };
        Update: {
          created_at?: string;
          device?: string;
          environment_id?: string;
          id?: string;
          preview_data?: Json;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prospect_demo_previews_environment_id_fkey";
            columns: ["environment_id"];
            isOneToOne: false;
            referencedRelation: "prospect_demo_environments";
            referencedColumns: ["id"];
          },
        ];
      };
      referrals: {
        Row: {
          code: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          referred_customer_id: string | null;
          referred_email: string;
          referring_customer_id: string;
          retailer_id: string;
          reward_id: string | null;
          status: Database["public"]["Enums"]["referral_status"];
          updated_at: string;
        };
        Insert: {
          code?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          referred_customer_id?: string | null;
          referred_email: string;
          referring_customer_id: string;
          retailer_id: string;
          reward_id?: string | null;
          status?: Database["public"]["Enums"]["referral_status"];
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          referred_customer_id?: string | null;
          referred_email?: string;
          referring_customer_id?: string;
          retailer_id?: string;
          reward_id?: string | null;
          status?: Database["public"]["Enums"]["referral_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "referrals_referred_customer_id_fkey";
            columns: ["referred_customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referrals_referring_customer_id_fkey";
            columns: ["referring_customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referrals_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referrals_reward_id_fkey";
            columns: ["reward_id"];
            isOneToOne: false;
            referencedRelation: "rewards";
            referencedColumns: ["id"];
          },
        ];
      };
      retailer_alteration_category_settings: {
        Row: {
          category_id: string;
          enabled: boolean;
          retailer_id: string;
          updated_at: string;
          updated_by_staff_id: string | null;
        };
        Insert: {
          category_id: string;
          enabled?: boolean;
          retailer_id: string;
          updated_at?: string;
          updated_by_staff_id?: string | null;
        };
        Update: {
          category_id?: string;
          enabled?: boolean;
          retailer_id?: string;
          updated_at?: string;
          updated_by_staff_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "retailer_alteration_category_settings_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "alteration_catalogue_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "retailer_alteration_category_settings_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "retailer_alteration_category_settings_updated_by_staff_id_fkey";
            columns: ["updated_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
      retailer_alteration_operation_settings: {
        Row: {
          enabled: boolean;
          operation_id: string;
          retailer_id: string;
          updated_at: string;
          updated_by_staff_id: string | null;
        };
        Insert: {
          enabled?: boolean;
          operation_id: string;
          retailer_id: string;
          updated_at?: string;
          updated_by_staff_id?: string | null;
        };
        Update: {
          enabled?: boolean;
          operation_id?: string;
          retailer_id?: string;
          updated_at?: string;
          updated_by_staff_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "retailer_alteration_operation_settings_operation_id_fkey";
            columns: ["operation_id"];
            isOneToOne: false;
            referencedRelation: "alteration_operations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "retailer_alteration_operation_settings_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "retailer_alteration_operation_settings_updated_by_staff_id_fkey";
            columns: ["updated_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
      retailer_branches: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          is_default: boolean;
          name: string;
          retailer_id: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_default?: boolean;
          name: string;
          retailer_id: string;
          timezone: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          retailer_id?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "retailer_branches_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      retailer_brand_theme_versions: {
        Row: {
          change_note: string;
          changed_by_user_id: string | null;
          created_at: string;
          id: string;
          retailer_id: string;
          theme: Json;
          version_number: number;
        };
        Insert: {
          change_note: string;
          changed_by_user_id?: string | null;
          created_at?: string;
          id?: string;
          retailer_id: string;
          theme: Json;
          version_number: number;
        };
        Update: {
          change_note?: string;
          changed_by_user_id?: string | null;
          created_at?: string;
          id?: string;
          retailer_id?: string;
          theme?: Json;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "retailer_brand_theme_versions_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      retailer_concept_overrides: {
        Row: {
          concept_id: string;
          created_at: string;
          deleted_at: string | null;
          display_name: string | null;
          id: string;
          image_url_override: string | null;
          is_hidden: boolean;
          priority_override: number | null;
          retailer_id: string;
          summary_override: string | null;
          updated_at: string;
        };
        Insert: {
          concept_id: string;
          created_at?: string;
          deleted_at?: string | null;
          display_name?: string | null;
          id?: string;
          image_url_override?: string | null;
          is_hidden?: boolean;
          priority_override?: number | null;
          retailer_id: string;
          summary_override?: string | null;
          updated_at?: string;
        };
        Update: {
          concept_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          display_name?: string | null;
          id?: string;
          image_url_override?: string | null;
          is_hidden?: boolean;
          priority_override?: number | null;
          retailer_id?: string;
          summary_override?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "retailer_concept_overrides_concept_id_fkey";
            columns: ["concept_id"];
            isOneToOne: false;
            referencedRelation: "metadata_concepts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "retailer_concept_overrides_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      retailer_entitlement_overrides: {
        Row: {
          created_at: string;
          enabled: boolean;
          expires_at: string | null;
          feature_key: string;
          reason: string | null;
          retailer_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          enabled: boolean;
          expires_at?: string | null;
          feature_key: string;
          reason?: string | null;
          retailer_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          expires_at?: string | null;
          feature_key?: string;
          reason?: string | null;
          retailer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "retailer_entitlement_overrides_feature_key_fkey";
            columns: ["feature_key"];
            isOneToOne: false;
            referencedRelation: "commercial_features";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "retailer_entitlement_overrides_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      retailer_events: {
        Row: {
          capacity: number | null;
          created_at: string;
          deleted_at: string | null;
          description: string;
          ends_at: string;
          id: string;
          name: string;
          retailer_id: string;
          starts_at: string;
          status: Database["public"]["Enums"]["event_status"];
          updated_at: string;
          venue_address: string | null;
          venue_name: string;
          visibility: Database["public"]["Enums"]["event_visibility"];
        };
        Insert: {
          capacity?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          description: string;
          ends_at: string;
          id?: string;
          name: string;
          retailer_id: string;
          starts_at: string;
          status?: Database["public"]["Enums"]["event_status"];
          updated_at?: string;
          venue_address?: string | null;
          venue_name: string;
          visibility?: Database["public"]["Enums"]["event_visibility"];
        };
        Update: {
          capacity?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string;
          ends_at?: string;
          id?: string;
          name?: string;
          retailer_id?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["event_status"];
          updated_at?: string;
          venue_address?: string | null;
          venue_name?: string;
          visibility?: Database["public"]["Enums"]["event_visibility"];
        };
        Relationships: [
          {
            foreignKeyName: "retailer_events_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      retailer_familiarity_settings: {
        Row: {
          created_at: string;
          preset_key: string;
          retailer_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          preset_key: string;
          retailer_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          preset_key?: string;
          retailer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "retailer_familiarity_settings_preset_key_fkey";
            columns: ["preset_key"];
            isOneToOne: false;
            referencedRelation: "familiarity_presets";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "retailer_familiarity_settings_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: true;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      retailer_knowledge_overrides: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          display_title: string | null;
          id: string;
          image_url_override: string | null;
          is_hidden: boolean;
          is_pinned: boolean;
          knowledge_object_id: string;
          priority_override: number | null;
          retailer_id: string;
          summary_override: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          display_title?: string | null;
          id?: string;
          image_url_override?: string | null;
          is_hidden?: boolean;
          is_pinned?: boolean;
          knowledge_object_id: string;
          priority_override?: number | null;
          retailer_id: string;
          summary_override?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          display_title?: string | null;
          id?: string;
          image_url_override?: string | null;
          is_hidden?: boolean;
          is_pinned?: boolean;
          knowledge_object_id?: string;
          priority_override?: number | null;
          retailer_id?: string;
          summary_override?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "retailer_knowledge_overrides_knowledge_object_id_fkey";
            columns: ["knowledge_object_id"];
            isOneToOne: false;
            referencedRelation: "knowledge_objects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "retailer_knowledge_overrides_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      retailer_module_configuration_events: {
        Row: {
          changed_by_user_id: string | null;
          id: string;
          module_key: string;
          next_authority_mode: string;
          next_state: string;
          occurred_at: string;
          previous_authority_mode: string | null;
          previous_state: string | null;
          reason: string | null;
          retailer_id: string;
          source: string;
        };
        Insert: {
          changed_by_user_id?: string | null;
          id?: string;
          module_key: string;
          next_authority_mode: string;
          next_state: string;
          occurred_at?: string;
          previous_authority_mode?: string | null;
          previous_state?: string | null;
          reason?: string | null;
          retailer_id: string;
          source: string;
        };
        Update: {
          changed_by_user_id?: string | null;
          id?: string;
          module_key?: string;
          next_authority_mode?: string;
          next_state?: string;
          occurred_at?: string;
          previous_authority_mode?: string | null;
          previous_state?: string | null;
          reason?: string | null;
          retailer_id?: string;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: "retailer_module_configuration_events_module_key_fkey";
            columns: ["module_key"];
            isOneToOne: false;
            referencedRelation: "platform_modules";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "retailer_module_configuration_events_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      retailer_module_configurations: {
        Row: {
          authority_mode: string;
          configured_by_user_id: string | null;
          created_at: string;
          id: string;
          module_key: string;
          reason: string | null;
          retailer_id: string;
          source: string;
          state: string;
          updated_at: string;
        };
        Insert: {
          authority_mode: string;
          configured_by_user_id?: string | null;
          created_at?: string;
          id?: string;
          module_key: string;
          reason?: string | null;
          retailer_id: string;
          source: string;
          state: string;
          updated_at?: string;
        };
        Update: {
          authority_mode?: string;
          configured_by_user_id?: string | null;
          created_at?: string;
          id?: string;
          module_key?: string;
          reason?: string | null;
          retailer_id?: string;
          source?: string;
          state?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "retailer_module_configurations_module_key_fkey";
            columns: ["module_key"];
            isOneToOne: false;
            referencedRelation: "platform_modules";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "retailer_module_configurations_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      retailer_staff_members: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          deleted_at: string | null;
          email: string;
          full_name: string;
          id: string;
          invited_at: string;
          retailer_id: string;
          role: Database["public"]["Enums"]["retailer_role"];
          updated_at: string;
          user_id: string | null;
          workshop_id: string | null;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email: string;
          full_name: string;
          id?: string;
          invited_at?: string;
          retailer_id: string;
          role?: Database["public"]["Enums"]["retailer_role"];
          updated_at?: string;
          user_id?: string | null;
          workshop_id?: string | null;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          invited_at?: string;
          retailer_id?: string;
          role?: Database["public"]["Enums"]["retailer_role"];
          updated_at?: string;
          user_id?: string | null;
          workshop_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "retailer_staff_members_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "retailer_staff_members_workshop_id_fkey";
            columns: ["workshop_id"];
            isOneToOne: false;
            referencedRelation: "workshops";
            referencedColumns: ["id"];
          },
        ];
      };
      retailer_stripe_accounts: {
        Row: {
          charges_enabled: boolean;
          created_at: string;
          details_submitted: boolean;
          payouts_enabled: boolean;
          platform_fee_basis_points: number;
          retailer_id: string;
          stripe_account_id: string;
          updated_at: string;
        };
        Insert: {
          charges_enabled?: boolean;
          created_at?: string;
          details_submitted?: boolean;
          payouts_enabled?: boolean;
          platform_fee_basis_points?: number;
          retailer_id: string;
          stripe_account_id: string;
          updated_at?: string;
        };
        Update: {
          charges_enabled?: boolean;
          created_at?: string;
          details_submitted?: boolean;
          payouts_enabled?: boolean;
          platform_fee_basis_points?: number;
          retailer_id?: string;
          stripe_account_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "retailer_stripe_accounts_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: true;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      retailer_subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          id: string;
          plan_id: string;
          provider_customer_id: string | null;
          provider_subscription_id: string | null;
          retailer_id: string;
          status: Database["public"]["Enums"]["subscription_status"];
          trial_ends_at: string | null;
          updated_at: string;
        };
        Insert: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          plan_id: string;
          provider_customer_id?: string | null;
          provider_subscription_id?: string | null;
          retailer_id: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          plan_id?: string;
          provider_customer_id?: string | null;
          provider_subscription_id?: string | null;
          retailer_id?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "retailer_subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "retailer_subscriptions_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: true;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      retailers: {
        Row: {
          billing_address: Json;
          brand_theme: Json;
          created_at: string;
          default_currency: string;
          default_locale: string;
          deleted_at: string | null;
          display_name: string;
          id: string;
          legal_name: string;
          primary_domain: string | null;
          slug: string;
          status: Database["public"]["Enums"]["retailer_status"];
          tier: Database["public"]["Enums"]["retailer_tier"];
          updated_at: string;
        };
        Insert: {
          billing_address?: Json;
          brand_theme?: Json;
          created_at?: string;
          default_currency?: string;
          default_locale?: string;
          deleted_at?: string | null;
          display_name: string;
          id?: string;
          legal_name: string;
          primary_domain?: string | null;
          slug: string;
          status?: Database["public"]["Enums"]["retailer_status"];
          tier?: Database["public"]["Enums"]["retailer_tier"];
          updated_at?: string;
        };
        Update: {
          billing_address?: Json;
          brand_theme?: Json;
          created_at?: string;
          default_currency?: string;
          default_locale?: string;
          deleted_at?: string | null;
          display_name?: string;
          id?: string;
          legal_name?: string;
          primary_domain?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["retailer_status"];
          tier?: Database["public"]["Enums"]["retailer_tier"];
          updated_at?: string;
        };
        Relationships: [];
      };
      revenue_share_entries: {
        Row: {
          amount_minor_units: number;
          created_at: string;
          currency: string;
          id: string;
          party: string;
          retailer_id: string;
          reverses_entry_id: string | null;
          source_event_id: string | null;
        };
        Insert: {
          amount_minor_units: number;
          created_at?: string;
          currency?: string;
          id?: string;
          party: string;
          retailer_id: string;
          reverses_entry_id?: string | null;
          source_event_id?: string | null;
        };
        Update: {
          amount_minor_units?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          party?: string;
          retailer_id?: string;
          reverses_entry_id?: string | null;
          source_event_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "revenue_share_entries_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "revenue_share_entries_reverses_entry_id_fkey";
            columns: ["reverses_entry_id"];
            isOneToOne: false;
            referencedRelation: "revenue_share_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "revenue_share_entries_source_event_id_fkey";
            columns: ["source_event_id"];
            isOneToOne: false;
            referencedRelation: "advertising_events";
            referencedColumns: ["id"];
          },
        ];
      };
      reward_redemptions: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          loyalty_account_id: string;
          points_spent: number;
          reward_id: string;
          status: Database["public"]["Enums"]["redemption_status"];
          used_at: string | null;
        };
        Insert: {
          code?: string;
          created_at?: string;
          id?: string;
          loyalty_account_id: string;
          points_spent: number;
          reward_id: string;
          status?: Database["public"]["Enums"]["redemption_status"];
          used_at?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          loyalty_account_id?: string;
          points_spent?: number;
          reward_id?: string;
          status?: Database["public"]["Enums"]["redemption_status"];
          used_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_loyalty_account_id_fkey";
            columns: ["loyalty_account_id"];
            isOneToOne: false;
            referencedRelation: "loyalty_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reward_redemptions_reward_id_fkey";
            columns: ["reward_id"];
            isOneToOne: false;
            referencedRelation: "rewards";
            referencedColumns: ["id"];
          },
        ];
      };
      rewards: {
        Row: {
          active: boolean;
          created_at: string;
          deleted_at: string | null;
          id: string;
          minimum_tier: Database["public"]["Enums"]["loyalty_tier"] | null;
          name: string;
          points_cost: number;
          retailer_id: string;
          type: Database["public"]["Enums"]["reward_type"];
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          minimum_tier?: Database["public"]["Enums"]["loyalty_tier"] | null;
          name: string;
          points_cost: number;
          retailer_id: string;
          type: Database["public"]["Enums"]["reward_type"];
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          minimum_tier?: Database["public"]["Enums"]["loyalty_tier"] | null;
          name?: string;
          points_cost?: number;
          retailer_id?: string;
          type?: Database["public"]["Enums"]["reward_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rewards_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      rfid_sweep_discrepancies: {
        Row: {
          created_at: string;
          epc: string;
          id: string;
          kind: string;
          resolution_note: string | null;
          resolved_at: string | null;
          retailer_id: string;
          sweep_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          epc: string;
          id?: string;
          kind: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          retailer_id: string;
          sweep_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          epc?: string;
          id?: string;
          kind?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          retailer_id?: string;
          sweep_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rfid_sweep_discrepancies_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      rfid_sweep_observations: {
        Row: {
          created_at: string;
          epc: string;
          id: string;
          location_id: string;
          observed_at: string;
          read_confidence: number;
          retailer_id: string;
          sweep_id: string;
          zone_key: string;
        };
        Insert: {
          created_at?: string;
          epc: string;
          id?: string;
          location_id: string;
          observed_at?: string;
          read_confidence: number;
          retailer_id: string;
          sweep_id: string;
          zone_key: string;
        };
        Update: {
          created_at?: string;
          epc?: string;
          id?: string;
          location_id?: string;
          observed_at?: string;
          read_confidence?: number;
          retailer_id?: string;
          sweep_id?: string;
          zone_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rfid_observations_location_same_retailer_fk";
            columns: ["retailer_id", "location_id"];
            isOneToOne: false;
            referencedRelation: "stock_locations";
            referencedColumns: ["retailer_id", "id"];
          },
          {
            foreignKeyName: "rfid_sweep_observations_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "stock_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rfid_sweep_observations_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      sartorial_rules: {
        Row: {
          created_at: string;
          created_by_staff_id: string | null;
          deleted_at: string | null;
          explanation: string;
          id: string;
          knowledge_object_id: string | null;
          object_concept_id: string | null;
          object_slot_kind: string | null;
          ownership_kind: string;
          relation: string;
          retailer_id: string | null;
          review_status: string;
          reviewed_at: string | null;
          reviewed_by_staff_id: string | null;
          rule_kind: string;
          slug: string;
          subject_concept_id: string | null;
          subject_slot_kind: string | null;
          summary: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by_staff_id?: string | null;
          deleted_at?: string | null;
          explanation: string;
          id?: string;
          knowledge_object_id?: string | null;
          object_concept_id?: string | null;
          object_slot_kind?: string | null;
          ownership_kind: string;
          relation: string;
          retailer_id?: string | null;
          review_status?: string;
          reviewed_at?: string | null;
          reviewed_by_staff_id?: string | null;
          rule_kind: string;
          slug: string;
          subject_concept_id?: string | null;
          subject_slot_kind?: string | null;
          summary: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by_staff_id?: string | null;
          deleted_at?: string | null;
          explanation?: string;
          id?: string;
          knowledge_object_id?: string | null;
          object_concept_id?: string | null;
          object_slot_kind?: string | null;
          ownership_kind?: string;
          relation?: string;
          retailer_id?: string | null;
          review_status?: string;
          reviewed_at?: string | null;
          reviewed_by_staff_id?: string | null;
          rule_kind?: string;
          slug?: string;
          subject_concept_id?: string | null;
          subject_slot_kind?: string | null;
          summary?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sartorial_rules_created_by_staff_id_fkey";
            columns: ["created_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sartorial_rules_knowledge_object_id_fkey";
            columns: ["knowledge_object_id"];
            isOneToOne: false;
            referencedRelation: "knowledge_objects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sartorial_rules_object_concept_id_fkey";
            columns: ["object_concept_id"];
            isOneToOne: false;
            referencedRelation: "metadata_concepts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sartorial_rules_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sartorial_rules_reviewed_by_staff_id_fkey";
            columns: ["reviewed_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sartorial_rules_subject_concept_id_fkey";
            columns: ["subject_concept_id"];
            isOneToOne: false;
            referencedRelation: "metadata_concepts";
            referencedColumns: ["id"];
          },
        ];
      };
      service_bookings: {
        Row: {
          advisor_staff_id: string | null;
          appointment_id: string | null;
          commitment_notes: string | null;
          created_at: string;
          customer_id: string;
          entitlement_entry_id: string | null;
          id: string;
          kind: string;
          membership_id: string;
          notes: string | null;
          plan_id: string;
          request_idempotency_key: string;
          requested_for: string | null;
          retailer_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          advisor_staff_id?: string | null;
          appointment_id?: string | null;
          commitment_notes?: string | null;
          created_at?: string;
          customer_id: string;
          entitlement_entry_id?: string | null;
          id?: string;
          kind: string;
          membership_id: string;
          notes?: string | null;
          plan_id: string;
          request_idempotency_key: string;
          requested_for?: string | null;
          retailer_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          advisor_staff_id?: string | null;
          appointment_id?: string | null;
          commitment_notes?: string | null;
          created_at?: string;
          customer_id?: string;
          entitlement_entry_id?: string | null;
          id?: string;
          kind?: string;
          membership_id?: string;
          notes?: string | null;
          plan_id?: string;
          request_idempotency_key?: string;
          requested_for?: string | null;
          retailer_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_bookings_advisor_staff_id_fkey";
            columns: ["advisor_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_bookings_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_bookings_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_bookings_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "service_bookings_entitlement_entry_fk";
            columns: ["entitlement_entry_id"];
            isOneToOne: false;
            referencedRelation: "service_entitlement_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_bookings_membership_fk";
            columns: ["membership_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "service_memberships";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "service_bookings_plan_fk";
            columns: ["plan_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "service_plans";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "service_bookings_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      service_care_records: {
        Row: {
          alteration_id: string | null;
          booking_id: string | null;
          care_kind: string;
          created_at: string;
          customer_id: string;
          id: string;
          membership_id: string;
          physical_garment_id: string | null;
          recorded_by_staff_id: string | null;
          retailer_id: string;
          summary: string;
          wardrobe_item_id: string | null;
        };
        Insert: {
          alteration_id?: string | null;
          booking_id?: string | null;
          care_kind: string;
          created_at?: string;
          customer_id: string;
          id?: string;
          membership_id: string;
          physical_garment_id?: string | null;
          recorded_by_staff_id?: string | null;
          retailer_id: string;
          summary: string;
          wardrobe_item_id?: string | null;
        };
        Update: {
          alteration_id?: string | null;
          booking_id?: string | null;
          care_kind?: string;
          created_at?: string;
          customer_id?: string;
          id?: string;
          membership_id?: string;
          physical_garment_id?: string | null;
          recorded_by_staff_id?: string | null;
          retailer_id?: string;
          summary?: string;
          wardrobe_item_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "service_care_records_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_care_records_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "customer_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_care_records_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "worker_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_care_records_booking_fk";
            columns: ["booking_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "service_bookings";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "service_care_records_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_care_records_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "service_care_records_membership_fk";
            columns: ["membership_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "service_memberships";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "service_care_records_physical_garment_id_fkey";
            columns: ["physical_garment_id"];
            isOneToOne: false;
            referencedRelation: "physical_garments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_care_records_recorded_by_staff_id_fkey";
            columns: ["recorded_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_care_records_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_care_records_wardrobe_item_id_fkey";
            columns: ["wardrobe_item_id"];
            isOneToOne: false;
            referencedRelation: "wardrobe_items";
            referencedColumns: ["id"];
          },
        ];
      };
      service_ceremony_versions: {
        Row: {
          ceremony_key: string;
          created_at: string;
          id: string;
          published: boolean;
          published_at: string | null;
          retailer_id: string;
          steps: Json;
          updated_at: string;
          version: number;
        };
        Insert: {
          ceremony_key: string;
          created_at?: string;
          id?: string;
          published?: boolean;
          published_at?: string | null;
          retailer_id: string;
          steps?: Json;
          updated_at?: string;
          version: number;
        };
        Update: {
          ceremony_key?: string;
          created_at?: string;
          id?: string;
          published?: boolean;
          published_at?: string | null;
          retailer_id?: string;
          steps?: Json;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "service_ceremony_versions_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      service_cost_records: {
        Row: {
          amount_minor_units: number;
          booking_id: string | null;
          created_at: string;
          currency: string;
          customer_id: string;
          id: string;
          label: string;
          membership_id: string;
          notes: string | null;
          recorded_by_staff_id: string | null;
          retailer_id: string;
        };
        Insert: {
          amount_minor_units: number;
          booking_id?: string | null;
          created_at?: string;
          currency: string;
          customer_id: string;
          id?: string;
          label: string;
          membership_id: string;
          notes?: string | null;
          recorded_by_staff_id?: string | null;
          retailer_id: string;
        };
        Update: {
          amount_minor_units?: number;
          booking_id?: string | null;
          created_at?: string;
          currency?: string;
          customer_id?: string;
          id?: string;
          label?: string;
          membership_id?: string;
          notes?: string | null;
          recorded_by_staff_id?: string | null;
          retailer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_cost_records_booking_fk";
            columns: ["booking_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "service_bookings";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "service_cost_records_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_cost_records_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "service_cost_records_membership_fk";
            columns: ["membership_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "service_memberships";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "service_cost_records_recorded_by_staff_id_fkey";
            columns: ["recorded_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_cost_records_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      service_entitlement_entries: {
        Row: {
          booking_id: string | null;
          created_at: string;
          created_by_staff_id: string | null;
          customer_id: string;
          entitlement_id: string;
          entry_kind: string;
          id: string;
          idempotency_key: string;
          membership_id: string;
          notes: string | null;
          quantity: number;
          retailer_id: string;
        };
        Insert: {
          booking_id?: string | null;
          created_at?: string;
          created_by_staff_id?: string | null;
          customer_id: string;
          entitlement_id: string;
          entry_kind: string;
          id?: string;
          idempotency_key: string;
          membership_id: string;
          notes?: string | null;
          quantity: number;
          retailer_id: string;
        };
        Update: {
          booking_id?: string | null;
          created_at?: string;
          created_by_staff_id?: string | null;
          customer_id?: string;
          entitlement_id?: string;
          entry_kind?: string;
          id?: string;
          idempotency_key?: string;
          membership_id?: string;
          notes?: string | null;
          quantity?: number;
          retailer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_entitlement_entries_booking_fk";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "service_bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_entitlement_entries_created_by_staff_id_fkey";
            columns: ["created_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_entitlement_entries_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_entitlement_entries_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "service_entitlement_entries_entitlement_fk";
            columns: ["entitlement_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "service_entitlements";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "service_entitlement_entries_membership_fk";
            columns: ["membership_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "service_memberships";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "service_entitlement_entries_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      service_entitlements: {
        Row: {
          created_at: string;
          customer_id: string;
          id: string;
          kind: string;
          membership_id: string;
          remaining_quantity: number;
          retailer_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          id?: string;
          kind: string;
          membership_id: string;
          remaining_quantity: number;
          retailer_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          id?: string;
          kind?: string;
          membership_id?: string;
          remaining_quantity?: number;
          retailer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_entitlements_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_entitlements_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "service_entitlements_membership_fk";
            columns: ["membership_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "service_memberships";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "service_entitlements_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      service_fulfilment_events: {
        Row: {
          booking_id: string;
          created_at: string;
          customer_id: string;
          id: string;
          method: string;
          notes: string | null;
          recorded_by_staff_id: string | null;
          retailer_id: string;
          scheduled_for: string | null;
          status: string;
        };
        Insert: {
          booking_id: string;
          created_at?: string;
          customer_id: string;
          id?: string;
          method: string;
          notes?: string | null;
          recorded_by_staff_id?: string | null;
          retailer_id: string;
          scheduled_for?: string | null;
          status?: string;
        };
        Update: {
          booking_id?: string;
          created_at?: string;
          customer_id?: string;
          id?: string;
          method?: string;
          notes?: string | null;
          recorded_by_staff_id?: string | null;
          retailer_id?: string;
          scheduled_for?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_fulfilment_events_booking_fk";
            columns: ["booking_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "service_bookings";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "service_fulfilment_events_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_fulfilment_events_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "service_fulfilment_events_recorded_by_staff_id_fkey";
            columns: ["recorded_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_fulfilment_events_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      service_history_events: {
        Row: {
          booking_id: string | null;
          created_at: string;
          customer_id: string;
          id: string;
          kind: string;
          membership_id: string | null;
          recorded_by_staff_id: string | null;
          retailer_id: string;
          summary: string;
        };
        Insert: {
          booking_id?: string | null;
          created_at?: string;
          customer_id: string;
          id?: string;
          kind: string;
          membership_id?: string | null;
          recorded_by_staff_id?: string | null;
          retailer_id: string;
          summary: string;
        };
        Update: {
          booking_id?: string | null;
          created_at?: string;
          customer_id?: string;
          id?: string;
          kind?: string;
          membership_id?: string | null;
          recorded_by_staff_id?: string | null;
          retailer_id?: string;
          summary?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_history_events_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_history_events_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "service_history_events_recorded_by_staff_id_fkey";
            columns: ["recorded_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_history_events_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      service_memberships: {
        Row: {
          advisor_staff_id: string | null;
          commitment_notes: string | null;
          created_at: string;
          customer_id: string;
          ended_at: string | null;
          id: string;
          plan_id: string;
          retailer_id: string;
          started_at: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          advisor_staff_id?: string | null;
          commitment_notes?: string | null;
          created_at?: string;
          customer_id: string;
          ended_at?: string | null;
          id?: string;
          plan_id: string;
          retailer_id: string;
          started_at?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          advisor_staff_id?: string | null;
          commitment_notes?: string | null;
          created_at?: string;
          customer_id?: string;
          ended_at?: string | null;
          id?: string;
          plan_id?: string;
          retailer_id?: string;
          started_at?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_memberships_advisor_staff_id_fkey";
            columns: ["advisor_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_memberships_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_memberships_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "service_memberships_plan_fk";
            columns: ["plan_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "service_plans";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "service_memberships_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      service_partner_custody_events: {
        Row: {
          actor_staff_id: string | null;
          condition_note: string | null;
          engagement_id: string;
          from_state: string;
          id: string;
          occurred_at: string;
          retailer_id: string;
          to_state: string;
        };
        Insert: {
          actor_staff_id?: string | null;
          condition_note?: string | null;
          engagement_id: string;
          from_state: string;
          id?: string;
          occurred_at?: string;
          retailer_id: string;
          to_state: string;
        };
        Update: {
          actor_staff_id?: string | null;
          condition_note?: string | null;
          engagement_id?: string;
          from_state?: string;
          id?: string;
          occurred_at?: string;
          retailer_id?: string;
          to_state?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_partner_custody_events_actor_staff_id_fkey";
            columns: ["actor_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_partner_custody_events_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "service_partner_engagements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_partner_custody_events_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      service_partner_engagements: {
        Row: {
          alteration_id: string | null;
          booking_id: string | null;
          capability: string;
          created_at: string;
          custody_state: string;
          customer_id: string;
          deleted_at: string | null;
          due_on: string;
          id: string;
          instructions: string;
          job_reference: string;
          partner_id: string;
          physical_garment_id: string | null;
          retailer_id: string;
          returned_on: string | null;
          sent_on: string | null;
          updated_at: string;
          wardrobe_item_id: string | null;
        };
        Insert: {
          alteration_id?: string | null;
          booking_id?: string | null;
          capability: string;
          created_at?: string;
          custody_state?: string;
          customer_id: string;
          deleted_at?: string | null;
          due_on: string;
          id?: string;
          instructions: string;
          job_reference: string;
          partner_id: string;
          physical_garment_id?: string | null;
          retailer_id: string;
          returned_on?: string | null;
          sent_on?: string | null;
          updated_at?: string;
          wardrobe_item_id?: string | null;
        };
        Update: {
          alteration_id?: string | null;
          booking_id?: string | null;
          capability?: string;
          created_at?: string;
          custody_state?: string;
          customer_id?: string;
          deleted_at?: string | null;
          due_on?: string;
          id?: string;
          instructions?: string;
          job_reference?: string;
          partner_id?: string;
          physical_garment_id?: string | null;
          retailer_id?: string;
          returned_on?: string | null;
          sent_on?: string | null;
          updated_at?: string;
          wardrobe_item_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "service_partner_engagements_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_partner_engagements_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "customer_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_partner_engagements_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "worker_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_partner_engagements_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "service_bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_partner_engagements_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_partner_engagements_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "service_partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_partner_engagements_physical_garment_id_fkey";
            columns: ["physical_garment_id"];
            isOneToOne: false;
            referencedRelation: "physical_garments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_partner_engagements_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_partner_engagements_wardrobe_item_id_fkey";
            columns: ["wardrobe_item_id"];
            isOneToOne: false;
            referencedRelation: "wardrobe_items";
            referencedColumns: ["id"];
          },
        ];
      };
      service_partner_invoice_lines: {
        Row: {
          amount_minor_units: number;
          created_at: string;
          id: string;
          invoice_id: string;
          job_reference: string;
          matched_cost_record_id: string | null;
          retailer_id: string;
        };
        Insert: {
          amount_minor_units: number;
          created_at?: string;
          id?: string;
          invoice_id: string;
          job_reference: string;
          matched_cost_record_id?: string | null;
          retailer_id: string;
        };
        Update: {
          amount_minor_units?: number;
          created_at?: string;
          id?: string;
          invoice_id?: string;
          job_reference?: string;
          matched_cost_record_id?: string | null;
          retailer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_partner_invoice_lines_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "service_partner_invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_partner_invoice_lines_matched_cost_record_id_fkey";
            columns: ["matched_cost_record_id"];
            isOneToOne: false;
            referencedRelation: "service_cost_records";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_partner_invoice_lines_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      service_partner_invoices: {
        Row: {
          approved_at: string | null;
          approved_by_staff_id: string | null;
          created_at: string;
          currency: string;
          id: string;
          partner_id: string;
          partner_invoice_reference: string;
          period_end: string;
          period_start: string;
          reconciliation: Json;
          retailer_id: string;
          state: string;
          submitted_by_staff_id: string | null;
          updated_at: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by_staff_id?: string | null;
          created_at?: string;
          currency: string;
          id?: string;
          partner_id: string;
          partner_invoice_reference: string;
          period_end: string;
          period_start: string;
          reconciliation?: Json;
          retailer_id: string;
          state?: string;
          submitted_by_staff_id?: string | null;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by_staff_id?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          partner_id?: string;
          partner_invoice_reference?: string;
          period_end?: string;
          period_start?: string;
          reconciliation?: Json;
          retailer_id?: string;
          state?: string;
          submitted_by_staff_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_partner_invoices_approved_by_staff_id_fkey";
            columns: ["approved_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_partner_invoices_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "service_partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_partner_invoices_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_partner_invoices_submitted_by_staff_id_fkey";
            columns: ["submitted_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
      service_partner_quality_reviews: {
        Row: {
          created_at: string;
          customer_note: string | null;
          customer_rating: number | null;
          engagement_id: string;
          id: string;
          partner_id: string;
          retailer_id: string;
          retailer_note: string | null;
          retailer_rating: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          customer_note?: string | null;
          customer_rating?: number | null;
          engagement_id: string;
          id?: string;
          partner_id: string;
          retailer_id: string;
          retailer_note?: string | null;
          retailer_rating?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          customer_note?: string | null;
          customer_rating?: number | null;
          engagement_id?: string;
          id?: string;
          partner_id?: string;
          retailer_id?: string;
          retailer_note?: string | null;
          retailer_rating?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_partner_quality_reviews_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "service_partner_engagements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_partner_quality_reviews_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "service_partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_partner_quality_reviews_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      service_partners: {
        Row: {
          active: boolean;
          branch_id: string | null;
          capabilities: string[];
          contact_email: string | null;
          contact_phone: string | null;
          created_at: string;
          deleted_at: string | null;
          display_name: string;
          id: string;
          retailer_id: string;
          turnaround_days: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          branch_id?: string | null;
          capabilities?: string[];
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          display_name: string;
          id?: string;
          retailer_id: string;
          turnaround_days: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          branch_id?: string | null;
          capabilities?: string[];
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          display_name?: string;
          id?: string;
          retailer_id?: string;
          turnaround_days?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_partners_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "retailer_branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_partners_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      service_plans: {
        Row: {
          created_at: string;
          created_by_staff_id: string | null;
          explanation: string;
          id: string;
          kind: string;
          retailer_id: string;
          status: string;
          summary: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by_staff_id?: string | null;
          explanation: string;
          id?: string;
          kind: string;
          retailer_id: string;
          status?: string;
          summary: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by_staff_id?: string | null;
          explanation?: string;
          id?: string;
          kind?: string;
          retailer_id?: string;
          status?: string;
          summary?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_plans_created_by_staff_id_fkey";
            columns: ["created_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_plans_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      service_recovery_budget_requests: {
        Row: {
          amount_minor_units: number;
          approved_by_staff_id: string | null;
          created_at: string;
          currency: string;
          customer_id: string | null;
          decided_at: string | null;
          decision_note: string | null;
          id: string;
          order_id: string | null;
          reason: string;
          requested_by_staff_id: string;
          retailer_id: string;
          state: string;
          updated_at: string;
        };
        Insert: {
          amount_minor_units: number;
          approved_by_staff_id?: string | null;
          created_at?: string;
          currency?: string;
          customer_id?: string | null;
          decided_at?: string | null;
          decision_note?: string | null;
          id?: string;
          order_id?: string | null;
          reason: string;
          requested_by_staff_id: string;
          retailer_id: string;
          state?: string;
          updated_at?: string;
        };
        Update: {
          amount_minor_units?: number;
          approved_by_staff_id?: string | null;
          created_at?: string;
          currency?: string;
          customer_id?: string | null;
          decided_at?: string | null;
          decision_note?: string | null;
          id?: string;
          order_id?: string | null;
          reason?: string;
          requested_by_staff_id?: string;
          retailer_id?: string;
          state?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_recovery_budget_requests_approved_by_staff_id_fkey";
            columns: ["approved_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_recovery_budget_requests_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_recovery_budget_requests_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_recovery_budget_requests_requested_by_staff_id_fkey";
            columns: ["requested_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_recovery_budget_requests_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      sms_outbox: {
        Row: {
          attempts: number;
          body: string;
          channel: string;
          created_at: string;
          id: string;
          last_error: string | null;
          notification_id: string | null;
          recipient_phone: string;
          sent_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          body: string;
          channel?: string;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          notification_id?: string | null;
          recipient_phone: string;
          sent_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          body?: string;
          channel?: string;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          notification_id?: string | null;
          recipient_phone?: string;
          sent_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sms_outbox_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
        ];
      };
      source_authority_policies: {
        Row: {
          allowed_directions: string[];
          authority: string;
          connection_id: string;
          created_at: string;
          deleted_at: string | null;
          domain: string;
          field_group: string;
          id: string;
          mapping_version: string;
          retailer_id: string;
          updated_at: string;
        };
        Insert: {
          allowed_directions?: string[];
          authority: string;
          connection_id: string;
          created_at?: string;
          deleted_at?: string | null;
          domain: string;
          field_group: string;
          id?: string;
          mapping_version: string;
          retailer_id: string;
          updated_at?: string;
        };
        Update: {
          allowed_directions?: string[];
          authority?: string;
          connection_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          domain?: string;
          field_group?: string;
          id?: string;
          mapping_version?: string;
          retailer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "source_authority_policies_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "integration_connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "source_authority_policies_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_announcement_acknowledgements: {
        Row: {
          acknowledged_at: string;
          announcement_id: string;
          id: string;
          retailer_id: string;
          staff_id: string;
        };
        Insert: {
          acknowledged_at?: string;
          announcement_id: string;
          id?: string;
          retailer_id: string;
          staff_id: string;
        };
        Update: {
          acknowledged_at?: string;
          announcement_id?: string;
          id?: string;
          retailer_id?: string;
          staff_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_announcement_acknowledgements_announcement_id_fkey";
            columns: ["announcement_id"];
            isOneToOne: false;
            referencedRelation: "staff_announcements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_announcement_acknowledgements_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_announcement_acknowledgements_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_announcements: {
        Row: {
          audience_roles: string[];
          authored_by_staff_id: string;
          body: string;
          branch_id: string | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          published_at: string | null;
          requires_acknowledgement: boolean;
          retailer_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          audience_roles?: string[];
          authored_by_staff_id: string;
          body: string;
          branch_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          published_at?: string | null;
          requires_acknowledgement?: boolean;
          retailer_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          audience_roles?: string[];
          authored_by_staff_id?: string;
          body?: string;
          branch_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          published_at?: string | null;
          requires_acknowledgement?: boolean;
          retailer_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_announcements_authored_by_staff_id_fkey";
            columns: ["authored_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_announcements_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "retailer_branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_announcements_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_availability_declarations: {
        Row: {
          available: boolean;
          created_at: string;
          deleted_at: string | null;
          effective_on: string;
          end_time: string;
          id: string;
          note: string | null;
          retailer_id: string;
          staff_id: string;
          start_time: string;
          updated_at: string;
          weekday: number;
        };
        Insert: {
          available?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          effective_on: string;
          end_time: string;
          id?: string;
          note?: string | null;
          retailer_id: string;
          staff_id: string;
          start_time: string;
          updated_at?: string;
          weekday: number;
        };
        Update: {
          available?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          effective_on?: string;
          end_time?: string;
          id?: string;
          note?: string | null;
          retailer_id?: string;
          staff_id?: string;
          start_time?: string;
          updated_at?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "staff_availability_declarations_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_availability_declarations_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_coaching_observations: {
        Row: {
          agreed_action: string | null;
          appointment_id: string | null;
          ceremony_version_id: string | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          observed_on: string;
          observed_staff_id: string;
          observer_staff_id: string;
          outcome_note: string | null;
          retailer_id: string;
          scores: Json;
          state: string;
          updated_at: string;
        };
        Insert: {
          agreed_action?: string | null;
          appointment_id?: string | null;
          ceremony_version_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          observed_on: string;
          observed_staff_id: string;
          observer_staff_id: string;
          outcome_note?: string | null;
          retailer_id: string;
          scores?: Json;
          state?: string;
          updated_at?: string;
        };
        Update: {
          agreed_action?: string | null;
          appointment_id?: string | null;
          ceremony_version_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          observed_on?: string;
          observed_staff_id?: string;
          observer_staff_id?: string;
          outcome_note?: string | null;
          retailer_id?: string;
          scores?: Json;
          state?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_coaching_observations_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_coaching_observations_ceremony_version_id_fkey";
            columns: ["ceremony_version_id"];
            isOneToOne: false;
            referencedRelation: "service_ceremony_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_coaching_observations_observed_staff_id_fkey";
            columns: ["observed_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_coaching_observations_observer_staff_id_fkey";
            columns: ["observer_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_coaching_observations_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_learning_contributions: {
        Row: {
          author_staff_id: string;
          body: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          moderated_at: string | null;
          moderated_by_staff_id: string | null;
          moderation_note: string | null;
          retailer_id: string;
          state: string;
          title: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          author_staff_id: string;
          body: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          moderated_at?: string | null;
          moderated_by_staff_id?: string | null;
          moderation_note?: string | null;
          retailer_id: string;
          state?: string;
          title: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          author_staff_id?: string;
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          moderated_at?: string | null;
          moderated_by_staff_id?: string | null;
          moderation_note?: string | null;
          retailer_id?: string;
          state?: string;
          title?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "staff_learning_contributions_author_staff_id_fkey";
            columns: ["author_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_learning_contributions_moderated_by_staff_id_fkey";
            columns: ["moderated_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_learning_contributions_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_learning_sessions: {
        Row: {
          contribution_id: string | null;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          host_branch_id: string | null;
          id: string;
          join_url: string | null;
          retailer_id: string;
          starts_at: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          contribution_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          host_branch_id?: string | null;
          id?: string;
          join_url?: string | null;
          retailer_id: string;
          starts_at: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          contribution_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          host_branch_id?: string | null;
          id?: string;
          join_url?: string | null;
          retailer_id?: string;
          starts_at?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_learning_sessions_contribution_id_fkey";
            columns: ["contribution_id"];
            isOneToOne: false;
            referencedRelation: "staff_learning_contributions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_learning_sessions_host_branch_id_fkey";
            columns: ["host_branch_id"];
            isOneToOne: false;
            referencedRelation: "retailer_branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_learning_sessions_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_recognition_acts: {
        Row: {
          appointment_id: string | null;
          authored_by_staff_id: string;
          coaching_note: string | null;
          created_at: string;
          customer_id: string | null;
          deleted_at: string | null;
          id: string;
          narrative: string;
          occurred_on: string;
          order_id: string | null;
          retailer_id: string;
          review_state: string;
          reviewed_at: string | null;
          reviewed_by_staff_id: string | null;
          staff_id: string;
          updated_at: string;
        };
        Insert: {
          appointment_id?: string | null;
          authored_by_staff_id: string;
          coaching_note?: string | null;
          created_at?: string;
          customer_id?: string | null;
          deleted_at?: string | null;
          id?: string;
          narrative: string;
          occurred_on: string;
          order_id?: string | null;
          retailer_id: string;
          review_state?: string;
          reviewed_at?: string | null;
          reviewed_by_staff_id?: string | null;
          staff_id: string;
          updated_at?: string;
        };
        Update: {
          appointment_id?: string | null;
          authored_by_staff_id?: string;
          coaching_note?: string | null;
          created_at?: string;
          customer_id?: string | null;
          deleted_at?: string | null;
          id?: string;
          narrative?: string;
          occurred_on?: string;
          order_id?: string | null;
          retailer_id?: string;
          review_state?: string;
          reviewed_at?: string | null;
          reviewed_by_staff_id?: string | null;
          staff_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_recognition_acts_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_recognition_acts_authored_by_staff_id_fkey";
            columns: ["authored_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_recognition_acts_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_recognition_acts_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_recognition_acts_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_recognition_acts_reviewed_by_staff_id_fkey";
            columns: ["reviewed_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_recognition_acts_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_shift_swap_requests: {
        Row: {
          approved_by_staff_id: string | null;
          created_at: string;
          decided_at: string | null;
          id: string;
          peer_staff_id: string;
          reason: string | null;
          requesting_staff_id: string;
          retailer_id: string;
          shift_id: string;
          state: string;
          updated_at: string;
        };
        Insert: {
          approved_by_staff_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          id?: string;
          peer_staff_id: string;
          reason?: string | null;
          requesting_staff_id: string;
          retailer_id: string;
          shift_id: string;
          state?: string;
          updated_at?: string;
        };
        Update: {
          approved_by_staff_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          id?: string;
          peer_staff_id?: string;
          reason?: string | null;
          requesting_staff_id?: string;
          retailer_id?: string;
          shift_id?: string;
          state?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_shift_swap_requests_approved_by_staff_id_fkey";
            columns: ["approved_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_shift_swap_requests_peer_staff_id_fkey";
            columns: ["peer_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_shift_swap_requests_requesting_staff_id_fkey";
            columns: ["requesting_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_shift_swap_requests_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_shift_swap_requests_shift_id_fkey";
            columns: ["shift_id"];
            isOneToOne: false;
            referencedRelation: "staff_shifts";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_shifts: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          end_time: string;
          id: string;
          notes: string | null;
          retailer_id: string;
          shift_date: string;
          staff_id: string;
          start_time: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          end_time: string;
          id?: string;
          notes?: string | null;
          retailer_id: string;
          shift_date: string;
          staff_id: string;
          start_time: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          end_time?: string;
          id?: string;
          notes?: string | null;
          retailer_id?: string;
          shift_date?: string;
          staff_id?: string;
          start_time?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_shifts_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_shifts_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_support_resources: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          external_url: string | null;
          id: string;
          phone: string | null;
          resource_key: string;
          retailer_id: string;
          summary: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          external_url?: string | null;
          id?: string;
          phone?: string | null;
          resource_key: string;
          retailer_id: string;
          summary: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          external_url?: string | null;
          id?: string;
          phone?: string | null;
          resource_key?: string;
          retailer_id?: string;
          summary?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_support_resources_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_time_entries: {
        Row: {
          clock_in_at: string;
          clock_out_at: string | null;
          created_at: string;
          id: string;
          retailer_id: string;
          staff_id: string;
          updated_at: string;
        };
        Insert: {
          clock_in_at?: string;
          clock_out_at?: string | null;
          created_at?: string;
          id?: string;
          retailer_id: string;
          staff_id: string;
          updated_at?: string;
        };
        Update: {
          clock_in_at?: string;
          clock_out_at?: string | null;
          created_at?: string;
          id?: string;
          retailer_id?: string;
          staff_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_time_entries_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_time_entries_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_count_lines: {
        Row: {
          counted_at: string;
          counted_by_staff_id: string | null;
          counted_quantity: number;
          id: string;
          retailer_id: string;
          session_id: string;
          variant_id: string;
        };
        Insert: {
          counted_at?: string;
          counted_by_staff_id?: string | null;
          counted_quantity: number;
          id?: string;
          retailer_id: string;
          session_id: string;
          variant_id: string;
        };
        Update: {
          counted_at?: string;
          counted_by_staff_id?: string | null;
          counted_quantity?: number;
          id?: string;
          retailer_id?: string;
          session_id?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_count_lines_counted_by_staff_id_fkey";
            columns: ["counted_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_count_lines_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_count_lines_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "stock_count_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_count_lines_session_same_retailer_fk";
            columns: ["retailer_id", "session_id"];
            isOneToOne: false;
            referencedRelation: "stock_count_sessions";
            referencedColumns: ["retailer_id", "id"];
          },
          {
            foreignKeyName: "stock_count_lines_staff_same_retailer_fk";
            columns: ["retailer_id", "counted_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["retailer_id", "id"];
          },
          {
            foreignKeyName: "stock_count_lines_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_count_sessions: {
        Row: {
          blind: boolean;
          closed_at: string | null;
          created_at: string;
          id: string;
          location_id: string;
          opened_at: string;
          opened_by_staff_id: string;
          retailer_id: string;
          state: string;
          updated_at: string;
        };
        Insert: {
          blind?: boolean;
          closed_at?: string | null;
          created_at?: string;
          id?: string;
          location_id: string;
          opened_at?: string;
          opened_by_staff_id: string;
          retailer_id: string;
          state?: string;
          updated_at?: string;
        };
        Update: {
          blind?: boolean;
          closed_at?: string | null;
          created_at?: string;
          id?: string;
          location_id?: string;
          opened_at?: string;
          opened_by_staff_id?: string;
          retailer_id?: string;
          state?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_count_sessions_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "stock_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_count_sessions_location_same_retailer_fk";
            columns: ["retailer_id", "location_id"];
            isOneToOne: false;
            referencedRelation: "stock_locations";
            referencedColumns: ["retailer_id", "id"];
          },
          {
            foreignKeyName: "stock_count_sessions_opened_by_staff_id_fkey";
            columns: ["opened_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_count_sessions_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_count_sessions_staff_same_retailer_fk";
            columns: ["retailer_id", "opened_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["retailer_id", "id"];
          },
        ];
      };
      stock_ledger_entries: {
        Row: {
          count_session_id: string | null;
          created_at: string;
          id: string;
          idempotency_key: string | null;
          kind: string;
          location_id: string;
          occurred_at: string;
          quantity: number;
          reason: string | null;
          recorded_by_staff_id: string | null;
          retailer_id: string;
          reverses_entry_id: string | null;
          variant_id: string;
        };
        Insert: {
          count_session_id?: string | null;
          created_at?: string;
          id?: string;
          idempotency_key?: string | null;
          kind: string;
          location_id: string;
          occurred_at?: string;
          quantity: number;
          reason?: string | null;
          recorded_by_staff_id?: string | null;
          retailer_id: string;
          reverses_entry_id?: string | null;
          variant_id: string;
        };
        Update: {
          count_session_id?: string | null;
          created_at?: string;
          id?: string;
          idempotency_key?: string | null;
          kind?: string;
          location_id?: string;
          occurred_at?: string;
          quantity?: number;
          reason?: string | null;
          recorded_by_staff_id?: string | null;
          retailer_id?: string;
          reverses_entry_id?: string | null;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_ledger_count_session_same_retailer_fk";
            columns: ["retailer_id", "count_session_id"];
            isOneToOne: false;
            referencedRelation: "stock_count_sessions";
            referencedColumns: ["retailer_id", "id"];
          },
          {
            foreignKeyName: "stock_ledger_entries_count_session_id_fkey";
            columns: ["count_session_id"];
            isOneToOne: false;
            referencedRelation: "stock_count_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_ledger_entries_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "stock_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_ledger_entries_recorded_by_staff_id_fkey";
            columns: ["recorded_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_ledger_entries_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_ledger_entries_reverses_entry_id_fkey";
            columns: ["reverses_entry_id"];
            isOneToOne: false;
            referencedRelation: "stock_ledger_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_ledger_entries_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_ledger_location_same_retailer_fk";
            columns: ["retailer_id", "location_id"];
            isOneToOne: false;
            referencedRelation: "stock_locations";
            referencedColumns: ["retailer_id", "id"];
          },
          {
            foreignKeyName: "stock_ledger_reversal_same_retailer_fk";
            columns: ["retailer_id", "reverses_entry_id"];
            isOneToOne: false;
            referencedRelation: "stock_ledger_entries";
            referencedColumns: ["retailer_id", "id"];
          },
          {
            foreignKeyName: "stock_ledger_staff_same_retailer_fk";
            columns: ["retailer_id", "recorded_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["retailer_id", "id"];
          },
        ];
      };
      stock_locations: {
        Row: {
          active: boolean;
          branch_id: string | null;
          code: string;
          created_at: string;
          id: string;
          name: string;
          retailer_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          branch_id?: string | null;
          code: string;
          created_at?: string;
          id?: string;
          name: string;
          retailer_id: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          branch_id?: string | null;
          code?: string;
          created_at?: string;
          id?: string;
          name?: string;
          retailer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_locations_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "retailer_branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_locations_branch_same_retailer_fk";
            columns: ["retailer_id", "branch_id"];
            isOneToOne: false;
            referencedRelation: "retailer_branches";
            referencedColumns: ["retailer_id", "id"];
          },
          {
            foreignKeyName: "stock_locations_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_risk_flags: {
        Row: {
          approved_at: string | null;
          approved_by_staff_id: string | null;
          created_at: string;
          id: string;
          ledger_entry_id: string | null;
          location_id: string;
          requested_by_staff_id: string;
          retailer_id: string;
          triggered_rules: string[];
          updated_at: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by_staff_id?: string | null;
          created_at?: string;
          id?: string;
          ledger_entry_id?: string | null;
          location_id: string;
          requested_by_staff_id: string;
          retailer_id: string;
          triggered_rules: string[];
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by_staff_id?: string | null;
          created_at?: string;
          id?: string;
          ledger_entry_id?: string | null;
          location_id?: string;
          requested_by_staff_id?: string;
          retailer_id?: string;
          triggered_rules?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_risk_approver_same_retailer_fk";
            columns: ["retailer_id", "approved_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["retailer_id", "id"];
          },
          {
            foreignKeyName: "stock_risk_flags_approved_by_staff_id_fkey";
            columns: ["approved_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_risk_flags_ledger_entry_id_fkey";
            columns: ["ledger_entry_id"];
            isOneToOne: false;
            referencedRelation: "stock_ledger_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_risk_flags_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "stock_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_risk_flags_requested_by_staff_id_fkey";
            columns: ["requested_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_risk_flags_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_risk_ledger_same_retailer_fk";
            columns: ["retailer_id", "ledger_entry_id"];
            isOneToOne: false;
            referencedRelation: "stock_ledger_entries";
            referencedColumns: ["retailer_id", "id"];
          },
          {
            foreignKeyName: "stock_risk_location_same_retailer_fk";
            columns: ["retailer_id", "location_id"];
            isOneToOne: false;
            referencedRelation: "stock_locations";
            referencedColumns: ["retailer_id", "id"];
          },
          {
            foreignKeyName: "stock_risk_requester_same_retailer_fk";
            columns: ["retailer_id", "requested_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["retailer_id", "id"];
          },
        ];
      };
      store_comparison_records: {
        Row: {
          construction_kind: string;
          created_at: string;
          customer_preferred: boolean;
          id: string;
          noted_reason: string | null;
          retailer_id: string;
          session_id: string;
        };
        Insert: {
          construction_kind: string;
          created_at?: string;
          customer_preferred?: boolean;
          id?: string;
          noted_reason?: string | null;
          retailer_id: string;
          session_id: string;
        };
        Update: {
          construction_kind?: string;
          created_at?: string;
          customer_preferred?: boolean;
          id?: string;
          noted_reason?: string | null;
          retailer_id?: string;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_comparison_records_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_comparison_records_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "store_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      store_observations: {
        Row: {
          adapter_kind: string;
          created_at: string;
          dwell_seconds: number | null;
          garment_ref: string | null;
          id: string;
          observed_at: string;
          observed_count: number | null;
          retailer_id: string;
          zone_id: string;
        };
        Insert: {
          adapter_kind: string;
          created_at?: string;
          dwell_seconds?: number | null;
          garment_ref?: string | null;
          id?: string;
          observed_at?: string;
          observed_count?: number | null;
          retailer_id: string;
          zone_id: string;
        };
        Update: {
          adapter_kind?: string;
          created_at?: string;
          dwell_seconds?: number | null;
          garment_ref?: string | null;
          id?: string;
          observed_at?: string;
          observed_count?: number | null;
          retailer_id?: string;
          zone_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_observations_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_observations_zone_id_fkey";
            columns: ["zone_id"];
            isOneToOne: false;
            referencedRelation: "store_zones";
            referencedColumns: ["id"];
          },
        ];
      };
      store_sessions: {
        Row: {
          advisor_staff_id: string | null;
          appointment_id: string | null;
          branch_id: string | null;
          closed_at: string | null;
          created_at: string;
          customer_approved_look_ref: string | null;
          customer_id: string | null;
          device_failed: boolean;
          id: string;
          manual_fallback_used: boolean;
          outcome_note: string | null;
          retailer_id: string;
          updated_at: string;
        };
        Insert: {
          advisor_staff_id?: string | null;
          appointment_id?: string | null;
          branch_id?: string | null;
          closed_at?: string | null;
          created_at?: string;
          customer_approved_look_ref?: string | null;
          customer_id?: string | null;
          device_failed?: boolean;
          id?: string;
          manual_fallback_used?: boolean;
          outcome_note?: string | null;
          retailer_id: string;
          updated_at?: string;
        };
        Update: {
          advisor_staff_id?: string | null;
          appointment_id?: string | null;
          branch_id?: string | null;
          closed_at?: string | null;
          created_at?: string;
          customer_approved_look_ref?: string | null;
          customer_id?: string | null;
          device_failed?: boolean;
          id?: string;
          manual_fallback_used?: boolean;
          outcome_note?: string | null;
          retailer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_sessions_advisor_staff_id_fkey";
            columns: ["advisor_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_sessions_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_sessions_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "retailer_branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_sessions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_sessions_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      store_zones: {
        Row: {
          branch_id: string | null;
          created_at: string;
          display_name: string;
          id: string;
          playbook: Json;
          retailer_id: string;
          updated_at: string;
          zone_key: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          display_name: string;
          id?: string;
          playbook?: Json;
          retailer_id: string;
          updated_at?: string;
          zone_key: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          playbook?: Json;
          retailer_id?: string;
          updated_at?: string;
          zone_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_zones_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "retailer_branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_zones_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      stripe_webhook_events: {
        Row: {
          id: string;
          processed_at: string;
          type: string;
        };
        Insert: {
          id: string;
          processed_at?: string;
          type: string;
        };
        Update: {
          id?: string;
          processed_at?: string;
          type?: string;
        };
        Relationships: [];
      };
      subscription_plan_entitlements: {
        Row: {
          created_at: string;
          feature_key: string;
          plan_id: string;
        };
        Insert: {
          created_at?: string;
          feature_key: string;
          plan_id: string;
        };
        Update: {
          created_at?: string;
          feature_key?: string;
          plan_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_plan_entitlements_feature_key_fkey";
            columns: ["feature_key"];
            isOneToOne: false;
            referencedRelation: "commercial_features";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "subscription_plan_entitlements_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_plan_modules: {
        Row: {
          created_at: string;
          default_authority_mode: string;
          module_key: string;
          plan_id: string;
        };
        Insert: {
          created_at?: string;
          default_authority_mode?: string;
          module_key: string;
          plan_id: string;
        };
        Update: {
          created_at?: string;
          default_authority_mode?: string;
          module_key?: string;
          plan_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_plan_modules_module_key_fkey";
            columns: ["module_key"];
            isOneToOne: false;
            referencedRelation: "platform_modules";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "subscription_plan_modules_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_plans: {
        Row: {
          billing_interval: string;
          created_at: string;
          description: string;
          display_order: number;
          id: string;
          implementation_fee_amount_minor_units: number;
          implementation_fee_currency: string;
          included_feature_keys: string[];
          is_public: boolean;
          key: string;
          name: string;
          positioning: string;
          price_amount_minor_units: number;
          price_currency: string;
          price_is_from: boolean;
          provider_price_id: string | null;
          seat_limit: number | null;
          updated_at: string;
        };
        Insert: {
          billing_interval: string;
          created_at?: string;
          description?: string;
          display_order?: number;
          id?: string;
          implementation_fee_amount_minor_units?: number;
          implementation_fee_currency?: string;
          included_feature_keys?: string[];
          is_public?: boolean;
          key: string;
          name: string;
          positioning?: string;
          price_amount_minor_units: number;
          price_currency: string;
          price_is_from?: boolean;
          provider_price_id?: string | null;
          seat_limit?: number | null;
          updated_at?: string;
        };
        Update: {
          billing_interval?: string;
          created_at?: string;
          description?: string;
          display_order?: number;
          id?: string;
          implementation_fee_amount_minor_units?: number;
          implementation_fee_currency?: string;
          included_feature_keys?: string[];
          is_public?: boolean;
          key?: string;
          name?: string;
          positioning?: string;
          price_amount_minor_units?: number;
          price_currency?: string;
          price_is_from?: boolean;
          provider_price_id?: string | null;
          seat_limit?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      supplier_facts: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          material_key: string;
          observed_at: string;
          retailer_id: string;
          source_authority_key: string;
          source_version: string;
          supplier_key: string;
          value: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind: string;
          material_key: string;
          observed_at: string;
          retailer_id: string;
          source_authority_key: string;
          source_version: string;
          supplier_key: string;
          value: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          material_key?: string;
          observed_at?: string;
          retailer_id?: string;
          source_authority_key?: string;
          source_version?: string;
          supplier_key?: string;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_facts_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      supply_complaint_cases: {
        Row: {
          created_at: string;
          customer_id: string | null;
          customer_recovery_note: string | null;
          evidence_refs: string[];
          id: string;
          order_id: string | null;
          outcome_note: string | null;
          owner_staff_id: string | null;
          piece_id: string | null;
          retailer_id: string;
          state: string;
          summary: string;
          supplier_action_note: string | null;
          supplier_key: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          customer_id?: string | null;
          customer_recovery_note?: string | null;
          evidence_refs?: string[];
          id?: string;
          order_id?: string | null;
          outcome_note?: string | null;
          owner_staff_id?: string | null;
          piece_id?: string | null;
          retailer_id: string;
          state?: string;
          summary: string;
          supplier_action_note?: string | null;
          supplier_key?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string | null;
          customer_recovery_note?: string | null;
          evidence_refs?: string[];
          id?: string;
          order_id?: string | null;
          outcome_note?: string | null;
          owner_staff_id?: string | null;
          piece_id?: string | null;
          retailer_id?: string;
          state?: string;
          summary?: string;
          supplier_action_note?: string | null;
          supplier_key?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "supply_complaint_cases_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supply_complaint_cases_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supply_complaint_cases_owner_staff_id_fkey";
            columns: ["owner_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supply_complaint_cases_piece_id_fkey";
            columns: ["piece_id"];
            isOneToOne: false;
            referencedRelation: "production_pieces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supply_complaint_cases_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      supply_exceptions: {
        Row: {
          citations: Json;
          created_at: string;
          detail: string;
          id: string;
          kind: string;
          material_key: string;
          owner_staff_id: string;
          resolution_note: string | null;
          resolved_at: string | null;
          retailer_id: string;
          state: string;
          updated_at: string;
        };
        Insert: {
          citations: Json;
          created_at?: string;
          detail: string;
          id?: string;
          kind: string;
          material_key: string;
          owner_staff_id: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          retailer_id: string;
          state?: string;
          updated_at?: string;
        };
        Update: {
          citations?: Json;
          created_at?: string;
          detail?: string;
          id?: string;
          kind?: string;
          material_key?: string;
          owner_staff_id?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          retailer_id?: string;
          state?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "supply_exceptions_owner_staff_id_fkey";
            columns: ["owner_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supply_exceptions_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      synthetic_demo_generations: {
        Row: {
          config: Json;
          created_at: string;
          created_by_user_id: string | null;
          device: string;
          id: string;
          role: string;
        };
        Insert: {
          config: Json;
          created_at?: string;
          created_by_user_id?: string | null;
          device: string;
          id?: string;
          role: string;
        };
        Update: {
          config?: Json;
          created_at?: string;
          created_by_user_id?: string | null;
          device?: string;
          id?: string;
          role?: string;
        };
        Relationships: [];
      };
      vertical_packs: {
        Row: {
          active: boolean;
          created_at: string;
          form_keys: string[];
          id: string;
          retailer_id: string;
          sensitive_field_keys: string[];
          terminology: Json;
          updated_at: string;
          vertical_key: string;
          workflow_keys: string[];
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          form_keys?: string[];
          id?: string;
          retailer_id: string;
          sensitive_field_keys?: string[];
          terminology?: Json;
          updated_at?: string;
          vertical_key: string;
          workflow_keys?: string[];
        };
        Update: {
          active?: boolean;
          created_at?: string;
          form_keys?: string[];
          id?: string;
          retailer_id?: string;
          sensitive_field_keys?: string[];
          terminology?: Json;
          updated_at?: string;
          vertical_key?: string;
          workflow_keys?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "vertical_packs_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      wardrobe_attachments: {
        Row: {
          created_at: string;
          file_name: string;
          id: string;
          kind: string;
          mime_type: string;
          retailer_id: string;
          self_scan_id: string | null;
          size_bytes: number;
          storage_bucket: string;
          storage_path: string;
          uploaded_by_actor: string;
          uploaded_by_staff_id: string | null;
          wardrobe_item_id: string;
        };
        Insert: {
          created_at?: string;
          file_name: string;
          id?: string;
          kind: string;
          mime_type: string;
          retailer_id: string;
          self_scan_id?: string | null;
          size_bytes: number;
          storage_bucket: string;
          storage_path: string;
          uploaded_by_actor: string;
          uploaded_by_staff_id?: string | null;
          wardrobe_item_id: string;
        };
        Update: {
          created_at?: string;
          file_name?: string;
          id?: string;
          kind?: string;
          mime_type?: string;
          retailer_id?: string;
          self_scan_id?: string | null;
          size_bytes?: number;
          storage_bucket?: string;
          storage_path?: string;
          uploaded_by_actor?: string;
          uploaded_by_staff_id?: string | null;
          wardrobe_item_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wardrobe_attachments_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_attachments_self_scan_id_fkey";
            columns: ["self_scan_id"];
            isOneToOne: false;
            referencedRelation: "wardrobe_self_scans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_attachments_uploaded_by_staff_id_fkey";
            columns: ["uploaded_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_attachments_wardrobe_item_id_fkey";
            columns: ["wardrobe_item_id"];
            isOneToOne: false;
            referencedRelation: "wardrobe_items";
            referencedColumns: ["id"];
          },
        ];
      };
      wardrobe_items: {
        Row: {
          acquired_at: string | null;
          brand: string | null;
          care_notes: string | null;
          care_state: string;
          category_code: string;
          condition: string;
          created_at: string;
          created_by_actor: string;
          created_by_staff_id: string | null;
          customer_id: string;
          deleted_at: string | null;
          description: string | null;
          display_name: string;
          fit_notes: string | null;
          fit_perception: string;
          id: string;
          identifying_photo_url: string | null;
          order_line_id: string | null;
          ownership_kind: string;
          physical_garment_id: string | null;
          product_id: string | null;
          provenance_source: string;
          retailer_id: string;
          retired_at: string | null;
          updated_at: string;
          wear_frequency: string | null;
        };
        Insert: {
          acquired_at?: string | null;
          brand?: string | null;
          care_notes?: string | null;
          care_state?: string;
          category_code: string;
          condition: string;
          created_at?: string;
          created_by_actor: string;
          created_by_staff_id?: string | null;
          customer_id: string;
          deleted_at?: string | null;
          description?: string | null;
          display_name: string;
          fit_notes?: string | null;
          fit_perception?: string;
          id?: string;
          identifying_photo_url?: string | null;
          order_line_id?: string | null;
          ownership_kind: string;
          physical_garment_id?: string | null;
          product_id?: string | null;
          provenance_source: string;
          retailer_id: string;
          retired_at?: string | null;
          updated_at?: string;
          wear_frequency?: string | null;
        };
        Update: {
          acquired_at?: string | null;
          brand?: string | null;
          care_notes?: string | null;
          care_state?: string;
          category_code?: string;
          condition?: string;
          created_at?: string;
          created_by_actor?: string;
          created_by_staff_id?: string | null;
          customer_id?: string;
          deleted_at?: string | null;
          description?: string | null;
          display_name?: string;
          fit_notes?: string | null;
          fit_perception?: string;
          id?: string;
          identifying_photo_url?: string | null;
          order_line_id?: string | null;
          ownership_kind?: string;
          physical_garment_id?: string | null;
          product_id?: string | null;
          provenance_source?: string;
          retailer_id?: string;
          retired_at?: string | null;
          updated_at?: string;
          wear_frequency?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wardrobe_items_created_by_staff_id_fkey";
            columns: ["created_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_items_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_items_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "wardrobe_items_order_line_id_fkey";
            columns: ["order_line_id"];
            isOneToOne: false;
            referencedRelation: "order_lines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_items_physical_garment_id_fkey";
            columns: ["physical_garment_id"];
            isOneToOne: false;
            referencedRelation: "physical_garments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_items_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      wardrobe_lifecycle_events: {
        Row: {
          actor_kind: string;
          actor_staff_id: string | null;
          created_at: string;
          customer_id: string;
          event_kind: string;
          guidance_kind: string | null;
          id: string;
          note: string | null;
          occurred_at: string;
          retailer_id: string;
          wardrobe_item_id: string;
        };
        Insert: {
          actor_kind: string;
          actor_staff_id?: string | null;
          created_at?: string;
          customer_id: string;
          event_kind: string;
          guidance_kind?: string | null;
          id?: string;
          note?: string | null;
          occurred_at?: string;
          retailer_id: string;
          wardrobe_item_id: string;
        };
        Update: {
          actor_kind?: string;
          actor_staff_id?: string | null;
          created_at?: string;
          customer_id?: string;
          event_kind?: string;
          guidance_kind?: string | null;
          id?: string;
          note?: string | null;
          occurred_at?: string;
          retailer_id?: string;
          wardrobe_item_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wardrobe_lifecycle_events_actor_staff_id_fkey";
            columns: ["actor_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_lifecycle_events_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_lifecycle_events_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "wardrobe_lifecycle_events_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_lifecycle_events_wardrobe_item_id_fkey";
            columns: ["wardrobe_item_id"];
            isOneToOne: false;
            referencedRelation: "wardrobe_items";
            referencedColumns: ["id"];
          },
        ];
      };
      wardrobe_ownership_events: {
        Row: {
          actor_kind: string;
          actor_staff_id: string | null;
          created_at: string;
          customer_id: string;
          event_kind: string;
          id: string;
          note: string | null;
          occurred_at: string;
          ownership_kind: string;
          provenance_source: string;
          retailer_id: string;
          wardrobe_item_id: string;
        };
        Insert: {
          actor_kind: string;
          actor_staff_id?: string | null;
          created_at?: string;
          customer_id: string;
          event_kind: string;
          id?: string;
          note?: string | null;
          occurred_at?: string;
          ownership_kind: string;
          provenance_source: string;
          retailer_id: string;
          wardrobe_item_id: string;
        };
        Update: {
          actor_kind?: string;
          actor_staff_id?: string | null;
          created_at?: string;
          customer_id?: string;
          event_kind?: string;
          id?: string;
          note?: string | null;
          occurred_at?: string;
          ownership_kind?: string;
          provenance_source?: string;
          retailer_id?: string;
          wardrobe_item_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wardrobe_ownership_events_actor_staff_id_fkey";
            columns: ["actor_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_ownership_events_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_ownership_events_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "wardrobe_ownership_events_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_ownership_events_wardrobe_item_id_fkey";
            columns: ["wardrobe_item_id"];
            isOneToOne: false;
            referencedRelation: "wardrobe_items";
            referencedColumns: ["id"];
          },
        ];
      };
      wardrobe_roadmap_gaps: {
        Row: {
          category_code: string | null;
          created_at: string;
          description: string | null;
          filled_by_product_id: string | null;
          filled_by_wardrobe_item_id: string | null;
          how_purchase_fills_gap: string | null;
          id: string;
          rank: number;
          retailer_id: string;
          roadmap_id: string;
          slot_kind: string | null;
          title: string;
        };
        Insert: {
          category_code?: string | null;
          created_at?: string;
          description?: string | null;
          filled_by_product_id?: string | null;
          filled_by_wardrobe_item_id?: string | null;
          how_purchase_fills_gap?: string | null;
          id?: string;
          rank: number;
          retailer_id: string;
          roadmap_id: string;
          slot_kind?: string | null;
          title: string;
        };
        Update: {
          category_code?: string | null;
          created_at?: string;
          description?: string | null;
          filled_by_product_id?: string | null;
          filled_by_wardrobe_item_id?: string | null;
          how_purchase_fills_gap?: string | null;
          id?: string;
          rank?: number;
          retailer_id?: string;
          roadmap_id?: string;
          slot_kind?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wardrobe_roadmap_gaps_filled_by_product_id_fkey";
            columns: ["filled_by_product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_roadmap_gaps_filled_by_wardrobe_item_id_fkey";
            columns: ["filled_by_wardrobe_item_id"];
            isOneToOne: false;
            referencedRelation: "wardrobe_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_roadmap_gaps_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_roadmap_gaps_roadmap_id_fkey";
            columns: ["roadmap_id"];
            isOneToOne: false;
            referencedRelation: "wardrobe_roadmaps";
            referencedColumns: ["id"];
          },
        ];
      };
      wardrobe_roadmap_goals: {
        Row: {
          created_at: string;
          description: string | null;
          display_order: number;
          id: string;
          retailer_id: string;
          roadmap_id: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          display_order?: number;
          id?: string;
          retailer_id: string;
          roadmap_id: string;
          title: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          display_order?: number;
          id?: string;
          retailer_id?: string;
          roadmap_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wardrobe_roadmap_goals_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_roadmap_goals_roadmap_id_fkey";
            columns: ["roadmap_id"];
            isOneToOne: false;
            referencedRelation: "wardrobe_roadmaps";
            referencedColumns: ["id"];
          },
        ];
      };
      wardrobe_roadmap_stages: {
        Row: {
          created_at: string;
          description: string | null;
          explanation: string;
          fact_citations: Json;
          gap_id: string | null;
          id: string;
          retailer_id: string;
          roadmap_id: string;
          rule_citations: Json;
          stage_order: number;
          suggested_product_id: string | null;
          suggested_wardrobe_item_id: string | null;
          title: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          explanation: string;
          fact_citations?: Json;
          gap_id?: string | null;
          id?: string;
          retailer_id: string;
          roadmap_id: string;
          rule_citations?: Json;
          stage_order: number;
          suggested_product_id?: string | null;
          suggested_wardrobe_item_id?: string | null;
          title: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          explanation?: string;
          fact_citations?: Json;
          gap_id?: string | null;
          id?: string;
          retailer_id?: string;
          roadmap_id?: string;
          rule_citations?: Json;
          stage_order?: number;
          suggested_product_id?: string | null;
          suggested_wardrobe_item_id?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wardrobe_roadmap_stages_gap_id_fkey";
            columns: ["gap_id"];
            isOneToOne: false;
            referencedRelation: "wardrobe_roadmap_gaps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_roadmap_stages_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_roadmap_stages_roadmap_id_fkey";
            columns: ["roadmap_id"];
            isOneToOne: false;
            referencedRelation: "wardrobe_roadmaps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_roadmap_stages_suggested_product_id_fkey";
            columns: ["suggested_product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_roadmap_stages_suggested_wardrobe_item_id_fkey";
            columns: ["suggested_wardrobe_item_id"];
            isOneToOne: false;
            referencedRelation: "wardrobe_items";
            referencedColumns: ["id"];
          },
        ];
      };
      wardrobe_roadmaps: {
        Row: {
          authored_by_staff_id: string;
          created_at: string;
          customer_decision_note: string | null;
          customer_id: string;
          decided_at: string | null;
          decided_by_actor: string | null;
          deleted_at: string | null;
          horizon_label: string | null;
          id: string;
          retailer_id: string;
          status: string;
          submitted_at: string | null;
          summary: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          authored_by_staff_id: string;
          created_at?: string;
          customer_decision_note?: string | null;
          customer_id: string;
          decided_at?: string | null;
          decided_by_actor?: string | null;
          deleted_at?: string | null;
          horizon_label?: string | null;
          id?: string;
          retailer_id: string;
          status?: string;
          submitted_at?: string | null;
          summary?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          authored_by_staff_id?: string;
          created_at?: string;
          customer_decision_note?: string | null;
          customer_id?: string;
          decided_at?: string | null;
          decided_by_actor?: string | null;
          deleted_at?: string | null;
          horizon_label?: string | null;
          id?: string;
          retailer_id?: string;
          status?: string;
          submitted_at?: string | null;
          summary?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wardrobe_roadmaps_authored_by_staff_id_fkey";
            columns: ["authored_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_roadmaps_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_roadmaps_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "wardrobe_roadmaps_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      wardrobe_self_scans: {
        Row: {
          appointment_id: string | null;
          appointment_type: string | null;
          created_at: string;
          created_by_actor: string;
          created_by_staff_id: string | null;
          customer_id: string;
          fit_perception_at_scan: string | null;
          id: string;
          notes: string | null;
          provenance: string;
          retailer_id: string;
          service_handoff_kind: string;
          size_change_reported: boolean;
          wardrobe_item_id: string;
        };
        Insert: {
          appointment_id?: string | null;
          appointment_type?: string | null;
          created_at?: string;
          created_by_actor: string;
          created_by_staff_id?: string | null;
          customer_id: string;
          fit_perception_at_scan?: string | null;
          id?: string;
          notes?: string | null;
          provenance?: string;
          retailer_id: string;
          service_handoff_kind?: string;
          size_change_reported?: boolean;
          wardrobe_item_id: string;
        };
        Update: {
          appointment_id?: string | null;
          appointment_type?: string | null;
          created_at?: string;
          created_by_actor?: string;
          created_by_staff_id?: string | null;
          customer_id?: string;
          fit_perception_at_scan?: string | null;
          id?: string;
          notes?: string | null;
          provenance?: string;
          retailer_id?: string;
          service_handoff_kind?: string;
          size_change_reported?: boolean;
          wardrobe_item_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wardrobe_self_scans_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_self_scans_created_by_staff_id_fkey";
            columns: ["created_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_self_scans_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_self_scans_customer_retailer_fk";
            columns: ["customer_id", "retailer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "retailer_id"];
          },
          {
            foreignKeyName: "wardrobe_self_scans_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wardrobe_self_scans_wardrobe_item_id_fkey";
            columns: ["wardrobe_item_id"];
            isOneToOne: false;
            referencedRelation: "wardrobe_items";
            referencedColumns: ["id"];
          },
        ];
      };
      wedding_aftercare_plans: {
        Row: {
          completed_at: string | null;
          created_at: string;
          due_on: string | null;
          id: string;
          instruction: string;
          retailer_id: string;
          updated_at: string;
          wedding_party_id: string;
          wedding_party_member_id: string | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          due_on?: string | null;
          id?: string;
          instruction: string;
          retailer_id: string;
          updated_at?: string;
          wedding_party_id: string;
          wedding_party_member_id?: string | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          due_on?: string | null;
          id?: string;
          instruction?: string;
          retailer_id?: string;
          updated_at?: string;
          wedding_party_id?: string;
          wedding_party_member_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wedding_aftercare_plans_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wedding_aftercare_plans_wedding_party_id_fkey";
            columns: ["wedding_party_id"];
            isOneToOne: false;
            referencedRelation: "wedding_parties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wedding_aftercare_plans_wedding_party_member_id_fkey";
            columns: ["wedding_party_member_id"];
            isOneToOne: false;
            referencedRelation: "wedding_party_members";
            referencedColumns: ["id"];
          },
        ];
      };
      wedding_design_choices: {
        Row: {
          coordinated: boolean;
          created_at: string;
          id: string;
          retailer_id: string;
          slot_key: string;
          updated_at: string;
          value_key: string;
          wedding_party_id: string;
          wedding_party_member_id: string | null;
        };
        Insert: {
          coordinated?: boolean;
          created_at?: string;
          id?: string;
          retailer_id: string;
          slot_key: string;
          updated_at?: string;
          value_key: string;
          wedding_party_id: string;
          wedding_party_member_id?: string | null;
        };
        Update: {
          coordinated?: boolean;
          created_at?: string;
          id?: string;
          retailer_id?: string;
          slot_key?: string;
          updated_at?: string;
          value_key?: string;
          wedding_party_id?: string;
          wedding_party_member_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wedding_design_choices_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wedding_design_choices_wedding_party_id_fkey";
            columns: ["wedding_party_id"];
            isOneToOne: false;
            referencedRelation: "wedding_parties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wedding_design_choices_wedding_party_member_id_fkey";
            columns: ["wedding_party_member_id"];
            isOneToOne: false;
            referencedRelation: "wedding_party_members";
            referencedColumns: ["id"];
          },
        ];
      };
      wedding_group_fittings: {
        Row: {
          capacity: number;
          created_at: string;
          id: string;
          retailer_id: string;
          scheduled_at: string;
          updated_at: string;
          wedding_party_id: string;
        };
        Insert: {
          capacity: number;
          created_at?: string;
          id?: string;
          retailer_id: string;
          scheduled_at: string;
          updated_at?: string;
          wedding_party_id: string;
        };
        Update: {
          capacity?: number;
          created_at?: string;
          id?: string;
          retailer_id?: string;
          scheduled_at?: string;
          updated_at?: string;
          wedding_party_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wedding_group_fittings_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wedding_group_fittings_wedding_party_id_fkey";
            columns: ["wedding_party_id"];
            isOneToOne: false;
            referencedRelation: "wedding_parties";
            referencedColumns: ["id"];
          },
        ];
      };
      wedding_guest_vouchers: {
        Row: {
          created_at: string;
          currency: string;
          expires_on: string;
          funding_source: string;
          guest_label: string;
          id: string;
          redeemed_at: string | null;
          retailer_id: string;
          updated_at: string;
          value_minor_units: number;
          wedding_party_id: string;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          expires_on: string;
          funding_source: string;
          guest_label: string;
          id?: string;
          redeemed_at?: string | null;
          retailer_id: string;
          updated_at?: string;
          value_minor_units: number;
          wedding_party_id: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          expires_on?: string;
          funding_source?: string;
          guest_label?: string;
          id?: string;
          redeemed_at?: string | null;
          retailer_id?: string;
          updated_at?: string;
          value_minor_units?: number;
          wedding_party_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wedding_guest_vouchers_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wedding_guest_vouchers_wedding_party_id_fkey";
            columns: ["wedding_party_id"];
            isOneToOne: false;
            referencedRelation: "wedding_parties";
            referencedColumns: ["id"];
          },
        ];
      };
      wedding_inspiration_items: {
        Row: {
          added_by_customer_id: string | null;
          created_at: string;
          id: string;
          image_ref: string | null;
          internal_only: boolean;
          note: string | null;
          retailer_id: string;
          updated_at: string;
          wedding_party_id: string;
        };
        Insert: {
          added_by_customer_id?: string | null;
          created_at?: string;
          id?: string;
          image_ref?: string | null;
          internal_only?: boolean;
          note?: string | null;
          retailer_id: string;
          updated_at?: string;
          wedding_party_id: string;
        };
        Update: {
          added_by_customer_id?: string | null;
          created_at?: string;
          id?: string;
          image_ref?: string | null;
          internal_only?: boolean;
          note?: string | null;
          retailer_id?: string;
          updated_at?: string;
          wedding_party_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wedding_inspiration_items_added_by_customer_id_fkey";
            columns: ["added_by_customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wedding_inspiration_items_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wedding_inspiration_items_wedding_party_id_fkey";
            columns: ["wedding_party_id"];
            isOneToOne: false;
            referencedRelation: "wedding_parties";
            referencedColumns: ["id"];
          },
        ];
      };
      wedding_parties: {
        Row: {
          cover_photo_url: string | null;
          created_at: string;
          deleted_at: string | null;
          event_date: string | null;
          event_time: string | null;
          fitting_location: string | null;
          id: string;
          invite_token: string;
          notes: string | null;
          organizer_customer_id: string;
          retailer_id: string;
          status: Database["public"]["Enums"]["wedding_party_status"];
          updated_at: string;
          venue_name: string | null;
        };
        Insert: {
          cover_photo_url?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          event_date?: string | null;
          event_time?: string | null;
          fitting_location?: string | null;
          id?: string;
          invite_token?: string;
          notes?: string | null;
          organizer_customer_id: string;
          retailer_id: string;
          status?: Database["public"]["Enums"]["wedding_party_status"];
          updated_at?: string;
          venue_name?: string | null;
        };
        Update: {
          cover_photo_url?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          event_date?: string | null;
          event_time?: string | null;
          fitting_location?: string | null;
          id?: string;
          invite_token?: string;
          notes?: string | null;
          organizer_customer_id?: string;
          retailer_id?: string;
          status?: Database["public"]["Enums"]["wedding_party_status"];
          updated_at?: string;
          venue_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wedding_parties_organizer_customer_id_fkey";
            columns: ["organizer_customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wedding_parties_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      wedding_party_members: {
        Row: {
          created_at: string;
          customer_id: string;
          deleted_at: string | null;
          fitting_status: Database["public"]["Enums"]["wedding_party_member_fitting_status"];
          height_cm: number | null;
          id: string;
          name: string;
          photo_url: string | null;
          role: Database["public"]["Enums"]["wedding_party_member_role"];
          updated_at: string;
          wedding_party_id: string;
          weight_kg: number | null;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          deleted_at?: string | null;
          fitting_status?: Database["public"]["Enums"]["wedding_party_member_fitting_status"];
          height_cm?: number | null;
          id?: string;
          name: string;
          photo_url?: string | null;
          role?: Database["public"]["Enums"]["wedding_party_member_role"];
          updated_at?: string;
          wedding_party_id: string;
          weight_kg?: number | null;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          deleted_at?: string | null;
          fitting_status?: Database["public"]["Enums"]["wedding_party_member_fitting_status"];
          height_cm?: number | null;
          id?: string;
          name?: string;
          photo_url?: string | null;
          role?: Database["public"]["Enums"]["wedding_party_member_role"];
          updated_at?: string;
          wedding_party_id?: string;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "wedding_party_members_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wedding_party_members_wedding_party_id_fkey";
            columns: ["wedding_party_id"];
            isOneToOne: false;
            referencedRelation: "wedding_parties";
            referencedColumns: ["id"];
          },
        ];
      };
      wishlist_items: {
        Row: {
          added_at: string;
          note: string | null;
          product_variant_id: string;
          wishlist_id: string;
        };
        Insert: {
          added_at?: string;
          note?: string | null;
          product_variant_id: string;
          wishlist_id: string;
        };
        Update: {
          added_at?: string;
          note?: string | null;
          product_variant_id?: string;
          wishlist_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_variant_id_fkey";
            columns: ["product_variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wishlist_items_wishlist_id_fkey";
            columns: ["wishlist_id"];
            isOneToOne: false;
            referencedRelation: "wishlists";
            referencedColumns: ["id"];
          },
        ];
      };
      wishlists: {
        Row: {
          created_at: string;
          customer_id: string;
          deleted_at: string | null;
          id: string;
          is_default: boolean;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          deleted_at?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          deleted_at?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wishlists_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      work_order_assignments: {
        Row: {
          active: boolean;
          alteration_id: string;
          assigned_by_staff_id: string;
          assigned_worker_id: string | null;
          created_at: string;
          id: string;
          retailer_id: string;
          target_completion_date: string | null;
          updated_at: string;
          workshop_id: string;
        };
        Insert: {
          active?: boolean;
          alteration_id: string;
          assigned_by_staff_id: string;
          assigned_worker_id?: string | null;
          created_at?: string;
          id?: string;
          retailer_id: string;
          target_completion_date?: string | null;
          updated_at?: string;
          workshop_id: string;
        };
        Update: {
          active?: boolean;
          alteration_id?: string;
          assigned_by_staff_id?: string;
          assigned_worker_id?: string | null;
          created_at?: string;
          id?: string;
          retailer_id?: string;
          target_completion_date?: string | null;
          updated_at?: string;
          workshop_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "work_order_assignments_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_order_assignments_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "customer_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_order_assignments_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "worker_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_order_assignments_assigned_by_staff_id_fkey";
            columns: ["assigned_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_order_assignments_assigned_worker_id_fkey";
            columns: ["assigned_worker_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_order_assignments_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_order_assignments_workshop_id_fkey";
            columns: ["workshop_id"];
            isOneToOne: false;
            referencedRelation: "workshops";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_definition_versions: {
        Row: {
          activated_at: string | null;
          created_at: string;
          definition_id: string;
          id: string;
          snapshot: Json;
          status: string;
          updated_at: string;
          version_number: number;
        };
        Insert: {
          activated_at?: string | null;
          created_at?: string;
          definition_id: string;
          id?: string;
          snapshot: Json;
          status: string;
          updated_at?: string;
          version_number: number;
        };
        Update: {
          activated_at?: string | null;
          created_at?: string;
          definition_id?: string;
          id?: string;
          snapshot?: Json;
          status?: string;
          updated_at?: string;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_definition_versions_definition_id_fkey";
            columns: ["definition_id"];
            isOneToOne: false;
            referencedRelation: "workflow_definitions";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_definitions: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          key: string;
          subject_type: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          id?: string;
          key: string;
          subject_type: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          key?: string;
          subject_type?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workflow_instance_bindings: {
        Row: {
          created_at: string;
          definition_version_id: string;
          id: string;
          pinned_at: string;
          retailer_id: string;
          subject_id: string;
          subject_type: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          definition_version_id: string;
          id?: string;
          pinned_at?: string;
          retailer_id: string;
          subject_id: string;
          subject_type: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          definition_version_id?: string;
          id?: string;
          pinned_at?: string;
          retailer_id?: string;
          subject_id?: string;
          subject_type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_instance_bindings_definition_version_id_fkey";
            columns: ["definition_version_id"];
            isOneToOne: false;
            referencedRelation: "workflow_definition_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_instance_bindings_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      workshops: {
        Row: {
          address: Json | null;
          created_at: string;
          deleted_at: string | null;
          email: string | null;
          id: string;
          name: string;
          phone: string | null;
          retailer_id: string;
          status: Database["public"]["Enums"]["workshop_status"];
          updated_at: string;
        };
        Insert: {
          address?: Json | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          id?: string;
          name: string;
          phone?: string | null;
          retailer_id: string;
          status?: Database["public"]["Enums"]["workshop_status"];
          updated_at?: string;
        };
        Update: {
          address?: Json | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          id?: string;
          name?: string;
          phone?: string | null;
          retailer_id?: string;
          status?: Database["public"]["Enums"]["workshop_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workshops_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      customer_alteration_fulfillment: {
        Row: {
          alteration_id: string | null;
          completed_at: string | null;
          created_at: string | null;
          delivery_address: Json | null;
          id: string | null;
          method:
            Database["public"]["Enums"]["alteration_fulfillment_method"] | null;
          released_to_name: string | null;
          scheduled_at: string | null;
          status:
            Database["public"]["Enums"]["alteration_fulfillment_status"] | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "alteration_fulfillment_events_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_fulfillment_events_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "customer_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_fulfillment_events_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "worker_alteration_work_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_alteration_status_history: {
        Row: {
          alteration_id: string | null;
          created_at: string | null;
          id: string | null;
          note: string | null;
          to_status:
            Database["public"]["Enums"]["alteration_work_order_status"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "alteration_status_history_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_status_history_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "customer_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_status_history_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "worker_alteration_work_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_alteration_work_orders: {
        Row: {
          agreed_total_amount_minor_units: number | null;
          agreed_total_currency: string | null;
          brand: string | null;
          category_code: string | null;
          created_at: string | null;
          customer_id: string | null;
          customer_notification_ready_at: string | null;
          description: string | null;
          due_date: string | null;
          garment_type: string | null;
          id: string | null;
          physical_garment_id: string | null;
          retailer_id: string | null;
          status:
            Database["public"]["Enums"]["alteration_work_order_status"] | null;
          updated_at: string | null;
          work_order_number: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "alteration_work_orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_work_orders_physical_garment_id_fkey";
            columns: ["physical_garment_id"];
            isOneToOne: false;
            referencedRelation: "physical_garments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_work_orders_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      worker_alteration_tasks: {
        Row: {
          alteration_id: string | null;
          assigned_worker_id: string | null;
          classification:
            Database["public"]["Enums"]["work_classification"] | null;
          created_at: string | null;
          id: string | null;
          instructions: string | null;
          operation_id: string | null;
          retailer_id: string | null;
          status: Database["public"]["Enums"]["alteration_task_status"] | null;
          title: string | null;
          updated_at: string | null;
        };
        Insert: {
          alteration_id?: string | null;
          assigned_worker_id?: string | null;
          classification?:
            Database["public"]["Enums"]["work_classification"] | null;
          created_at?: string | null;
          id?: string | null;
          instructions?: string | null;
          operation_id?: string | null;
          retailer_id?: string | null;
          status?: Database["public"]["Enums"]["alteration_task_status"] | null;
          title?: string | null;
          updated_at?: string | null;
        };
        Update: {
          alteration_id?: string | null;
          assigned_worker_id?: string | null;
          classification?:
            Database["public"]["Enums"]["work_classification"] | null;
          created_at?: string | null;
          id?: string | null;
          instructions?: string | null;
          operation_id?: string | null;
          retailer_id?: string | null;
          status?: Database["public"]["Enums"]["alteration_task_status"] | null;
          title?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "alteration_tasks_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_tasks_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "customer_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_tasks_alteration_id_fkey";
            columns: ["alteration_id"];
            isOneToOne: false;
            referencedRelation: "worker_alteration_work_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_tasks_assigned_worker_id_fkey";
            columns: ["assigned_worker_id"];
            isOneToOne: false;
            referencedRelation: "retailer_staff_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_tasks_operation_id_fkey";
            columns: ["operation_id"];
            isOneToOne: false;
            referencedRelation: "alteration_operations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_tasks_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
      worker_alteration_work_orders: {
        Row: {
          brand: string | null;
          category_code: string | null;
          created_at: string | null;
          description: string | null;
          due_date: string | null;
          garment_type: string | null;
          id: string | null;
          intake_condition: string | null;
          physical_garment_id: string | null;
          retailer_id: string | null;
          status:
            Database["public"]["Enums"]["alteration_work_order_status"] | null;
          updated_at: string | null;
          work_order_number: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "alteration_work_orders_physical_garment_id_fkey";
            columns: ["physical_garment_id"];
            isOneToOne: false;
            referencedRelation: "physical_garments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alteration_work_orders_retailer_id_fkey";
            columns: ["retailer_id"];
            isOneToOne: false;
            referencedRelation: "retailers";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      _service_assert_staff_retailer: {
        Args: { p_retailer_id: string };
        Returns: string;
      };
      _service_booking_kind_allowed: {
        Args: { p_booking_kind: string; p_plan_kind: string };
        Returns: boolean;
      };
      _service_can_transition_booking: {
        Args: { p_from: string; p_to: string };
        Returns: boolean;
      };
      _service_entitlement_for_booking: {
        Args: { p_booking_kind: string };
        Returns: string;
      };
      _service_history_insert: {
        Args: {
          p_booking_id: string;
          p_customer_id: string;
          p_kind: string;
          p_membership_id: string;
          p_retailer_id: string;
          p_staff_id?: string;
          p_summary: string;
        };
        Returns: undefined;
      };
      accept_platform_staff_invite: {
        Args: { p_staff_id: string };
        Returns: string;
      };
      accept_retailer_staff_invite: {
        Args: { p_staff_id: string };
        Returns: undefined;
      };
      add_alteration_task_note: {
        Args: { p_note: string; p_task_id: string };
        Returns: string;
      };
      add_fitting_observation: {
        Args: {
          p_area: string;
          p_classification?: Database["public"]["Enums"]["work_classification"];
          p_observation: string;
          p_physical_garment_id: string;
        };
        Returns: string;
      };
      add_pos_line_atomic: {
        Args: {
          p_currency?: string;
          p_kind: string;
          p_location_id: string;
          p_quantity: number;
          p_retailer_id: string;
          p_transaction_id: string;
          p_unit_price_minor_units: number;
          p_variant_id?: string;
        };
        Returns: Json;
      };
      add_to_cart: {
        Args: {
          p_quantity: number;
          p_retailer_id: string;
          p_variant_id: string;
        };
        Returns: string;
      };
      add_wedding_party_member: {
        Args: {
          p_email: string;
          p_name: string;
          p_role: Database["public"]["Enums"]["wedding_party_member_role"];
          p_wedding_party_id: string;
        };
        Returns: string;
      };
      anonymize_behavioral_events_for_customer: {
        Args: { p_customer_id: string; p_retailer_id: string };
        Returns: number;
      };
      anonymize_expired_behavioral_events: {
        Args: { p_limit?: number };
        Returns: number;
      };
      assert_pos_actor: { Args: { p_retailer_id: string }; Returns: undefined };
      assert_retailer_module_dependencies: {
        Args: { p_retailer_id: string };
        Returns: undefined;
      };
      assign_alteration_work_order: {
        Args: {
          p_alteration_id: string;
          p_target_completion_date: string;
          p_workshop_id: string;
        };
        Returns: undefined;
      };
      assign_service_advisor: {
        Args: { p_advisor_staff_id: string; p_membership_id: string };
        Returns: string;
      };
      can_access_alteration_storage_object: {
        Args: { p_name: string };
        Returns: boolean;
      };
      can_access_alteration_work_order: {
        Args: { p_alteration_id: string };
        Returns: boolean;
      };
      can_access_conversation_storage_object: {
        Args: { p_name: string };
        Returns: boolean;
      };
      can_access_physical_garment: {
        Args: { p_garment_id: string };
        Returns: boolean;
      };
      can_access_wardrobe_storage_object: {
        Args: { p_name: string };
        Returns: boolean;
      };
      can_manage_party_photo_object: {
        Args: { p_name: string };
        Returns: boolean;
      };
      can_read_knowledge_object: {
        Args: { p_object_id: string };
        Returns: boolean;
      };
      can_write_knowledge_object: {
        Args: { p_object_id: string };
        Returns: boolean;
      };
      capture_behavioral_event: {
        Args: {
          p_anonymous_session_id?: string;
          p_consent_basis?: string;
          p_consent_snapshot?: Json;
          p_correlation_id?: string;
          p_customer_id?: string;
          p_device_class?: string;
          p_idempotency_key?: string;
          p_name: string;
          p_occurred_at?: string;
          p_page_path?: string;
          p_properties?: Json;
          p_purpose?: string;
          p_received_at?: string;
          p_retailer_id: string;
          p_retention_class?: string;
          p_retention_expires_at?: string;
          p_session_id?: string;
          p_source?: string;
        };
        Returns: string;
      };
      checkout_cart: {
        Args: { p_order_id: string; p_shipping_address: Json };
        Returns: string;
      };
      claim_pending_emails: {
        Args: { p_limit?: number };
        Returns: {
          attempts: number;
          created_at: string;
          html_body: string;
          id: string;
          last_error: string | null;
          notification_id: string | null;
          recipient_email: string;
          sent_at: string | null;
          status: string;
          subject: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "email_outbox";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      claim_pending_sms: {
        Args: { p_limit?: number };
        Returns: {
          attempts: number;
          body: string;
          channel: string;
          created_at: string;
          id: string;
          last_error: string | null;
          notification_id: string | null;
          recipient_phone: string;
          sent_at: string | null;
          status: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "sms_outbox";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      clock_in: { Args: never; Returns: string };
      clock_out: { Args: never; Returns: undefined };
      complete_campaign_challenge: {
        Args: { p_enrollment_id: string };
        Returns: string;
      };
      complete_pos_sale_atomic: {
        Args: {
          p_location_id: string;
          p_retailer_id: string;
          p_staff_id?: string;
          p_transaction_id: string;
        };
        Returns: Json;
      };
      convert_pilot_to_live_retailer: {
        Args: { p_prospect_id: string };
        Returns: string;
      };
      count_inventory_disagreements: { Args: never; Returns: number };
      create_alteration_intake: {
        Args: {
          p_appointment_id: string;
          p_brand: string;
          p_category_code: string;
          p_customer_id: string;
          p_description: string;
          p_due_date: string;
          p_external_reference: string;
          p_garment_type: string;
          p_identifying_photo_url: string;
          p_intake_condition: string;
          p_label_metadata: Json;
          p_observations: Json;
          p_order_line_id: string;
          p_source_kind: Database["public"]["Enums"]["garment_source_kind"];
          p_supplier_order_reference: string;
          p_tasks: Json;
        };
        Returns: string;
      };
      create_my_referral: {
        Args: { p_referred_email: string; p_retailer_id: string };
        Returns: string;
      };
      current_platform_role: { Args: never; Returns: string };
      current_retailer_id: { Args: never; Returns: string };
      current_retailer_role: { Args: never; Returns: string };
      current_staff_id: { Args: never; Returns: string };
      current_workshop_id: { Args: never; Returns: string };
      decide_alteration_price_change: {
        Args: {
          p_decision: Database["public"]["Enums"]["price_change_proposal_status"];
          p_proposal_id: string;
          p_reason: string;
        };
        Returns: undefined;
      };
      enqueue_campaign_delivery_notification: {
        Args: {
          p_action_href?: string;
          p_body: string;
          p_channel?: string;
          p_customer_id: string;
          p_retailer_id: string;
          p_title: string;
        };
        Returns: string;
      };
      enqueue_morning_routine_delivery_notification: {
        Args: {
          p_action_href?: string;
          p_body: string;
          p_channel?: string;
          p_customer_id: string;
          p_retailer_id: string;
          p_title: string;
        };
        Returns: string;
      };
      enroll_campaign_challenge: {
        Args: {
          p_campaign_id: string;
          p_customer_id: string;
          p_retailer_id: string;
        };
        Returns: string;
      };
      enroll_service_membership: {
        Args: {
          p_advisor_staff_id?: string;
          p_commitment_notes?: string;
          p_customer_id: string;
          p_plan_id: string;
          p_seed_default_entitlements?: boolean;
        };
        Returns: string;
      };
      ensure_customer_style_profile: {
        Args: { p_customer_id: string };
        Returns: {
          confidence: Json;
          created_at: string;
          customer_id: string;
          explicit_preferences: Json;
          id: string;
          inferred_preferences: Json;
          recomputed_at: string | null;
          retailer_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "customer_style_profiles";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      ensure_interaction_session: {
        Args: {
          p_customer_id: string;
          p_device_class?: string;
          p_idle_minutes?: number;
          p_locale?: string;
          p_now?: string;
          p_retailer_id: string;
          p_timezone?: string;
        };
        Returns: string;
      };
      ensure_loyalty_milestone_definitions: {
        Args: { p_retailer_id: string };
        Returns: undefined;
      };
      ensure_my_loyalty_account: {
        Args: { p_retailer_id: string };
        Returns: string;
      };
      expire_due_prospect_demo_environments: { Args: never; Returns: number };
      generate_prospect_demo_environment: {
        Args: {
          p_access_code: string;
          p_expires_at: string;
          p_prospect_id: string;
          p_public_token: string;
          p_retailer_id?: string;
          p_retailer_slug?: string;
          p_synthetic_data: Json;
        };
        Returns: string;
      };
      generate_prospect_demo_preview: {
        Args: {
          p_config: Json;
          p_device: string;
          p_environment_id: string;
          p_role: string;
        };
        Returns: string;
      };
      get_or_create_my_conversation: {
        Args: { p_retailer_id: string };
        Returns: string;
      };
      get_or_create_staff_conversation: {
        Args: { p_customer_id: string };
        Returns: string;
      };
      get_platform_analytics: { Args: { p_since?: string }; Returns: Json };
      get_retailer_analytics: {
        Args: { p_retailer_id: string; p_since?: string };
        Returns: Json;
      };
      grant_service_entitlement: {
        Args: {
          p_idempotency_key: string;
          p_kind: string;
          p_membership_id: string;
          p_notes?: string;
          p_quantity: number;
        };
        Returns: string;
      };
      hex_color_contrast_ratio: {
        Args: { p_first: string; p_second: string };
        Returns: number;
      };
      hex_color_relative_luminance: {
        Args: { p_hex: string };
        Returns: number;
      };
      is_alterations_advisor: { Args: never; Returns: boolean };
      is_alterations_management: { Args: never; Returns: boolean };
      is_my_event_invitation: {
        Args: { p_event_id: string };
        Returns: boolean;
      };
      is_platform_staff: { Args: never; Returns: boolean };
      is_valid_alteration_transition: {
        Args: {
          p_from: Database["public"]["Enums"]["alteration_work_order_status"];
          p_to: Database["public"]["Enums"]["alteration_work_order_status"];
        };
        Returns: boolean;
      };
      is_valid_retailer_brand_theme: {
        Args: { p_theme: Json };
        Returns: boolean;
      };
      is_wedding_party_organizer_or_member: {
        Args: { p_wedding_party_id: string };
        Returns: boolean;
      };
      join_wedding_party: {
        Args: {
          p_email: string;
          p_height_cm: number;
          p_invite_token: string;
          p_name: string;
          p_photo_url?: string;
          p_role: Database["public"]["Enums"]["wedding_party_member_role"];
          p_weight_kg: number;
        };
        Returns: Json;
      };
      link_my_customer_accounts: { Args: never; Returns: undefined };
      link_service_booking_appointment: {
        Args: { p_appointment_id: string; p_booking_id: string };
        Returns: string;
      };
      loyalty_milestone_slug_matches: {
        Args: { p_hints: string[]; p_slug: string };
        Returns: boolean;
      };
      mark_conversation_read: {
        Args: { p_conversation_id: string };
        Returns: undefined;
      };
      mark_morning_routine_review: {
        Args: { p_review_status: string; p_selection_id: string };
        Returns: string;
      };
      next_alteration_work_order_number: { Args: never; Returns: string };
      next_order_number: { Args: never; Returns: string };
      open_prospect_demo: {
        Args: { p_access_code: string; p_public_token: string };
        Returns: Json;
      };
      persist_morning_routine_selection: {
        Args: {
          p_customer_id: string;
          p_for_date: string;
          p_provenance: Json;
          p_recommendations: Json;
          p_retailer_id: string;
          p_summary: string;
        };
        Returns: string;
      };
      persist_style_profile_recompute: {
        Args: {
          p_confidence: Json;
          p_customer_id: string;
          p_inferred_preferences: Json;
          p_recomputed_at?: string;
        };
        Returns: {
          confidence: Json;
          created_at: string;
          customer_id: string;
          explicit_preferences: Json;
          id: string;
          inferred_preferences: Json;
          recomputed_at: string | null;
          retailer_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "customer_style_profiles";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      place_order: {
        Args: {
          p_quantity: number;
          p_retailer_id: string;
          p_variant_id: string;
        };
        Returns: string;
      };
      preview_prospect_demo: {
        Args: { p_public_token: string };
        Returns: Json;
      };
      preview_wedding_party_invite: {
        Args: { p_invite_token: string };
        Returns: Json;
      };
      propose_alteration_price_change: {
        Args: {
          p_alteration_id: string;
          p_evidence_attachment_id?: string;
          p_explanation: string;
          p_proposed_amount_minor_units: number;
          p_task_id: string;
        };
        Returns: string;
      };
      publish_catalogue_import_row: {
        Args: { p_import_row_id: string };
        Returns: Json;
      };
      record_advisor_rectangle_facts: {
        Args: {
          p_customer_id: string;
          p_freeform_note?: string;
          p_observed_at: string;
          p_retailer_id: string;
          p_selections: Json;
          p_staff_id: string;
        };
        Returns: {
          author_customer_id: string | null;
          author_staff_id: string | null;
          confidence: number;
          correction_of_fact_id: string | null;
          created_at: string;
          customer_id: string;
          deleted_at: string | null;
          evidence: Json;
          expires_at: string | null;
          fact_type: string;
          id: string;
          observed_at: string;
          provenance_class: string;
          retailer_id: string;
          review_by: string | null;
          sensitivity: string;
          superseded_by_fact_id: string | null;
          updated_at: string;
          valid_from: string | null;
          valid_until: string | null;
          value_concept_id: string | null;
          value_label: string;
          value_text: string | null;
          visibility: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "customer_facts";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      record_campaign_delivery_audit: {
        Args: {
          p_campaign_id: string;
          p_customer_id: string;
          p_explanation?: string;
          p_for_date: string;
          p_notification_id?: string;
          p_outcome: string;
          p_personalization_consent?: string;
          p_retailer_id: string;
          p_scheduled_for: string;
          p_suppression_reason?: string;
        };
        Returns: string;
      };
      record_customer_ai_generation: {
        Args: {
          p_error_message?: string;
          p_input_summary: string;
          p_latency_ms?: number;
          p_model: string;
          p_output?: Json;
          p_retailer_id: string;
          p_status: Database["public"]["Enums"]["ai_generation_status"];
        };
        Returns: string;
      };
      record_customer_tableservice_grounded: {
        Args: {
          p_error_message?: string;
          p_input_summary: string;
          p_latency_ms?: number;
          p_model: string;
          p_output?: Json;
          p_provider: string;
          p_retailer_id: string;
          p_status: Database["public"]["Enums"]["ai_generation_status"];
        };
        Returns: string;
      };
      record_message_attachment: {
        Args: {
          p_file_name: string;
          p_message_id: string;
          p_mime_type: string;
          p_size_bytes: number;
          p_storage_path: string;
        };
        Returns: string;
      };
      record_morning_routine_delivery_audit: {
        Args: {
          p_customer_id: string;
          p_for_date: string;
          p_notification_id?: string;
          p_outcome: string;
          p_retailer_id: string;
          p_scheduled_for: string;
          p_selection_id?: string;
          p_suppression_reason?: string;
        };
        Returns: string;
      };
      record_pos_payment_atomic: {
        Args: {
          p_amount_minor_units: number;
          p_currency?: string;
          p_provider: string;
          p_provider_reference: string;
          p_retailer_id: string;
          p_transaction_id: string;
        };
        Returns: Json;
      };
      record_service_care: {
        Args: {
          p_alteration_id?: string;
          p_booking_id?: string;
          p_care_kind: string;
          p_membership_id: string;
          p_physical_garment_id?: string;
          p_summary: string;
          p_wardrobe_item_id?: string;
        };
        Returns: string;
      };
      record_service_cost: {
        Args: {
          p_amount_minor_units: number;
          p_booking_id?: string;
          p_currency: string;
          p_label: string;
          p_membership_id: string;
          p_notes?: string;
        };
        Returns: string;
      };
      record_service_fulfilment: {
        Args: {
          p_booking_id: string;
          p_method: string;
          p_notes?: string;
          p_scheduled_for?: string;
          p_status?: string;
        };
        Returns: string;
      };
      record_stripe_payment_event: {
        Args: {
          p_amount_minor_units: number;
          p_currency: string;
          p_event_id: string;
          p_event_type: string;
          p_order_id: string;
          p_platform_fee_amount_minor_units?: number;
          p_provider_payment_intent_id: string;
          p_status: Database["public"]["Enums"]["payment_status"];
        };
        Returns: undefined;
      };
      record_style_preference_evidence: {
        Args: {
          p_concept_id: string;
          p_confidence: number;
          p_customer_id: string;
          p_polarity: string;
          p_source: string;
          p_source_event_id?: string;
        };
        Returns: {
          concept_id: string;
          confidence: number;
          created_at: string;
          customer_id: string;
          id: string;
          polarity: string;
          retailer_id: string;
          source: string;
          source_event_id: string | null;
          suppressed_at: string | null;
          suppressed_by: string | null;
          suppression_reason: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "customer_style_preference_evidence";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_wardrobe_attachment: {
        Args: {
          p_file_name: string;
          p_kind?: string;
          p_mime_type: string;
          p_self_scan_id?: string;
          p_size_bytes: number;
          p_storage_path: string;
          p_wardrobe_item_id: string;
        };
        Returns: string;
      };
      record_wardrobe_lifecycle_event: {
        Args: {
          p_event_kind: string;
          p_guidance_kind?: string;
          p_note?: string;
          p_occurred_at?: string;
          p_wardrobe_item_id: string;
        };
        Returns: string;
      };
      redeem_my_reward: { Args: { p_reward_id: string }; Returns: string };
      remove_inferred_style_preference: {
        Args: {
          p_concept_id: string;
          p_customer_id: string;
          p_reason?: string;
        };
        Returns: {
          confidence: Json;
          created_at: string;
          customer_id: string;
          explicit_preferences: Json;
          id: string;
          inferred_preferences: Json;
          recomputed_at: string | null;
          retailer_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "customer_style_profiles";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      replace_subscription_plan_modules: {
        Args: { p_module_keys: string[]; p_plan_id: string };
        Returns: undefined;
      };
      request_appointment: {
        Args: {
          p_ends_at: string;
          p_notes?: string;
          p_retailer_id: string;
          p_starts_at: string;
          p_type: Database["public"]["Enums"]["appointment_type"];
        };
        Returns: string;
      };
      request_guest_appointment: {
        Args: {
          p_email: string;
          p_ends_at: string;
          p_name: string;
          p_notes?: string;
          p_phone?: string;
          p_retailer_id: string;
          p_starts_at: string;
          p_type?: Database["public"]["Enums"]["appointment_type"];
        };
        Returns: string;
      };
      request_service_booking: {
        Args: {
          p_idempotency_key: string;
          p_kind: string;
          p_membership_id: string;
          p_notes?: string;
          p_requested_for?: string;
        };
        Returns: string;
      };
      reserve_stock_atomic: {
        Args: {
          p_idempotency_key?: string;
          p_location_id: string;
          p_quantity: number;
          p_recorded_by_staff_id?: string;
          p_retailer_id: string;
          p_variant_id: string;
        };
        Returns: Json;
      };
      resolve_retailer_modules: {
        Args: { p_retailer_id: string };
        Returns: {
          authority_mode: string;
          module_key: string;
          source: string;
          state: string;
        }[];
      };
      restore_retailer_brand_theme: {
        Args: { p_retailer_id: string; p_version_number: number };
        Returns: number;
      };
      retailer_has_entitlement: {
        Args: { p_feature_key: string; p_retailer_id: string };
        Returns: boolean;
      };
      retailer_module_job_enabled: {
        Args: { p_job_key: string; p_retailer_id: string };
        Returns: boolean;
      };
      retailer_online_location: {
        Args: { p_retailer_id: string };
        Returns: string;
      };
      return_pos_line_atomic: {
        Args: {
          p_line_id: string;
          p_location_id: string;
          p_requested_on: string;
          p_retailer_id: string;
          p_service_performed?: boolean;
          p_staff_id?: string;
          p_transaction_id: string;
        };
        Returns: Json;
      };
      reverse_stock_entry_atomic: {
        Args: {
          p_entry_id: string;
          p_recorded_by_staff_id?: string;
          p_retailer_id: string;
        };
        Returns: Json;
      };
      review_catalogue_import_task: {
        Args: {
          p_status: Database["public"]["Enums"]["metadata_review_task_status"];
          p_task_id: string;
        };
        Returns: string;
      };
      review_metadata_assignment: {
        Args: {
          p_assignment_id: string;
          p_review_status: Database["public"]["Enums"]["metadata_review_status"];
        };
        Returns: string;
      };
      rsvp_to_event: {
        Args: {
          p_event_id: string;
          p_status: Database["public"]["Enums"]["event_rsvp_status"];
        };
        Returns: undefined;
      };
      save_prospect_demo_configuration: {
        Args: {
          p_change_note: string;
          p_feature_keys: string[];
          p_locations: Json;
          p_marketing_headline: string;
          p_personalized_introduction: string;
          p_plan_id: string;
          p_product_image_urls?: string[];
          p_product_mix: string[];
          p_prospect_id: string;
          p_theme: Json;
        };
        Returns: number;
      };
      save_retailer_brand_theme: {
        Args: { p_change_note: string; p_retailer_id: string; p_theme: Json };
        Returns: number;
      };
      send_conversation_message: {
        Args: { p_body: string; p_conversation_id: string };
        Returns: string;
      };
      set_alteration_operation_price: {
        Args: {
          p_amount_minor_units: number;
          p_operation_id: string;
          p_workshop_id?: string;
        };
        Returns: undefined;
      };
      set_customer_consent: {
        Args: {
          p_customer_id: string;
          p_purpose: string;
          p_reason?: string;
          p_status: string;
        };
        Returns: undefined;
      };
      set_product_fabric_profile: {
        Args: {
          p_composition?: Json;
          p_fabric_weight_grams_per_square_metre?: number;
          p_product_id: string;
          p_product_variant_id?: string;
          p_supplier_reference?: string;
        };
        Returns: string;
      };
      set_prospect_demo_publication: {
        Args: { p_prospect_id: string; p_publish: boolean };
        Returns: undefined;
      };
      set_retailer_module_configuration: {
        Args: {
          p_authority_mode: string;
          p_module_key: string;
          p_reason?: string;
          p_retailer_id: string;
          p_source: string;
          p_state: string;
        };
        Returns: string;
      };
      set_service_membership_status: {
        Args: { p_membership_id: string; p_status: string };
        Returns: string;
      };
      stock_available_at: {
        Args: {
          p_location_id: string;
          p_retailer_id: string;
          p_variant_id: string;
        };
        Returns: number;
      };
      submit_commercial_inquiry: {
        Args: {
          p_company_name: string;
          p_contact_name: string;
          p_email: string;
          p_inquiry_type: Database["public"]["Enums"]["commercial_inquiry_type"];
          p_objective: string;
          p_requested_plan_key: string;
          p_website_url: string;
        };
        Returns: string;
      };
      submit_table_service_inquiry: {
        Args: {
          p_email: string;
          p_intent: string;
          p_message: string;
          p_name: string;
          p_retailer_id: string;
        };
        Returns: string;
      };
      submit_wardrobe_self_scan: {
        Args: {
          p_appointment_ends_at?: string;
          p_appointment_starts_at?: string;
          p_fit_perception_at_scan?: string;
          p_notes?: string;
          p_preferred_appointment_type?: string;
          p_request_service_handoff?: boolean;
          p_size_change_reported?: boolean;
          p_wardrobe_item_id: string;
        };
        Returns: string;
      };
      subscribe_to_newsletter: {
        Args: { p_email: string; p_retailer_id: string };
        Returns: undefined;
      };
      save_wishlist_item: {
        Args: { p_retailer_id: string; p_variant_id: string };
        Returns: boolean;
      };
      sync_loyalty_milestones_for_order: {
        Args: { p_order_id: string };
        Returns: number;
      };
      take_cash_and_complete_pos_sale_atomic: {
        Args: {
          p_currency?: string;
          p_location_id: string;
          p_retailer_id: string;
          p_staff_id?: string;
          p_transaction_id: string;
        };
        Returns: Json;
      };
      toggle_wishlist_item: {
        Args: { p_retailer_id: string; p_variant_id: string };
        Returns: boolean;
      };
      transfer_stock_atomic: {
        Args: {
          p_from_location_id: string;
          p_operation_id?: string;
          p_quantity: number;
          p_recorded_by_staff_id?: string;
          p_retailer_id: string;
          p_to_location_id: string;
          p_variant_id: string;
        };
        Returns: Json;
      };
      transition_alteration_work_order: {
        Args: {
          p_alteration_id: string;
          p_customer_visible?: boolean;
          p_note: string;
          p_to_status: Database["public"]["Enums"]["alteration_work_order_status"];
        };
        Returns: undefined;
      };
      transition_service_booking: {
        Args: {
          p_booking_id: string;
          p_commitment_notes?: string;
          p_consume_entitlement?: boolean;
          p_status: string;
        };
        Returns: string;
      };
      update_alteration_task_status: {
        Args: {
          p_note?: string;
          p_status: Database["public"]["Enums"]["alteration_task_status"];
          p_task_id: string;
        };
        Returns: undefined;
      };
      update_cart_line: {
        Args: { p_line_id: string; p_quantity: number };
        Returns: undefined;
      };
      update_commercial_plan: {
        Args: {
          p_description: string;
          p_feature_keys: string[];
          p_implementation_fee_amount_minor_units: number;
          p_implementation_fee_currency: string;
          p_is_public: boolean;
          p_name: string;
          p_plan_id: string;
          p_positioning: string;
          p_price_amount_minor_units: number;
          p_price_currency: string;
          p_price_is_from: boolean;
          p_seat_limit: number;
        };
        Returns: undefined;
      };
      update_product_catalogue: {
        Args: {
          p_collection_ids?: string[];
          p_description: string;
          p_is_alterable: boolean;
          p_is_made_to_order: boolean;
          p_name: string;
          p_primary_image_url: string;
          p_product_id: string;
          p_slug: string;
          p_status: Database["public"]["Enums"]["product_status"];
        };
        Returns: string;
      };
      update_wedding_party_member_status: {
        Args: {
          p_member_id: string;
          p_status: Database["public"]["Enums"]["wedding_party_member_fitting_status"];
        };
        Returns: undefined;
      };
      update_workshop_assignment: {
        Args: {
          p_alteration_id: string;
          p_target_completion_date: string;
          p_worker_id: string;
        };
        Returns: undefined;
      };
      upsert_campaign_challenge_look: {
        Args: {
          p_day_index: number;
          p_enrollment_id: string;
          p_slots: Json;
          p_title: string;
        };
        Returns: string;
      };
      upsert_declared_style_preference: {
        Args: {
          p_concept_id: string;
          p_customer_id: string;
          p_note?: string;
          p_polarity: string;
        };
        Returns: {
          confidence: Json;
          created_at: string;
          customer_id: string;
          explicit_preferences: Json;
          id: string;
          inferred_preferences: Json;
          recomputed_at: string | null;
          retailer_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "customer_style_profiles";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      upsert_morning_routine_subscription: {
        Args: {
          p_channels?: string[];
          p_customer_id: string;
          p_frequency?: string;
          p_opted_in: boolean;
          p_preferred_local_hour?: number;
          p_quiet_end_minute?: number;
          p_quiet_start_minute?: number;
          p_retailer_id: string;
          p_timezone?: string;
        };
        Returns: string;
      };
      variant_ledger_balance: {
        Args: { p_variant_id: string };
        Returns: {
          available: number;
          on_hand: number;
          reserved: number;
        }[];
      };
      void_pos_transaction_atomic: {
        Args: {
          p_location_id: string;
          p_retailer_id: string;
          p_staff_id?: string;
          p_transaction_id: string;
          p_void_reason: string;
        };
        Returns: Json;
      };
      wardrobe_item_self_scan_eligible: {
        Args: { p_item: Database["public"]["Tables"]["wardrobe_items"]["Row"] };
        Returns: boolean;
      };
    };
    Enums: {
      ai_generation_kind:
        | "next_best_action"
        | "product_recommendation"
        | "communication_draft"
        | "import_enrichment"
        | "tableservice_grounded";
      ai_generation_status: "succeeded" | "failed";
      alteration_attachment_kind:
        "intake" | "label" | "evidence" | "progress" | "completion";
      alteration_fulfillment_method: "pickup" | "delivery";
      alteration_fulfillment_status:
        "scheduled" | "ready" | "dispatched" | "completed" | "canceled";
      alteration_price_list_kind: "retailer" | "workshop";
      alteration_status:
        | "requested"
        | "measured"
        | "in_progress"
        | "ready_for_fitting"
        | "ready_for_pickup"
        | "complete";
      alteration_task_status:
        | "proposed"
        | "approved"
        | "assigned"
        | "in_progress"
        | "review_ready"
        | "completed"
        | "canceled";
      alteration_work_order_status:
        | "intake"
        | "quoted"
        | "awaiting_approval"
        | "approved"
        | "assigned"
        | "in_progress"
        | "completion_review"
        | "ready_for_pickup"
        | "out_for_delivery"
        | "completed"
        | "canceled";
      appointment_status:
        | "requested"
        | "confirmed"
        | "checked_in"
        | "completed"
        | "canceled"
        | "no_show";
      appointment_type:
        | "styling_consultation"
        | "fitting"
        | "alteration_fitting"
        | "personal_shopping"
        | "event";
      catalogue_import_row_status:
        "pending" | "valid" | "rejected" | "published";
      catalogue_import_source_type: "csv" | "xlsx" | "json" | "pdf";
      catalogue_import_status:
        | "uploaded"
        | "previewing"
        | "ready"
        | "publishing"
        | "completed"
        | "failed";
      commercial_inquiry_type:
        "personalized_demo" | "consultation" | "paid_pilot";
      commercial_prospect_stage:
        | "researched"
        | "qualified"
        | "demo_preparation"
        | "demo_ready"
        | "demo_sent"
        | "consultation"
        | "proposal"
        | "pilot"
        | "converted"
        | "lost";
      completion_review_status: "pending" | "approved" | "changes_requested";
      custody_event_type:
        | "received"
        | "handed_to_workshop"
        | "returned_to_retailer"
        | "released_to_customer"
        | "delivery_dispatch"
        | "delivery_complete";
      customer_lifecycle_stage:
        "prospect" | "first_purchase" | "returning" | "vip" | "lapsed";
      demo_configuration_status: "draft" | "review_ready" | "published";
      event_rsvp_status: "invited" | "attending" | "declined" | "attended";
      event_status: "draft" | "published" | "cancelled" | "completed";
      event_visibility: "public" | "invite_only" | "vip_tier";
      garment_identification_state: "verified" | "needs_verification";
      garment_source_kind: "external" | "finished_mtm";
      knowledge_commercial_intent:
        | "educate"
        | "justify_premium"
        | "upgrade"
        | "cross_sell"
        | "appointment";
      knowledge_display_type:
        | "information_card"
        | "accordion"
        | "tooltip"
        | "comparison"
        | "advisor_answer";
      knowledge_topic:
        | "mill"
        | "fibre"
        | "fabric"
        | "weave"
        | "construction"
        | "collar"
        | "styling"
        | "care"
        | "performance"
        | "occasion"
        | "value"
        | "tradeoff";
      loyalty_entry_type:
        | "earn_purchase"
        | "earn_referral"
        | "earn_bonus"
        | "redeem_reward"
        | "adjustment_expiry"
        | "adjustment_manual";
      loyalty_milestone_award_status: "awarded" | "reversed";
      loyalty_milestone_kind:
        | "first_commission"
        | "repeat_order"
        | "new_category"
        | "premium_construction"
        | "advanced_fabric"
        | "custom";
      loyalty_tier: "member" | "silver" | "gold" | "platinum";
      message_sender_type: "customer" | "staff" | "ai_assistant" | "guest";
      metadata_concept_kind:
        | "mill"
        | "fabric_collection"
        | "fibre"
        | "weave"
        | "weight_band"
        | "pattern"
        | "colour"
        | "season"
        | "garment_type"
        | "construction"
        | "fit"
        | "formality"
        | "climate"
        | "performance"
        | "care"
        | "style"
        | "occasion"
        | "compatibility"
        | "collar"
        | "silhouette";
      metadata_edge_kind:
        | "parent"
        | "related"
        | "equivalent"
        | "suggests"
        | "compatible_with"
        | "incompatible_with";
      metadata_review_status: "pending" | "accepted" | "rejected";
      metadata_review_task_status:
        "pending" | "accepted" | "rejected" | "dismissed";
      metadata_source: "supplier" | "ai" | "retailer" | "paon";
      metadata_target_type: "product" | "product_variant" | "wardrobe_item";
      notification_category:
        | "order_update"
        | "production_update"
        | "alteration_update"
        | "appointment_reminder"
        | "loyalty_update"
        | "message"
        | "marketing"
        | "system";
      notification_channel: "email" | "sms" | "push" | "in_app";
      order_channel: "online" | "in_store" | "clienteling" | "phone";
      order_status:
        | "draft"
        | "pending_payment"
        | "placed"
        | "in_production"
        | "ready_for_fulfillment"
        | "shipped"
        | "delivered"
        | "completed"
        | "canceled"
        | "refunded";
      payment_status:
        "pending" | "authorized" | "captured" | "refunded" | "failed";
      platform_role:
        | "platform_owner"
        | "platform_admin"
        | "support_agent"
        | "platform_analyst";
      price_change_proposal_status:
        "pending" | "approved" | "rejected" | "withdrawn";
      product_status: "draft" | "active" | "archived";
      prospect_demo_environment_status:
        "draft" | "published" | "revoked" | "expired";
      redemption_status: "issued" | "used" | "cancelled";
      referral_status:
        "invited" | "signed_up" | "first_purchase_completed" | "rewarded";
      retailer_role:
        | "read_only"
        | "production_staff"
        | "sales_associate"
        | "manager"
        | "admin"
        | "owner"
        | "workshop_manager"
        | "worker";
      retailer_status:
        "pending_onboarding" | "active" | "suspended" | "churned";
      retailer_tier: "boutique" | "house" | "maison";
      reward_type:
        "discount_percent" | "discount_fixed" | "gift" | "early_access";
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
        | "incomplete_expired"
        | "unpaid"
        | "paused";
      wedding_party_member_fitting_status:
        "invited" | "scheduled" | "fitted" | "completed";
      wedding_party_member_role:
        "groom" | "best_man" | "groomsman" | "father_of_groom" | "other";
      wedding_party_status:
        "planning" | "confirmed" | "completed" | "cancelled";
      work_classification: "work_now" | "future_order_note";
      workshop_status: "active" | "inactive";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      ai_generation_kind: [
        "next_best_action",
        "product_recommendation",
        "communication_draft",
        "import_enrichment",
        "tableservice_grounded",
      ],
      ai_generation_status: ["succeeded", "failed"],
      alteration_attachment_kind: [
        "intake",
        "label",
        "evidence",
        "progress",
        "completion",
      ],
      alteration_fulfillment_method: ["pickup", "delivery"],
      alteration_fulfillment_status: [
        "scheduled",
        "ready",
        "dispatched",
        "completed",
        "canceled",
      ],
      alteration_price_list_kind: ["retailer", "workshop"],
      alteration_status: [
        "requested",
        "measured",
        "in_progress",
        "ready_for_fitting",
        "ready_for_pickup",
        "complete",
      ],
      alteration_task_status: [
        "proposed",
        "approved",
        "assigned",
        "in_progress",
        "review_ready",
        "completed",
        "canceled",
      ],
      alteration_work_order_status: [
        "intake",
        "quoted",
        "awaiting_approval",
        "approved",
        "assigned",
        "in_progress",
        "completion_review",
        "ready_for_pickup",
        "out_for_delivery",
        "completed",
        "canceled",
      ],
      appointment_status: [
        "requested",
        "confirmed",
        "checked_in",
        "completed",
        "canceled",
        "no_show",
      ],
      appointment_type: [
        "styling_consultation",
        "fitting",
        "alteration_fitting",
        "personal_shopping",
        "event",
      ],
      catalogue_import_row_status: [
        "pending",
        "valid",
        "rejected",
        "published",
      ],
      catalogue_import_source_type: ["csv", "xlsx", "json", "pdf"],
      catalogue_import_status: [
        "uploaded",
        "previewing",
        "ready",
        "publishing",
        "completed",
        "failed",
      ],
      commercial_inquiry_type: [
        "personalized_demo",
        "consultation",
        "paid_pilot",
      ],
      commercial_prospect_stage: [
        "researched",
        "qualified",
        "demo_preparation",
        "demo_ready",
        "demo_sent",
        "consultation",
        "proposal",
        "pilot",
        "converted",
        "lost",
      ],
      completion_review_status: ["pending", "approved", "changes_requested"],
      custody_event_type: [
        "received",
        "handed_to_workshop",
        "returned_to_retailer",
        "released_to_customer",
        "delivery_dispatch",
        "delivery_complete",
      ],
      customer_lifecycle_stage: [
        "prospect",
        "first_purchase",
        "returning",
        "vip",
        "lapsed",
      ],
      demo_configuration_status: ["draft", "review_ready", "published"],
      event_rsvp_status: ["invited", "attending", "declined", "attended"],
      event_status: ["draft", "published", "cancelled", "completed"],
      event_visibility: ["public", "invite_only", "vip_tier"],
      garment_identification_state: ["verified", "needs_verification"],
      garment_source_kind: ["external", "finished_mtm"],
      knowledge_commercial_intent: [
        "educate",
        "justify_premium",
        "upgrade",
        "cross_sell",
        "appointment",
      ],
      knowledge_display_type: [
        "information_card",
        "accordion",
        "tooltip",
        "comparison",
        "advisor_answer",
      ],
      knowledge_topic: [
        "mill",
        "fibre",
        "fabric",
        "weave",
        "construction",
        "collar",
        "styling",
        "care",
        "performance",
        "occasion",
        "value",
        "tradeoff",
      ],
      loyalty_entry_type: [
        "earn_purchase",
        "earn_referral",
        "earn_bonus",
        "redeem_reward",
        "adjustment_expiry",
        "adjustment_manual",
      ],
      loyalty_milestone_award_status: ["awarded", "reversed"],
      loyalty_milestone_kind: [
        "first_commission",
        "repeat_order",
        "new_category",
        "premium_construction",
        "advanced_fabric",
        "custom",
      ],
      loyalty_tier: ["member", "silver", "gold", "platinum"],
      message_sender_type: ["customer", "staff", "ai_assistant", "guest"],
      metadata_concept_kind: [
        "mill",
        "fabric_collection",
        "fibre",
        "weave",
        "weight_band",
        "pattern",
        "colour",
        "season",
        "garment_type",
        "construction",
        "fit",
        "formality",
        "climate",
        "performance",
        "care",
        "style",
        "occasion",
        "compatibility",
        "collar",
        "silhouette",
      ],
      metadata_edge_kind: [
        "parent",
        "related",
        "equivalent",
        "suggests",
        "compatible_with",
        "incompatible_with",
      ],
      metadata_review_status: ["pending", "accepted", "rejected"],
      metadata_review_task_status: [
        "pending",
        "accepted",
        "rejected",
        "dismissed",
      ],
      metadata_source: ["supplier", "ai", "retailer", "paon"],
      metadata_target_type: ["product", "product_variant", "wardrobe_item"],
      notification_category: [
        "order_update",
        "production_update",
        "alteration_update",
        "appointment_reminder",
        "loyalty_update",
        "message",
        "marketing",
        "system",
      ],
      notification_channel: ["email", "sms", "push", "in_app"],
      order_channel: ["online", "in_store", "clienteling", "phone"],
      order_status: [
        "draft",
        "pending_payment",
        "placed",
        "in_production",
        "ready_for_fulfillment",
        "shipped",
        "delivered",
        "completed",
        "canceled",
        "refunded",
      ],
      payment_status: [
        "pending",
        "authorized",
        "captured",
        "refunded",
        "failed",
      ],
      platform_role: [
        "platform_owner",
        "platform_admin",
        "support_agent",
        "platform_analyst",
      ],
      price_change_proposal_status: [
        "pending",
        "approved",
        "rejected",
        "withdrawn",
      ],
      product_status: ["draft", "active", "archived"],
      prospect_demo_environment_status: [
        "draft",
        "published",
        "revoked",
        "expired",
      ],
      redemption_status: ["issued", "used", "cancelled"],
      referral_status: [
        "invited",
        "signed_up",
        "first_purchase_completed",
        "rewarded",
      ],
      retailer_role: [
        "read_only",
        "production_staff",
        "sales_associate",
        "manager",
        "admin",
        "owner",
        "workshop_manager",
        "worker",
      ],
      retailer_status: ["pending_onboarding", "active", "suspended", "churned"],
      retailer_tier: ["boutique", "house", "maison"],
      reward_type: [
        "discount_percent",
        "discount_fixed",
        "gift",
        "early_access",
      ],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "incomplete",
        "incomplete_expired",
        "unpaid",
        "paused",
      ],
      wedding_party_member_fitting_status: [
        "invited",
        "scheduled",
        "fitted",
        "completed",
      ],
      wedding_party_member_role: [
        "groom",
        "best_man",
        "groomsman",
        "father_of_groom",
        "other",
      ],
      wedding_party_status: ["planning", "confirmed", "completed", "cancelled"],
      work_classification: ["work_now", "future_order_note"],
      workshop_status: ["active", "inactive"],
    },
  },
} as const;
