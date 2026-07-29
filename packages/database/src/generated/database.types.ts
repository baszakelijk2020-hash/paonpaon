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
      appointments: {
        Row: {
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
          created_at: string;
          customer_id: string | null;
          id: string;
          name: string;
          occurred_at: string;
          properties: Json;
          retailer_id: string;
          source: string;
        };
        Insert: {
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          name: string;
          occurred_at?: string;
          properties?: Json;
          retailer_id: string;
          source: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          name?: string;
          occurred_at?: string;
          properties?: Json;
          retailer_id?: string;
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
      conversations: {
        Row: {
          created_at: string;
          customer_id: string;
          deleted_at: string | null;
          id: string;
          intent: string | null;
          last_message_at: string | null;
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
            foreignKeyName: "conversations_retailer_id_fkey";
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
      customer_preferences: {
        Row: {
          communication_channels: string[];
          created_at: string;
          customer_id: string;
          marketing_opt_in: boolean;
          preferred_currency: string;
          preferred_locale: string;
          style_notes: string | null;
          updated_at: string;
        };
        Insert: {
          communication_channels?: string[];
          created_at?: string;
          customer_id: string;
          marketing_opt_in?: boolean;
          preferred_currency?: string;
          preferred_locale?: string;
          style_notes?: string | null;
          updated_at?: string;
        };
        Update: {
          communication_channels?: string[];
          created_at?: string;
          customer_id?: string;
          marketing_opt_in?: boolean;
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
      assign_alteration_work_order: {
        Args: {
          p_alteration_id: string;
          p_target_completion_date: string;
          p_workshop_id: string;
        };
        Returns: undefined;
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
          p_customer_id?: string;
          p_name: string;
          p_occurred_at?: string;
          p_properties?: Json;
          p_retailer_id: string;
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
      convert_pilot_to_live_retailer: {
        Args: { p_prospect_id: string };
        Returns: string;
      };
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
      mark_conversation_read: {
        Args: { p_conversation_id: string };
        Returns: undefined;
      };
      next_alteration_work_order_number: { Args: never; Returns: string };
      next_order_number: { Args: never; Returns: string };
      open_prospect_demo: {
        Args: { p_access_code: string; p_public_token: string };
        Returns: Json;
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
      redeem_my_reward: { Args: { p_reward_id: string }; Returns: string };
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
      restore_retailer_brand_theme: {
        Args: { p_retailer_id: string; p_version_number: number };
        Returns: number;
      };
      retailer_has_entitlement: {
        Args: { p_feature_key: string; p_retailer_id: string };
        Returns: boolean;
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
      subscribe_to_newsletter: {
        Args: { p_email: string; p_retailer_id: string };
        Returns: undefined;
      };
      toggle_wishlist_item: {
        Args: { p_retailer_id: string; p_variant_id: string };
        Returns: boolean;
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
      search_catalogue_products: {
        Args: {
          p_concept_ids?: string[] | null;
          p_max_price_minor?: number | null;
          p_max_weight?: number | null;
          p_min_price_minor?: number | null;
          p_min_weight?: number | null;
          p_page?: number;
          p_page_size?: number;
          p_query?: string | null;
          p_retailer_id: string;
          p_sort?: string;
        };
        Returns: {
          product_id: string;
          relevance_score: number;
          total_count: number;
        }[];
      };
      list_catalogue_facets: {
        Args: {
          p_retailer_id: string;
        };
        Returns: {
          concept_id: string;
          concept_kind: string;
          concept_label: string;
          concept_slug: string;
          product_count: number;
        }[];
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
    };
    Enums: {
      ai_generation_kind:
        "next_best_action" | "product_recommendation" | "communication_draft";
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
