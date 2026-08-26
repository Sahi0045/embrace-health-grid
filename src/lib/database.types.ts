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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admission_events: {
        Row: {
          admission_id: string
          bed_id_new: string | null
          bed_id_old: string | null
          event_id: string
          event_type: string
          hospital_id: string | null
          occurred_at: string
          patient_did: string
          performed_by: string | null
          performed_by_name: string | null
          performed_by_role: string | null
          reason: string | null
          room_new: string | null
          room_old: string | null
          snapshot_after: Json | null
          snapshot_before: Json | null
          status_new: string | null
          status_old: string | null
          ward_new: string | null
          ward_old: string | null
        }
        Insert: {
          admission_id: string
          bed_id_new?: string | null
          bed_id_old?: string | null
          event_id?: string
          event_type: string
          hospital_id?: string | null
          occurred_at?: string
          patient_did: string
          performed_by?: string | null
          performed_by_name?: string | null
          performed_by_role?: string | null
          reason?: string | null
          room_new?: string | null
          room_old?: string | null
          snapshot_after?: Json | null
          snapshot_before?: Json | null
          status_new?: string | null
          status_old?: string | null
          ward_new?: string | null
          ward_old?: string | null
        }
        Update: {
          admission_id?: string
          bed_id_new?: string | null
          bed_id_old?: string | null
          event_id?: string
          event_type?: string
          hospital_id?: string | null
          occurred_at?: string
          patient_did?: string
          performed_by?: string | null
          performed_by_name?: string | null
          performed_by_role?: string | null
          reason?: string | null
          room_new?: string | null
          room_old?: string | null
          snapshot_after?: Json | null
          snapshot_before?: Json | null
          status_new?: string | null
          status_old?: string | null
          ward_new?: string | null
          ward_old?: string | null
        }
        Relationships: []
      }
      admissions: {
        Row: {
          admission_id: string
          admitted_at: string
          admitting_doctor: string | null
          bed: string | null
          diagnosis: string | null
          discharged_at: string | null
          expected_discharge: string | null
          hospital_id: string | null
          patient_did: string
          room: string | null
          status: Database["public"]["Enums"]["admission_status"]
          ward: string | null
        }
        Insert: {
          admission_id: string
          admitted_at?: string
          admitting_doctor?: string | null
          bed?: string | null
          diagnosis?: string | null
          discharged_at?: string | null
          expected_discharge?: string | null
          hospital_id?: string | null
          patient_did: string
          room?: string | null
          status?: Database["public"]["Enums"]["admission_status"]
          ward?: string | null
        }
        Update: {
          admission_id?: string
          admitted_at?: string
          admitting_doctor?: string | null
          bed?: string | null
          diagnosis?: string | null
          discharged_at?: string | null
          expected_discharge?: string | null
          hospital_id?: string | null
          patient_did?: string
          room?: string | null
          status?: Database["public"]["Enums"]["admission_status"]
          ward?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admissions_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "admissions_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "admissions_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      ambulances: {
        Row: {
          ambulance_id: string
          current_location: string | null
          driver_name: string | null
          hospital_id: string | null
          registration: string
          status: Database["public"]["Enums"]["asset_status"]
          updated_at: string
          vehicle_type: string | null
        }
        Insert: {
          ambulance_id: string
          current_location?: string | null
          driver_name?: string | null
          hospital_id?: string | null
          registration: string
          status?: Database["public"]["Enums"]["asset_status"]
          updated_at?: string
          vehicle_type?: string | null
        }
        Update: {
          ambulance_id?: string
          current_location?: string | null
          driver_name?: string | null
          hospital_id?: string | null
          registration?: string
          status?: Database["public"]["Enums"]["asset_status"]
          updated_at?: string
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ambulances_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      appointments: {
        Row: {
          appt_id: string
          booked_at: string
          doctor_did: string
          hospital_id: string | null
          mode: string
          patient_did: string
          reason: string | null
          slot: string
          specialty: string | null
          status: Database["public"]["Enums"]["appt_status"]
          suggested_slot: string | null
          updated_at: string
        }
        Insert: {
          appt_id: string
          booked_at?: string
          doctor_did: string
          hospital_id?: string | null
          mode?: string
          patient_did: string
          reason?: string | null
          slot: string
          specialty?: string | null
          status?: Database["public"]["Enums"]["appt_status"]
          suggested_slot?: string | null
          updated_at?: string
        }
        Update: {
          appt_id?: string
          booked_at?: string
          doctor_did?: string
          hospital_id?: string | null
          mode?: string
          patient_did?: string
          reason?: string | null
          slot?: string
          specialty?: string | null
          status?: Database["public"]["Enums"]["appt_status"]
          suggested_slot?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_doctor_did_fkey"
            columns: ["doctor_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "appointments_doctor_did_fkey"
            columns: ["doctor_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
          {
            foreignKeyName: "appointments_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "appointments_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "appointments_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      attendance: {
        Row: {
          action: Database["public"]["Enums"]["attendance_action"]
          attendance_id: number
          hospital_id: string | null
          location: string | null
          recorded_at: string
          staff_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["attendance_action"]
          attendance_id?: number
          hospital_id?: string | null
          location?: string | null
          recorded_at?: string
          staff_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["attendance_action"]
          attendance_id?: number
          hospital_id?: string | null
          location?: string | null
          recorded_at?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_anchor_queue: {
        Row: {
          actor_did: string
          attempts: number
          last_error: string | null
          processed_at: string | null
          queue_id: string
          queued_at: string
          record_hash: string
          record_type: string
          tx_id: string
        }
        Insert: {
          actor_did: string
          attempts?: number
          last_error?: string | null
          processed_at?: string | null
          queue_id?: string
          queued_at?: string
          record_hash: string
          record_type?: string
          tx_id: string
        }
        Update: {
          actor_did?: string
          attempts?: number
          last_error?: string | null
          processed_at?: string | null
          queue_id?: string
          queued_at?: string
          record_hash?: string
          record_type?: string
          tx_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_anchor_queue_tx_id_fkey"
            columns: ["tx_id"]
            isOneToOne: false
            referencedRelation: "audit_events"
            referencedColumns: ["tx_id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_did: string | null
          actor_id: string | null
          anchor_id: string | null
          anchor_status: string | null
          auth_policy: string | null
          auth_status: string | null
          logged_at: string
          metadata: Json
          new_value: Json | null
          outcome: string
          prev_value: Json | null
          record_hash: string | null
          resource: string | null
          severity: string
          tx_id: string
          what_entity_id: string | null
          what_entity_type: string | null
          what_module: string | null
          where_hospital: string | null
          where_location: string | null
          who_email: string | null
          who_hospital_id: string | null
          who_name: string | null
          who_role: string | null
        }
        Insert: {
          action: string
          actor_did?: string | null
          actor_id?: string | null
          anchor_id?: string | null
          anchor_status?: string | null
          auth_policy?: string | null
          auth_status?: string | null
          logged_at?: string
          metadata?: Json
          new_value?: Json | null
          outcome: string
          prev_value?: Json | null
          record_hash?: string | null
          resource?: string | null
          severity?: string
          tx_id?: string
          what_entity_id?: string | null
          what_entity_type?: string | null
          what_module?: string | null
          where_hospital?: string | null
          where_location?: string | null
          who_email?: string | null
          who_hospital_id?: string | null
          who_name?: string | null
          who_role?: string | null
        }
        Update: {
          action?: string
          actor_did?: string | null
          actor_id?: string | null
          anchor_id?: string | null
          anchor_status?: string | null
          auth_policy?: string | null
          auth_status?: string | null
          logged_at?: string
          metadata?: Json
          new_value?: Json | null
          outcome?: string
          prev_value?: Json | null
          record_hash?: string | null
          resource?: string | null
          severity?: string
          tx_id?: string
          what_entity_id?: string | null
          what_entity_type?: string | null
          what_module?: string | null
          where_hospital?: string | null
          where_location?: string | null
          who_email?: string | null
          who_hospital_id?: string | null
          who_name?: string | null
          who_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      beds: {
        Row: {
          bed_id: string
          bed_number: string | null
          bed_type: string | null
          building_id: string | null
          created_at: string
          hospital_id: string | null
          patient_did: string | null
          room_id: string | null
          status: Database["public"]["Enums"]["bed_status"]
          updated_at: string
          ward_id: string | null
          ward_name_legacy: string
        }
        Insert: {
          bed_id: string
          bed_number?: string | null
          bed_type?: string | null
          building_id?: string | null
          created_at?: string
          hospital_id?: string | null
          patient_did?: string | null
          room_id?: string | null
          status?: Database["public"]["Enums"]["bed_status"]
          updated_at?: string
          ward_id?: string | null
          ward_name_legacy: string
        }
        Update: {
          bed_id?: string
          bed_number?: string | null
          bed_type?: string | null
          building_id?: string | null
          created_at?: string
          hospital_id?: string | null
          patient_did?: string | null
          room_id?: string | null
          status?: Database["public"]["Enums"]["bed_status"]
          updated_at?: string
          ward_id?: string | null
          ward_name_legacy?: string
        }
        Relationships: [
          {
            foreignKeyName: "beds_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["building_id"]
          },
          {
            foreignKeyName: "beds_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["building_id"]
          },
          {
            foreignKeyName: "beds_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "beds_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "beds_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
          {
            foreignKeyName: "beds_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "beds_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["ward_id"]
          },
        ]
      }
      billing_accounts: {
        Row: {
          hospital_id: string | null
          outstanding: number
          patient_did: string
          total_billed: number
          total_paid: number
          updated_at: string
        }
        Insert: {
          hospital_id?: string | null
          outstanding?: number
          patient_did: string
          total_billed?: number
          total_paid?: number
          updated_at?: string
        }
        Update: {
          hospital_id?: string | null
          outstanding?: number
          patient_did?: string
          total_billed?: number
          total_paid?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_accounts_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "billing_accounts_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: true
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "billing_accounts_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: true
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      buildings: {
        Row: {
          building_code: string | null
          building_id: string
          building_name: string
          created_at: string
          description: string | null
          hospital_id: string
          total_floors: number
          updated_at: string
        }
        Insert: {
          building_code?: string | null
          building_id?: string
          building_name: string
          created_at?: string
          description?: string | null
          hospital_id: string
          total_floors?: number
          updated_at?: string
        }
        Update: {
          building_code?: string | null
          building_id?: string
          building_name?: string
          created_at?: string
          description?: string | null
          hospital_id?: string
          total_floors?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buildings_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      cafeteria_menu_items: {
        Row: {
          allergens: string[]
          available_for: string
          calories: number
          category: string
          created_at: string
          description: string | null
          dietary_tags: string[]
          hospital_id: string | null
          menu_item_id: string
          name: string
          price: number
          status: string
          updated_at: string
        }
        Insert: {
          allergens?: string[]
          available_for?: string
          calories?: number
          category: string
          created_at?: string
          description?: string | null
          dietary_tags?: string[]
          hospital_id?: string | null
          menu_item_id?: string
          name: string
          price?: number
          status?: string
          updated_at?: string
        }
        Update: {
          allergens?: string[]
          available_for?: string
          calories?: number
          category?: string
          created_at?: string
          description?: string | null
          dietary_tags?: string[]
          hospital_id?: string | null
          menu_item_id?: string
          name?: string
          price?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafeteria_menu_items_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      cafeteria_vendors: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          contract_expiry: string | null
          contract_status: string
          created_at: string
          hospital_id: string | null
          last_delivery_at: string | null
          name: string
          rating: number | null
          supplied_categories: string[]
          updated_at: string
          vendor_id: string
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contract_expiry?: string | null
          contract_status?: string
          created_at?: string
          hospital_id?: string | null
          last_delivery_at?: string | null
          name: string
          rating?: number | null
          supplied_categories?: string[]
          updated_at?: string
          vendor_id?: string
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contract_expiry?: string | null
          contract_status?: string
          created_at?: string
          hospital_id?: string | null
          last_delivery_at?: string | null
          name?: string
          rating?: number | null
          supplied_categories?: string[]
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cafeteria_vendors_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      certification_audit_log: {
        Row: {
          action: string
          audit_id: string
          cert_id: string
          field_changed: string | null
          full_snapshot: Json | null
          hospital_id: string | null
          logged_at: string
          new_value: string | null
          old_value: string | null
          performed_by: string | null
          performed_by_name: string | null
          performed_by_role: string | null
          reason: string | null
          staff_did: string
        }
        Insert: {
          action: string
          audit_id?: string
          cert_id: string
          field_changed?: string | null
          full_snapshot?: Json | null
          hospital_id?: string | null
          logged_at?: string
          new_value?: string | null
          old_value?: string | null
          performed_by?: string | null
          performed_by_name?: string | null
          performed_by_role?: string | null
          reason?: string | null
          staff_did: string
        }
        Update: {
          action?: string
          audit_id?: string
          cert_id?: string
          field_changed?: string | null
          full_snapshot?: Json | null
          hospital_id?: string | null
          logged_at?: string
          new_value?: string | null
          old_value?: string | null
          performed_by?: string | null
          performed_by_name?: string | null
          performed_by_role?: string | null
          reason?: string | null
          staff_did?: string
        }
        Relationships: [
          {
            foreignKeyName: "certification_audit_log_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      consents: {
        Row: {
          access_started_at: string | null
          approved_at: string | null
          doctor_did: string
          doctor_name: string | null
          doctor_specialty: string | null
          expires_at: string | null
          grant_id: string
          granted_at: string
          patient_did: string
          reason: string | null
          rejected_at: string | null
          requested_at: string | null
          resource: string
          revoked_at: string | null
          status: Database["public"]["Enums"]["consent_status"]
        }
        Insert: {
          access_started_at?: string | null
          approved_at?: string | null
          doctor_did: string
          doctor_name?: string | null
          doctor_specialty?: string | null
          expires_at?: string | null
          grant_id: string
          granted_at?: string
          patient_did: string
          reason?: string | null
          rejected_at?: string | null
          requested_at?: string | null
          resource: string
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["consent_status"]
        }
        Update: {
          access_started_at?: string | null
          approved_at?: string | null
          doctor_did?: string
          doctor_name?: string | null
          doctor_specialty?: string | null
          expires_at?: string | null
          grant_id?: string
          granted_at?: string
          patient_did?: string
          reason?: string | null
          rejected_at?: string | null
          requested_at?: string | null
          resource?: string
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["consent_status"]
        }
        Relationships: [
          {
            foreignKeyName: "consents_doctor_did_fkey"
            columns: ["doctor_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "consents_doctor_did_fkey"
            columns: ["doctor_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
          {
            foreignKeyName: "consents_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "consents_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      credentials: {
        Row: {
          claims: Json
          credential_type: string
          expires_at: string | null
          id: string
          issued_at: string
          issuer: string
          signature: string
          status: string
          subject_did: string
        }
        Insert: {
          claims?: Json
          credential_type: string
          expires_at?: string | null
          id: string
          issued_at?: string
          issuer: string
          signature: string
          status?: string
          subject_did: string
        }
        Update: {
          claims?: Json
          credential_type?: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          issuer?: string
          signature?: string
          status?: string
          subject_did?: string
        }
        Relationships: [
          {
            foreignKeyName: "credentials_subject_did_fkey"
            columns: ["subject_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "credentials_subject_did_fkey"
            columns: ["subject_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      daily_checkups: {
        Row: {
          checkup_at: string
          checkup_id: string
          checkup_type: string | null
          doctor: string | null
          findings: Json
          hospital_id: string | null
          notes: string | null
          patient_did: string
          specialty: string | null
        }
        Insert: {
          checkup_at?: string
          checkup_id: string
          checkup_type?: string | null
          doctor?: string | null
          findings?: Json
          hospital_id?: string | null
          notes?: string | null
          patient_did: string
          specialty?: string | null
        }
        Update: {
          checkup_at?: string
          checkup_id?: string
          checkup_type?: string | null
          doctor?: string | null
          findings?: Json
          hospital_id?: string | null
          notes?: string | null
          patient_did?: string
          specialty?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_checkups_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "daily_checkups_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "daily_checkups_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      dids: {
        Row: {
          controller: string
          created_at: string
          did: string
          hospital_id: string | null
          is_organisation: boolean
          owner_id: string | null
          owner_name: string
          owner_type: Database["public"]["Enums"]["user_role"]
          public_key: string
          service_endpoint: string | null
          status: Database["public"]["Enums"]["did_status"]
          updated_at: string
        }
        Insert: {
          controller: string
          created_at?: string
          did: string
          hospital_id?: string | null
          is_organisation?: boolean
          owner_id?: string | null
          owner_name: string
          owner_type: Database["public"]["Enums"]["user_role"]
          public_key: string
          service_endpoint?: string | null
          status?: Database["public"]["Enums"]["did_status"]
          updated_at?: string
        }
        Update: {
          controller?: string
          created_at?: string
          did?: string
          hospital_id?: string | null
          is_organisation?: boolean
          owner_id?: string | null
          owner_name?: string
          owner_type?: Database["public"]["Enums"]["user_role"]
          public_key?: string
          service_endpoint?: string | null
          status?: Database["public"]["Enums"]["did_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dids_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "dids_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_orders: {
        Row: {
          diet_id: string
          diet_type: string
          hospital_id: string | null
          ordered_by: string | null
          patient_did: string
          restrictions: Json
          special_instructions: string | null
          started_on: string | null
        }
        Insert: {
          diet_id: string
          diet_type: string
          hospital_id?: string | null
          ordered_by?: string | null
          patient_did: string
          restrictions?: Json
          special_instructions?: string | null
          started_on?: string | null
        }
        Update: {
          diet_id?: string
          diet_type?: string
          hospital_id?: string | null
          ordered_by?: string | null
          patient_did?: string
          restrictions?: Json
          special_instructions?: string | null
          started_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diet_orders_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "diet_orders_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "diet_orders_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      dietary_requirements: {
        Row: {
          allergies: string[]
          created_at: string
          hospital_id: string | null
          meal_plan_status: string
          notes: string | null
          patient_did: string
          patient_mrn: string | null
          patient_name: string
          prescribed_by: string | null
          requirement_id: string
          requirements: string[]
          room_number: string | null
          updated_at: string
        }
        Insert: {
          allergies?: string[]
          created_at?: string
          hospital_id?: string | null
          meal_plan_status?: string
          notes?: string | null
          patient_did: string
          patient_mrn?: string | null
          patient_name?: string
          prescribed_by?: string | null
          requirement_id?: string
          requirements?: string[]
          room_number?: string | null
          updated_at?: string
        }
        Update: {
          allergies?: string[]
          created_at?: string
          hospital_id?: string | null
          meal_plan_status?: string
          notes?: string | null
          patient_did?: string
          patient_mrn?: string | null
          patient_name?: string
          prescribed_by?: string | null
          requirement_id?: string
          requirements?: string[]
          room_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dietary_requirements_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      embedded_wallets: {
        Row: {
          created_at: string
          derivation_path: string
          encrypted_private_key: string
          encryption_key_version: number
          hospital_id: string
          is_active: boolean
          last_used_at: string | null
          owner_id: string
          owner_type: string
          public_key: string
          updated_at: string
          wallet_id: string
        }
        Insert: {
          created_at?: string
          derivation_path?: string
          encrypted_private_key: string
          encryption_key_version?: number
          hospital_id: string
          is_active?: boolean
          last_used_at?: string | null
          owner_id: string
          owner_type?: string
          public_key: string
          updated_at?: string
          wallet_id?: string
        }
        Update: {
          created_at?: string
          derivation_path?: string
          encrypted_private_key?: string
          encryption_key_version?: number
          hospital_id?: string
          is_active?: boolean
          last_used_at?: string | null
          owner_id?: string
          owner_type?: string
          public_key?: string
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "embedded_wallets_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      emergency_broadcasts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          broadcast_code: string
          broadcast_id: string
          created_at: string
          hospital_id: string | null
          initiator_did: string
          initiator_name: string
          location: string
          message: string
          metadata: Json | null
          resolved_at: string | null
          severity: string
          status: string
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          broadcast_code: string
          broadcast_id?: string
          created_at?: string
          hospital_id?: string | null
          initiator_did: string
          initiator_name: string
          location: string
          message: string
          metadata?: Json | null
          resolved_at?: string | null
          severity: string
          status?: string
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          broadcast_code?: string
          broadcast_id?: string
          created_at?: string
          hospital_id?: string | null
          initiator_did?: string
          initiator_name?: string
          location?: string
          message?: string
          metadata?: Json | null
          resolved_at?: string | null
          severity?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_broadcasts_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      equipment: {
        Row: {
          assigned_ward: string | null
          calibration_date: string | null
          category: string | null
          department: string | null
          did: string | null
          equipment_id: string
          equipment_type: string | null
          floor_number: number | null
          hospital_id: string | null
          last_serviced_on: string | null
          location: string | null
          manufacturer: string | null
          model: string | null
          name: string
          next_calibration: string | null
          next_service_on: string | null
          purchase_date: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["asset_status"]
          updated_at: string
          utilization_pct: number | null
          warranty_expiry: string | null
        }
        Insert: {
          assigned_ward?: string | null
          calibration_date?: string | null
          category?: string | null
          department?: string | null
          did?: string | null
          equipment_id: string
          equipment_type?: string | null
          floor_number?: number | null
          hospital_id?: string | null
          last_serviced_on?: string | null
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          name: string
          next_calibration?: string | null
          next_service_on?: string | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          updated_at?: string
          utilization_pct?: number | null
          warranty_expiry?: string | null
        }
        Update: {
          assigned_ward?: string | null
          calibration_date?: string | null
          category?: string | null
          department?: string | null
          did?: string | null
          equipment_id?: string
          equipment_type?: string | null
          floor_number?: number | null
          hospital_id?: string | null
          last_serviced_on?: string | null
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          next_calibration?: string | null
          next_service_on?: string | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          updated_at?: string
          utilization_pct?: number | null
          warranty_expiry?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      equipment_maintenance_log: {
        Row: {
          cost: number
          created_at: string
          description: string
          equipment_id: string
          hospital_id: string | null
          log_id: string
          maintenance_type: string
          next_due: string | null
          notes: string | null
          performed_at: string
          performed_by: string
          status: string
        }
        Insert: {
          cost?: number
          created_at?: string
          description: string
          equipment_id: string
          hospital_id?: string | null
          log_id: string
          maintenance_type: string
          next_due?: string | null
          notes?: string | null
          performed_at?: string
          performed_by: string
          status?: string
        }
        Update: {
          cost?: number
          created_at?: string
          description?: string
          equipment_id?: string
          hospital_id?: string | null
          log_id?: string
          maintenance_type?: string
          next_due?: string | null
          notes?: string | null
          performed_at?: string
          performed_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_maintenance_log_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["equipment_id"]
          },
          {
            foreignKeyName: "equipment_maintenance_log_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      expiration_alerts: {
        Row: {
          action_notes: string | null
          action_taken_at: string | null
          action_taken_by: string | null
          alert_id: string
          alert_raised_at: string
          batch_id: string
          days_until_expiry: number | null
          expiration_status: Database["public"]["Enums"]["expiration_status"]
          expiry_date: string
          hospital_id: string
          is_resolved: boolean
          item_id: string
          quantity_affected: number
        }
        Insert: {
          action_notes?: string | null
          action_taken_at?: string | null
          action_taken_by?: string | null
          alert_id?: string
          alert_raised_at?: string
          batch_id: string
          days_until_expiry?: number | null
          expiration_status: Database["public"]["Enums"]["expiration_status"]
          expiry_date: string
          hospital_id: string
          is_resolved?: boolean
          item_id: string
          quantity_affected: number
        }
        Update: {
          action_notes?: string | null
          action_taken_at?: string | null
          action_taken_by?: string | null
          alert_id?: string
          alert_raised_at?: string
          batch_id?: string
          days_until_expiry?: number | null
          expiration_status?: Database["public"]["Enums"]["expiration_status"]
          expiry_date?: string
          hospital_id?: string
          is_resolved?: boolean
          item_id?: string
          quantity_affected?: number
        }
        Relationships: [
          {
            foreignKeyName: "expiration_alerts_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "expiration_alerts_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "expiration_alerts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_items"
            referencedColumns: ["item_id"]
          },
        ]
      }
      feedback: {
        Row: {
          comments: string | null
          created_at: string
          doctor: string | null
          feedback_id: string
          patient_did: string
          rating: number
        }
        Insert: {
          comments?: string | null
          created_at?: string
          doctor?: string | null
          feedback_id: string
          patient_did: string
          rating: number
        }
        Update: {
          comments?: string | null
          created_at?: string
          doctor?: string | null
          feedback_id?: string
          patient_did?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "feedback_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "feedback_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      floors: {
        Row: {
          building_id: string
          created_at: string
          description: string | null
          floor_id: string
          floor_name: string
          floor_number: number
          hospital_id: string
          total_wards: number
          updated_at: string
        }
        Insert: {
          building_id: string
          created_at?: string
          description?: string | null
          floor_id?: string
          floor_name: string
          floor_number: number
          hospital_id: string
          total_wards?: number
          updated_at?: string
        }
        Update: {
          building_id?: string
          created_at?: string
          description?: string | null
          floor_id?: string
          floor_name?: string
          floor_number?: number
          hospital_id?: string
          total_wards?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "floors_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["building_id"]
          },
          {
            foreignKeyName: "floors_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["building_id"]
          },
          {
            foreignKeyName: "floors_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      food_wastage_logs: {
        Row: {
          cost_impact: number
          created_at: string
          date: string
          hospital_id: string | null
          item_name: string
          log_id: string
          logged_by: string
          meal_type: string
          quantity_wasted: number
          reason: string
          unit: string
        }
        Insert: {
          cost_impact?: number
          created_at?: string
          date?: string
          hospital_id?: string | null
          item_name: string
          log_id?: string
          logged_by?: string
          meal_type: string
          quantity_wasted?: number
          reason?: string
          unit?: string
        }
        Update: {
          cost_impact?: number
          created_at?: string
          date?: string
          hospital_id?: string | null
          item_name?: string
          log_id?: string
          logged_by?: string
          meal_type?: string
          quantity_wasted?: number
          reason?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_wastage_logs_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      fraud_alerts: {
        Row: {
          actor: string | null
          alert_id: string
          alert_type: string
          details: string | null
          detected_at: string
          hospital_id: string | null
          message: string
          resolved_at: string | null
          risk_score: number | null
          severity: Database["public"]["Enums"]["alert_severity"]
          status: Database["public"]["Enums"]["alert_status"]
        }
        Insert: {
          actor?: string | null
          alert_id: string
          alert_type: string
          details?: string | null
          detected_at?: string
          hospital_id?: string | null
          message: string
          resolved_at?: string | null
          risk_score?: number | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
        }
        Update: {
          actor?: string | null
          alert_id?: string
          alert_type?: string
          details?: string | null
          detected_at?: string
          hospital_id?: string | null
          message?: string
          resolved_at?: string | null
          risk_score?: number | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
        }
        Relationships: [
          {
            foreignKeyName: "fraud_alerts_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      governance_policies: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          hospital_id: string | null
          name: string
          policy_id: string
          status: Database["public"]["Enums"]["policy_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          hospital_id?: string | null
          name: string
          policy_id: string
          status?: Database["public"]["Enums"]["policy_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          hospital_id?: string | null
          name?: string
          policy_id?: string
          status?: Database["public"]["Enums"]["policy_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_policies_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "governance_policies_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      health_metrics: {
        Row: {
          bmi: number | null
          bp_diastolic: number | null
          bp_systolic: number | null
          cholesterol_hdl: number | null
          cholesterol_ldl: number | null
          cholesterol_total: number | null
          created_at: string
          hba1c: number | null
          hospital_id: string | null
          measured_on: string
          metric_id: number
          patient_did: string
          sugar_fasting: number | null
          sugar_post_meal: number | null
          weight_kg: number | null
        }
        Insert: {
          bmi?: number | null
          bp_diastolic?: number | null
          bp_systolic?: number | null
          cholesterol_hdl?: number | null
          cholesterol_ldl?: number | null
          cholesterol_total?: number | null
          created_at?: string
          hba1c?: number | null
          hospital_id?: string | null
          measured_on: string
          metric_id?: number
          patient_did: string
          sugar_fasting?: number | null
          sugar_post_meal?: number | null
          weight_kg?: number | null
        }
        Update: {
          bmi?: number | null
          bp_diastolic?: number | null
          bp_systolic?: number | null
          cholesterol_hdl?: number | null
          cholesterol_ldl?: number | null
          cholesterol_total?: number | null
          created_at?: string
          hba1c?: number | null
          hospital_id?: string | null
          measured_on?: string
          metric_id?: number
          patient_did?: string
          sugar_fasting?: number | null
          sugar_post_meal?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "health_metrics_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "health_metrics_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "health_metrics_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      hospitals: {
        Row: {
          city: string | null
          contact_email: string | null
          country: string | null
          created_at: string
          created_by: string | null
          hospital_did: string
          hospital_id: string
          name: string
          onchain_slot: number | null
          onchain_tx: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          contact_email?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          hospital_did: string
          hospital_id?: string
          name: string
          onchain_slot?: number | null
          onchain_tx?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          contact_email?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          hospital_did?: string
          hospital_id?: string
          name?: string
          onchain_slot?: number | null
          onchain_tx?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      insurance_claims: {
        Row: {
          amount: number
          claim_id: string
          description: string | null
          patient_did: string
          resolved_at: string | null
          status: string
          submitted_at: string
        }
        Insert: {
          amount: number
          claim_id: string
          description?: string | null
          patient_did: string
          resolved_at?: string | null
          status?: string
          submitted_at?: string
        }
        Update: {
          amount?: number
          claim_id?: string
          description?: string | null
          patient_did?: string
          resolved_at?: string | null
          status?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_claims_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "insurance_claims_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      insurance_policies: {
        Row: {
          copay: number | null
          coverage_percentage: number | null
          coverage_type: string | null
          deductible: number | null
          deductible_met: number | null
          group_number: string | null
          out_of_pocket_max: number | null
          out_of_pocket_met: number | null
          patient_did: string
          policy_number: string | null
          provider: string | null
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          copay?: number | null
          coverage_percentage?: number | null
          coverage_type?: string | null
          deductible?: number | null
          deductible_met?: number | null
          group_number?: string | null
          out_of_pocket_max?: number | null
          out_of_pocket_met?: number | null
          patient_did: string
          policy_number?: string | null
          provider?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          copay?: number | null
          coverage_percentage?: number | null
          coverage_type?: string | null
          deductible?: number | null
          deductible_met?: number | null
          group_number?: string | null
          out_of_pocket_max?: number | null
          out_of_pocket_met?: number | null
          patient_did?: string
          policy_number?: string | null
          provider?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insurance_policies_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: true
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "insurance_policies_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: true
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      inventory_alerts: {
        Row: {
          acknowledged: boolean
          alert_id: string
          alert_type: string
          created_at: string
          current_level: number | null
          hospital_id: string | null
          item_id: string
          message: string
          severity: string
          threshold: number | null
        }
        Insert: {
          acknowledged?: boolean
          alert_id?: string
          alert_type: string
          created_at?: string
          current_level?: number | null
          hospital_id?: string | null
          item_id: string
          message: string
          severity: string
          threshold?: number | null
        }
        Update: {
          acknowledged?: boolean
          alert_id?: string
          alert_type?: string
          created_at?: string
          current_level?: number | null
          hospital_id?: string | null
          item_id?: string
          message?: string
          severity?: string
          threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_alerts_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "inventory_alerts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["item_id"]
          },
        ]
      }
      inventory_batches: {
        Row: {
          batch_id: string
          batch_number: string
          created_at: string
          expiry_date: string | null
          hospital_id: string
          is_active: boolean
          item_id: string
          manufacturing_date: string | null
          quantity_available: number
          quantity_expired: number
          quantity_received: number
          quantity_wasted: number
          storage_building: string | null
          storage_floor: string | null
          storage_location: string | null
          storage_ward: string | null
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          batch_id?: string
          batch_number: string
          created_at?: string
          expiry_date?: string | null
          hospital_id: string
          is_active?: boolean
          item_id: string
          manufacturing_date?: string | null
          quantity_available: number
          quantity_expired?: number
          quantity_received: number
          quantity_wasted?: number
          storage_building?: string | null
          storage_floor?: string | null
          storage_location?: string | null
          storage_ward?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          batch_id?: string
          batch_number?: string
          created_at?: string
          expiry_date?: string | null
          hospital_id?: string
          is_active?: boolean
          item_id?: string
          manufacturing_date?: string | null
          quantity_available?: number
          quantity_expired?: number
          quantity_received?: number
          quantity_wasted?: number
          storage_building?: string | null
          storage_floor?: string | null
          storage_location?: string | null
          storage_ward?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batches_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "inventory_batches_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "inventory_batches_storage_building_fkey"
            columns: ["storage_building"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["building_id"]
          },
          {
            foreignKeyName: "inventory_batches_storage_building_fkey"
            columns: ["storage_building"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["building_id"]
          },
          {
            foreignKeyName: "inventory_batches_storage_floor_fkey"
            columns: ["storage_floor"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["floor_id"]
          },
          {
            foreignKeyName: "inventory_batches_storage_floor_fkey"
            columns: ["storage_floor"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["floor_id"]
          },
          {
            foreignKeyName: "inventory_batches_storage_ward_fkey"
            columns: ["storage_ward"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["ward_id"]
          },
          {
            foreignKeyName: "inventory_batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      inventory_categories: {
        Row: {
          category_id: string
          color_code: string
          created_at: string
          description: string | null
          name: string
        }
        Insert: {
          category_id: string
          color_code?: string
          created_at?: string
          description?: string | null
          name: string
        }
        Update: {
          category_id?: string
          color_code?: string
          created_at?: string
          description?: string | null
          name?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          category_id: string
          created_at: string
          current_stock: number
          expiry_date: string | null
          hospital_id: string | null
          item_id: string
          last_movement_at: string | null
          name: string
          reorder_level: number
          reorder_qty: number
          reserved_stock: number
          sku: string
          status: string
          storage_location: string | null
          supplier: string | null
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          current_stock?: number
          expiry_date?: string | null
          hospital_id?: string | null
          item_id: string
          last_movement_at?: string | null
          name: string
          reorder_level?: number
          reorder_qty?: number
          reserved_stock?: number
          sku: string
          status?: string
          storage_location?: string | null
          supplier?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          current_stock?: number
          expiry_date?: string | null
          hospital_id?: string | null
          item_id?: string
          last_movement_at?: string | null
          name?: string
          reorder_level?: number
          reorder_qty?: number
          reserved_stock?: number
          sku?: string
          status?: string
          storage_location?: string | null
          supplier?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inventory_categories"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "inventory_items_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      kitchen_stock: {
        Row: {
          category: string
          created_at: string
          expiry_date: string | null
          hospital_id: string | null
          item_name: string
          last_restocked_at: string | null
          quantity: number
          reorder_level: number
          status: string
          stock_id: string
          storage_location: string | null
          supplier: string | null
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          expiry_date?: string | null
          hospital_id?: string | null
          item_name: string
          last_restocked_at?: string | null
          quantity?: number
          reorder_level?: number
          status?: string
          stock_id?: string
          storage_location?: string | null
          supplier?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          expiry_date?: string | null
          hospital_id?: string | null
          item_name?: string
          last_restocked_at?: string | null
          quantity?: number
          reorder_level?: number
          status?: string
          stock_id?: string
          storage_location?: string | null
          supplier?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_stock_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      lab_orders: {
        Row: {
          clinical_notes: string | null
          completed_at: string | null
          created_at: string
          hospital_id: string | null
          lab_id: string | null
          order_id: string
          ordered_at: string
          ordered_by: string | null
          patient_did: string
          priority: string
          specimen_type: string | null
          status: string
          test_category: string
          test_name: string
        }
        Insert: {
          clinical_notes?: string | null
          completed_at?: string | null
          created_at?: string
          hospital_id?: string | null
          lab_id?: string | null
          order_id: string
          ordered_at?: string
          ordered_by?: string | null
          patient_did: string
          priority?: string
          specimen_type?: string | null
          status?: string
          test_category?: string
          test_name: string
        }
        Update: {
          clinical_notes?: string | null
          completed_at?: string | null
          created_at?: string
          hospital_id?: string | null
          lab_id?: string | null
          order_id?: string
          ordered_at?: string
          ordered_by?: string | null
          patient_did?: string
          priority?: string
          specimen_type?: string | null
          status?: string
          test_category?: string
          test_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_orders_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "lab_orders_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "lab_results"
            referencedColumns: ["lab_id"]
          },
          {
            foreignKeyName: "lab_orders_ordered_by_fkey"
            columns: ["ordered_by"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "lab_orders_ordered_by_fkey"
            columns: ["ordered_by"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
          {
            foreignKeyName: "lab_orders_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "lab_orders_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      lab_results: {
        Row: {
          category: string | null
          content_hash: string | null
          created_at: string
          critical_flag: string | null
          hospital_id: string | null
          is_critical: boolean | null
          lab_id: string
          order_id: string | null
          ordered_by: string | null
          patient_did: string
          reference_range: string | null
          result_value: string | null
          resulted_at: string | null
          status: string
          test_name: string
          unit: string | null
          verified_by: string | null
        }
        Insert: {
          category?: string | null
          content_hash?: string | null
          created_at?: string
          critical_flag?: string | null
          hospital_id?: string | null
          is_critical?: boolean | null
          lab_id: string
          order_id?: string | null
          ordered_by?: string | null
          patient_did: string
          reference_range?: string | null
          result_value?: string | null
          resulted_at?: string | null
          status?: string
          test_name: string
          unit?: string | null
          verified_by?: string | null
        }
        Update: {
          category?: string | null
          content_hash?: string | null
          created_at?: string
          critical_flag?: string | null
          hospital_id?: string | null
          is_critical?: boolean | null
          lab_id?: string
          order_id?: string | null
          ordered_by?: string | null
          patient_did?: string
          reference_range?: string | null
          result_value?: string | null
          resulted_at?: string | null
          status?: string
          test_name?: string
          unit?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_results_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "lab_results_ordered_by_fkey"
            columns: ["ordered_by"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "lab_results_ordered_by_fkey"
            columns: ["ordered_by"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
          {
            foreignKeyName: "lab_results_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "lab_results_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      lab_samples: {
        Row: {
          barcode: string | null
          collected_at: string
          collected_by: string | null
          collection_status: string
          container_type: string | null
          created_at: string
          hospital_id: string | null
          lab_id: string | null
          notes: string | null
          order_id: string | null
          patient_did: string
          processed_at: string | null
          received_at: string | null
          reported_at: string | null
          sample_id: string
          sample_type: string
          temperature_c: number | null
        }
        Insert: {
          barcode?: string | null
          collected_at?: string
          collected_by?: string | null
          collection_status?: string
          container_type?: string | null
          created_at?: string
          hospital_id?: string | null
          lab_id?: string | null
          notes?: string | null
          order_id?: string | null
          patient_did: string
          processed_at?: string | null
          received_at?: string | null
          reported_at?: string | null
          sample_id: string
          sample_type?: string
          temperature_c?: number | null
        }
        Update: {
          barcode?: string | null
          collected_at?: string
          collected_by?: string | null
          collection_status?: string
          container_type?: string | null
          created_at?: string
          hospital_id?: string | null
          lab_id?: string | null
          notes?: string | null
          order_id?: string | null
          patient_did?: string
          processed_at?: string | null
          received_at?: string | null
          reported_at?: string | null
          sample_id?: string
          sample_type?: string
          temperature_c?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_samples_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "lab_samples_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "lab_results"
            referencedColumns: ["lab_id"]
          },
          {
            foreignKeyName: "lab_samples_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "lab_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "lab_samples_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "lab_samples_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      low_stock_alerts: {
        Row: {
          alert_id: string
          alert_raised_at: string
          current_quantity: number
          hospital_id: string
          is_resolved: boolean
          item_id: string
          order_created_at: string | null
          order_id: string | null
          quantity_short: number
          reorder_level: number
        }
        Insert: {
          alert_id?: string
          alert_raised_at?: string
          current_quantity: number
          hospital_id: string
          is_resolved?: boolean
          item_id: string
          order_created_at?: string | null
          order_id?: string | null
          quantity_short: number
          reorder_level: number
        }
        Update: {
          alert_id?: string
          alert_raised_at?: string
          current_quantity?: number
          hospital_id?: string
          is_resolved?: boolean
          item_id?: string
          order_created_at?: string | null
          order_id?: string | null
          quantity_short?: number
          reorder_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "low_stock_alerts_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "low_stock_alerts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_items"
            referencedColumns: ["item_id"]
          },
        ]
      }
      meal_deliveries: {
        Row: {
          assigned_runner: string | null
          created_at: string
          delivered_at: string | null
          delivery_id: string
          delivery_status: string
          dietary_notes: string | null
          hospital_id: string | null
          meal_type: string
          menu_item_name: string
          patient_did: string
          patient_name: string
          room_number: string
          scheduled_at: string
          updated_at: string
        }
        Insert: {
          assigned_runner?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_id?: string
          delivery_status?: string
          dietary_notes?: string | null
          hospital_id?: string | null
          meal_type: string
          menu_item_name: string
          patient_did: string
          patient_name?: string
          room_number: string
          scheduled_at?: string
          updated_at?: string
        }
        Update: {
          assigned_runner?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_id?: string
          delivery_status?: string
          dietary_notes?: string | null
          hospital_id?: string | null
          meal_type?: string
          menu_item_name?: string
          patient_did?: string
          patient_name?: string
          room_number?: string
          scheduled_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_deliveries_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      medical_records: {
        Row: {
          author_did: string | null
          author_name: string | null
          content: string | null
          content_hash: string | null
          created_at: string
          hospital_id: string | null
          patient_did: string
          record_id: string
          record_type: string
          title: string
          updated_at: string
        }
        Insert: {
          author_did?: string | null
          author_name?: string | null
          content?: string | null
          content_hash?: string | null
          created_at?: string
          hospital_id?: string | null
          patient_did: string
          record_id: string
          record_type: string
          title: string
          updated_at?: string
        }
        Update: {
          author_did?: string | null
          author_name?: string | null
          content?: string | null
          content_hash?: string | null
          created_at?: string
          hospital_id?: string | null
          patient_did?: string
          record_id?: string
          record_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_records_author_did_fkey"
            columns: ["author_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "medical_records_author_did_fkey"
            columns: ["author_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
          {
            foreignKeyName: "medical_records_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "medical_records_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "medical_records_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      medical_reports: {
        Row: {
          appointment_id: string | null
          content_hash: string | null
          created_at: string
          doctor_did: string
          file_path: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          findings: string | null
          patient_did: string
          recommendations: string | null
          report_id: string
          report_type: string
          signed: boolean
          signed_at: string | null
          signed_by: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          content_hash?: string | null
          created_at?: string
          doctor_did: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          findings?: string | null
          patient_did: string
          recommendations?: string | null
          report_id?: string
          report_type?: string
          signed?: boolean
          signed_at?: string | null
          signed_by?: string | null
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          content_hash?: string | null
          created_at?: string
          doctor_did?: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          findings?: string | null
          patient_did?: string
          recommendations?: string | null
          report_id?: string
          report_type?: string
          signed?: boolean
          signed_at?: string | null
          signed_by?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_reports_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["appt_id"]
          },
          {
            foreignKeyName: "medical_reports_doctor_did_fkey"
            columns: ["doctor_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "medical_reports_doctor_did_fkey"
            columns: ["doctor_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
          {
            foreignKeyName: "medical_reports_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "medical_reports_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      medications: {
        Row: {
          dosage: string | null
          frequency: string | null
          hospital_id: string | null
          medication_id: string
          name: string
          next_dose_at: string | null
          patient_did: string
          prescribed_by: string | null
          route: string | null
          started_on: string | null
          status: Database["public"]["Enums"]["med_status"]
        }
        Insert: {
          dosage?: string | null
          frequency?: string | null
          hospital_id?: string | null
          medication_id: string
          name: string
          next_dose_at?: string | null
          patient_did: string
          prescribed_by?: string | null
          route?: string | null
          started_on?: string | null
          status?: Database["public"]["Enums"]["med_status"]
        }
        Update: {
          dosage?: string | null
          frequency?: string | null
          hospital_id?: string | null
          medication_id?: string
          name?: string
          next_dose_at?: string | null
          patient_did?: string
          prescribed_by?: string | null
          route?: string | null
          started_on?: string | null
          status?: Database["public"]["Enums"]["med_status"]
        }
        Relationships: [
          {
            foreignKeyName: "medications_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "medications_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "medications_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      merkle_roots: {
        Row: {
          anchor_id: string | null
          event_count: number
          event_ids: Json
          period_date: string
          publish_id: string
          published_at: string
          root_hash: string
          subject_did: string
        }
        Insert: {
          anchor_id?: string | null
          event_count: number
          event_ids?: Json
          period_date: string
          publish_id: string
          published_at?: string
          root_hash: string
          subject_did: string
        }
        Update: {
          anchor_id?: string | null
          event_count?: number
          event_ids?: Json
          period_date?: string
          publish_id?: string
          published_at?: string
          root_hash?: string
          subject_did?: string
        }
        Relationships: [
          {
            foreignKeyName: "merkle_roots_anchor_id_fkey"
            columns: ["anchor_id"]
            isOneToOne: false
            referencedRelation: "solana_anchors"
            referencedColumns: ["anchor_id"]
          },
        ]
      }
      nfc_cards: {
        Row: {
          card_id: string
          card_type: string
          hospital_id: string | null
          issued_at: string
          issued_by: string | null
          patient_did: string
          revoked_at: string | null
          status: Database["public"]["Enums"]["card_status"]
        }
        Insert: {
          card_id: string
          card_type?: string
          hospital_id?: string | null
          issued_at?: string
          issued_by?: string | null
          patient_did: string
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["card_status"]
        }
        Update: {
          card_id?: string
          card_type?: string
          hospital_id?: string | null
          issued_at?: string
          issued_by?: string | null
          patient_did?: string
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["card_status"]
        }
        Relationships: [
          {
            foreignKeyName: "nfc_cards_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "nfc_cards_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfc_cards_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "nfc_cards_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      nursing_notes: {
        Row: {
          category: string | null
          hospital_id: string | null
          note: string
          note_id: string
          nurse_name: string | null
          patient_did: string
          priority: string
          recorded_at: string
        }
        Insert: {
          category?: string | null
          hospital_id?: string | null
          note: string
          note_id: string
          nurse_name?: string | null
          patient_did: string
          priority?: string
          recorded_at?: string
        }
        Update: {
          category?: string | null
          hospital_id?: string | null
          note?: string
          note_id?: string
          nurse_name?: string | null
          patient_did?: string
          priority?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nursing_notes_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "nursing_notes_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "nursing_notes_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      patient_preferences: {
        Row: {
          cross_hospital: boolean
          emergency_access: boolean
          insurance_verification: boolean
          patient_did: string
          reminder_email: boolean
          reminder_sms: boolean
          reminder_whatsapp: boolean
          research_sharing: boolean
          updated_at: string
        }
        Insert: {
          cross_hospital?: boolean
          emergency_access?: boolean
          insurance_verification?: boolean
          patient_did: string
          reminder_email?: boolean
          reminder_sms?: boolean
          reminder_whatsapp?: boolean
          research_sharing?: boolean
          updated_at?: string
        }
        Update: {
          cross_hospital?: boolean
          emergency_access?: boolean
          insurance_verification?: boolean
          patient_did?: string
          reminder_email?: boolean
          reminder_sms?: boolean
          reminder_whatsapp?: boolean
          research_sharing?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_preferences_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: true
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "patient_preferences_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: true
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          method: string | null
          paid_at: string | null
          patient_did: string
          payment_id: string
          reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          method?: string | null
          paid_at?: string | null
          patient_did: string
          payment_id: string
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          method?: string | null
          paid_at?: string | null
          patient_did?: string
          payment_id?: string
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "payments_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      pharmacy_items: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          hospital_id: string
          item_code: string
          item_id: string
          item_name: string
          item_type: Database["public"]["Enums"]["inventory_item_type"]
          maximum_stock: number | null
          reorder_level: number
          reorder_quantity: number
          status: Database["public"]["Enums"]["inventory_item_status"]
          unit_cost: number | null
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          hospital_id: string
          item_code: string
          item_id?: string
          item_name: string
          item_type?: Database["public"]["Enums"]["inventory_item_type"]
          maximum_stock?: number | null
          reorder_level?: number
          reorder_quantity?: number
          status?: Database["public"]["Enums"]["inventory_item_status"]
          unit_cost?: number | null
          unit_of_measure: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          hospital_id?: string
          item_code?: string
          item_id?: string
          item_name?: string
          item_type?: Database["public"]["Enums"]["inventory_item_type"]
          maximum_stock?: number | null
          reorder_level?: number
          reorder_quantity?: number
          status?: Database["public"]["Enums"]["inventory_item_status"]
          unit_cost?: number | null
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_items_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      pharmacy_orders: {
        Row: {
          dispensed_at: string | null
          hospital_id: string | null
          medicines: Json
          order_id: string
          ordered_on: string
          patient_did: string
          status: Database["public"]["Enums"]["dispense_status"]
        }
        Insert: {
          dispensed_at?: string | null
          hospital_id?: string | null
          medicines?: Json
          order_id: string
          ordered_on?: string
          patient_did: string
          status?: Database["public"]["Enums"]["dispense_status"]
        }
        Update: {
          dispensed_at?: string | null
          hospital_id?: string | null
          medicines?: Json
          order_id?: string
          ordered_on?: string
          patient_did?: string
          status?: Database["public"]["Enums"]["dispense_status"]
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_orders_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "pharmacy_orders_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "pharmacy_orders_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      pharmacy_stock_movements: {
        Row: {
          batch_id: string | null
          content_hash: string | null
          destination_building: string | null
          destination_location: string | null
          destination_ward: string | null
          hospital_id: string
          item_id: string
          movement_id: string
          movement_timestamp: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          patient_did: string | null
          performed_by_id: string | null
          performed_by_name: string | null
          performed_by_role: string | null
          prescription_id: string | null
          quantity_after: number
          quantity_before: number
          quantity_moved: number
          reason: string | null
          recorded_at: string
          source_building: string | null
          source_location: string | null
          source_ward: string | null
        }
        Insert: {
          batch_id?: string | null
          content_hash?: string | null
          destination_building?: string | null
          destination_location?: string | null
          destination_ward?: string | null
          hospital_id: string
          item_id: string
          movement_id: string
          movement_timestamp?: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          patient_did?: string | null
          performed_by_id?: string | null
          performed_by_name?: string | null
          performed_by_role?: string | null
          prescription_id?: string | null
          quantity_after: number
          quantity_before: number
          quantity_moved: number
          reason?: string | null
          recorded_at?: string
          source_building?: string | null
          source_location?: string | null
          source_ward?: string | null
        }
        Update: {
          batch_id?: string | null
          content_hash?: string | null
          destination_building?: string | null
          destination_location?: string | null
          destination_ward?: string | null
          hospital_id?: string
          item_id?: string
          movement_id?: string
          movement_timestamp?: string
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          patient_did?: string | null
          performed_by_id?: string | null
          performed_by_name?: string | null
          performed_by_role?: string | null
          prescription_id?: string | null
          quantity_after?: number
          quantity_before?: number
          quantity_moved?: number
          reason?: string | null
          recorded_at?: string
          source_building?: string | null
          source_location?: string | null
          source_ward?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "pharmacy_stock_movements_destination_building_fkey"
            columns: ["destination_building"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["building_id"]
          },
          {
            foreignKeyName: "pharmacy_stock_movements_destination_building_fkey"
            columns: ["destination_building"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["building_id"]
          },
          {
            foreignKeyName: "pharmacy_stock_movements_destination_ward_fkey"
            columns: ["destination_ward"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["ward_id"]
          },
          {
            foreignKeyName: "pharmacy_stock_movements_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "pharmacy_stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "pharmacy_stock_movements_source_building_fkey"
            columns: ["source_building"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["building_id"]
          },
          {
            foreignKeyName: "pharmacy_stock_movements_source_building_fkey"
            columns: ["source_building"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["building_id"]
          },
          {
            foreignKeyName: "pharmacy_stock_movements_source_ward_fkey"
            columns: ["source_ward"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["ward_id"]
          },
        ]
      }
      prescription_items: {
        Row: {
          created_at: string
          dosage: string
          duration: string
          frequency: string
          instructions: string | null
          item_id: string
          medicine_name: string
          prescription_id: string
        }
        Insert: {
          created_at?: string
          dosage: string
          duration: string
          frequency: string
          instructions?: string | null
          item_id?: string
          medicine_name: string
          prescription_id: string
        }
        Update: {
          created_at?: string
          dosage?: string
          duration?: string
          frequency?: string
          instructions?: string | null
          item_id?: string
          medicine_name?: string
          prescription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_items_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["rx_id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          appointment_id: string | null
          content_hash: string | null
          created_at: string
          diagnosis: string | null
          doctor_did: string
          drugs: Json
          hospital_id: string | null
          notes: string | null
          patient_did: string
          rx_id: string
          signed: boolean
          signed_at: string | null
          signed_by: string | null
          status: Database["public"]["Enums"]["rx_status"]
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          content_hash?: string | null
          created_at?: string
          diagnosis?: string | null
          doctor_did: string
          drugs?: Json
          hospital_id?: string | null
          notes?: string | null
          patient_did: string
          rx_id: string
          signed?: boolean
          signed_at?: string | null
          signed_by?: string | null
          status?: Database["public"]["Enums"]["rx_status"]
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          content_hash?: string | null
          created_at?: string
          diagnosis?: string | null
          doctor_did?: string
          drugs?: Json
          hospital_id?: string | null
          notes?: string | null
          patient_did?: string
          rx_id?: string
          signed?: boolean
          signed_at?: string | null
          signed_by?: string | null
          status?: Database["public"]["Enums"]["rx_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["appt_id"]
          },
          {
            foreignKeyName: "prescriptions_doctor_did_fkey"
            columns: ["doctor_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "prescriptions_doctor_did_fkey"
            columns: ["doctor_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
          {
            foreignKeyName: "prescriptions_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "prescriptions_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "prescriptions_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      procedures: {
        Row: {
          completed_at: string | null
          created_at: string
          hospital_id: string | null
          location: string | null
          name: string
          notes: string | null
          patient_did: string
          performed_by: string | null
          procedure_id: string
          scheduled_for: string | null
          status: Database["public"]["Enums"]["schedule_status"]
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          hospital_id?: string | null
          location?: string | null
          name: string
          notes?: string | null
          patient_did: string
          performed_by?: string | null
          procedure_id: string
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["schedule_status"]
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          hospital_id?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          patient_did?: string
          performed_by?: string | null
          procedure_id?: string
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["schedule_status"]
        }
        Relationships: [
          {
            foreignKeyName: "procedures_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "procedures_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "procedures_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      profiles: {
        Row: {
          age: number | null
          allergies: string[] | null
          blood_group: string | null
          conditions: string[]
          created_at: string
          department: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          employee_id: string | null
          full_name: string
          gender: string | null
          hospital_id: string | null
          id: string
          join_date: string | null
          organ_donor: boolean | null
          phone: string | null
          primary_did: string | null
          role: Database["public"]["Enums"]["user_role"]
          specializations: string[]
          title: string | null
          updated_at: string
          wallet_address: string | null
        }
        Insert: {
          age?: number | null
          allergies?: string[] | null
          blood_group?: string | null
          conditions?: string[]
          created_at?: string
          department?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          employee_id?: string | null
          full_name: string
          gender?: string | null
          hospital_id?: string | null
          id: string
          join_date?: string | null
          organ_donor?: boolean | null
          phone?: string | null
          primary_did?: string | null
          role: Database["public"]["Enums"]["user_role"]
          specializations?: string[]
          title?: string | null
          updated_at?: string
          wallet_address?: string | null
        }
        Update: {
          age?: number | null
          allergies?: string[] | null
          blood_group?: string | null
          conditions?: string[]
          created_at?: string
          department?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          employee_id?: string | null
          full_name?: string
          gender?: string | null
          hospital_id?: string | null
          id?: string
          join_date?: string | null
          organ_donor?: boolean | null
          phone?: string | null
          primary_did?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          specializations?: string[]
          title?: string | null
          updated_at?: string
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "profiles_primary_did_fkey"
            columns: ["primary_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "profiles_primary_did_fkey"
            columns: ["primary_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          expected_delivery_date: string | null
          hospital_id: string
          items: Json
          order_date: string
          order_id: string
          ordered_by: string | null
          ordered_by_name: string | null
          received_by: string | null
          received_by_name: string | null
          received_date: string | null
          status: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id: string
          total_cost: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          expected_delivery_date?: string | null
          hospital_id: string
          items?: Json
          order_date?: string
          order_id: string
          ordered_by?: string | null
          ordered_by_name?: string | null
          received_by?: string | null
          received_by_name?: string | null
          received_date?: string | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id: string
          total_cost?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          expected_delivery_date?: string | null
          hospital_id?: string
          items?: Json
          order_date?: string
          order_id?: string
          ordered_by?: string | null
          ordered_by_name?: string | null
          received_by?: string | null
          received_by_name?: string | null
          received_date?: string | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id?: string
          total_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      radiology_orders: {
        Row: {
          body_part: string
          clinical_indication: string
          completed_at: string | null
          created_at: string
          equipment_id: string | null
          hospital_id: string | null
          modality: string
          order_id: string
          ordered_by: string | null
          pacs_image_url: string | null
          patient_did: string
          priority: string
          report_text: string | null
          reported_at: string | null
          reported_by: string | null
          scheduled_at: string
          status: string
        }
        Insert: {
          body_part: string
          clinical_indication: string
          completed_at?: string | null
          created_at?: string
          equipment_id?: string | null
          hospital_id?: string | null
          modality?: string
          order_id: string
          ordered_by?: string | null
          pacs_image_url?: string | null
          patient_did: string
          priority?: string
          report_text?: string | null
          reported_at?: string | null
          reported_by?: string | null
          scheduled_at?: string
          status?: string
        }
        Update: {
          body_part?: string
          clinical_indication?: string
          completed_at?: string | null
          created_at?: string
          equipment_id?: string | null
          hospital_id?: string | null
          modality?: string
          order_id?: string
          ordered_by?: string | null
          pacs_image_url?: string | null
          patient_did?: string
          priority?: string
          report_text?: string | null
          reported_at?: string | null
          reported_by?: string | null
          scheduled_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "radiology_orders_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "radiology_orders_ordered_by_fkey"
            columns: ["ordered_by"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "radiology_orders_ordered_by_fkey"
            columns: ["ordered_by"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
          {
            foreignKeyName: "radiology_orders_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "radiology_orders_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      rehab_sessions: {
        Row: {
          hospital_id: string | null
          notes: string | null
          patient_did: string
          session_date: string | null
          session_id: string
          session_type: string
          status: Database["public"]["Enums"]["schedule_status"]
          therapist: string | null
        }
        Insert: {
          hospital_id?: string | null
          notes?: string | null
          patient_did: string
          session_date?: string | null
          session_id: string
          session_type: string
          status?: Database["public"]["Enums"]["schedule_status"]
          therapist?: string | null
        }
        Update: {
          hospital_id?: string | null
          notes?: string | null
          patient_did?: string
          session_date?: string | null
          session_id?: string
          session_type?: string
          status?: Database["public"]["Enums"]["schedule_status"]
          therapist?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rehab_sessions_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "rehab_sessions_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "rehab_sessions_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      room_checkin_events: {
        Row: {
          action: string
          doctor_did: string
          event_id: string
          hospital_id: string | null
          occurred_at: string
          room_id: string | null
          room_name: string | null
        }
        Insert: {
          action: string
          doctor_did: string
          event_id: string
          hospital_id?: string | null
          occurred_at?: string
          room_id?: string | null
          room_name?: string | null
        }
        Update: {
          action?: string
          doctor_did?: string
          event_id?: string
          hospital_id?: string | null
          occurred_at?: string
          room_id?: string | null
          room_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_checkin_events_doctor_did_fkey"
            columns: ["doctor_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "room_checkin_events_doctor_did_fkey"
            columns: ["doctor_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
          {
            foreignKeyName: "room_checkin_events_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      room_checkins: {
        Row: {
          checked_in_at: string | null
          checked_out_at: string | null
          current_room: string | null
          doctor_did: string
          doctor_name: string | null
          hospital_id: string | null
          last_action: string | null
          room_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          checked_in_at?: string | null
          checked_out_at?: string | null
          current_room?: string | null
          doctor_did: string
          doctor_name?: string | null
          hospital_id?: string | null
          last_action?: string | null
          room_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          checked_in_at?: string | null
          checked_out_at?: string | null
          current_room?: string | null
          doctor_did?: string
          doctor_name?: string | null
          hospital_id?: string | null
          last_action?: string | null
          room_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_checkins_doctor_did_fkey"
            columns: ["doctor_did"]
            isOneToOne: true
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "room_checkins_doctor_did_fkey"
            columns: ["doctor_did"]
            isOneToOne: true
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
          {
            foreignKeyName: "room_checkins_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "room_checkins_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["room_id"]
          },
        ]
      }
      rooms: {
        Row: {
          building_id: string | null
          capacity: number
          created_at: string
          floor: string | null
          hospital_id: string | null
          occupied_count: number
          room_id: string
          room_name: string
          room_number: string | null
          room_type: string | null
          room_type_old: string | null
          status: Database["public"]["Enums"]["room_status"]
          updated_at: string
          ward_id: string | null
        }
        Insert: {
          building_id?: string | null
          capacity?: number
          created_at?: string
          floor?: string | null
          hospital_id?: string | null
          occupied_count?: number
          room_id: string
          room_name: string
          room_number?: string | null
          room_type?: string | null
          room_type_old?: string | null
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
          ward_id?: string | null
        }
        Update: {
          building_id?: string | null
          capacity?: number
          created_at?: string
          floor?: string | null
          hospital_id?: string | null
          occupied_count?: number
          room_id?: string
          room_name?: string
          room_number?: string | null
          room_type?: string | null
          room_type_old?: string | null
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
          ward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["building_id"]
          },
          {
            foreignKeyName: "rooms_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["building_id"]
          },
          {
            foreignKeyName: "rooms_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "rooms_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["ward_id"]
          },
        ]
      }
      signing_events: {
        Row: {
          confirmation_count: number | null
          confirmation_slot: number | null
          confirmed: boolean
          confirmed_at: string | null
          created_at: string
          error_message: string | null
          event_id: string
          hospital_id: string
          metadata: Json | null
          record_hash: string | null
          record_type: string | null
          signer_type: string
          signer_wallet: string | null
          status: string
          transaction_id: string
          user_id: string | null
          user_wallet: string | null
        }
        Insert: {
          confirmation_count?: number | null
          confirmation_slot?: number | null
          confirmed?: boolean
          confirmed_at?: string | null
          created_at?: string
          error_message?: string | null
          event_id?: string
          hospital_id: string
          metadata?: Json | null
          record_hash?: string | null
          record_type?: string | null
          signer_type: string
          signer_wallet?: string | null
          status?: string
          transaction_id: string
          user_id?: string | null
          user_wallet?: string | null
        }
        Update: {
          confirmation_count?: number | null
          confirmation_slot?: number | null
          confirmed?: boolean
          confirmed_at?: string | null
          created_at?: string
          error_message?: string | null
          event_id?: string
          hospital_id?: string
          metadata?: Json | null
          record_hash?: string | null
          record_type?: string | null
          signer_type?: string
          signer_wallet?: string | null
          status?: string
          transaction_id?: string
          user_id?: string | null
          user_wallet?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signing_events_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      solana_anchors: {
        Row: {
          actor_did: string | null
          anchor_id: string
          anchored_at: string
          confirmed_at: string | null
          error: string | null
          network: string
          record_hash: string
          record_id: string | null
          record_type: string
          signature: string | null
          slot: number | null
          status: Database["public"]["Enums"]["anchor_status"]
        }
        Insert: {
          actor_did?: string | null
          anchor_id: string
          anchored_at?: string
          confirmed_at?: string | null
          error?: string | null
          network: string
          record_hash: string
          record_id?: string | null
          record_type: string
          signature?: string | null
          slot?: number | null
          status?: Database["public"]["Enums"]["anchor_status"]
        }
        Update: {
          actor_did?: string | null
          anchor_id?: string
          anchored_at?: string
          confirmed_at?: string | null
          error?: string | null
          network?: string
          record_hash?: string
          record_id?: string | null
          record_type?: string
          signature?: string | null
          slot?: number | null
          status?: Database["public"]["Enums"]["anchor_status"]
        }
        Relationships: []
      }
      staff_certifications: {
        Row: {
          audit_metadata: Json
          cert_id: string
          cert_name: string
          cert_number: string | null
          cert_type: string | null
          created_at: string
          created_by: string | null
          document_url: string | null
          expiry_date: string | null
          hospital_id: string
          issue_date: string | null
          issuing_body: string
          notes: string | null
          staff_did: string
          status: Database["public"]["Enums"]["certification_status"]
          updated_at: string
          updated_by: string | null
          verification_url: string | null
          verified_by_admin: boolean
        }
        Insert: {
          audit_metadata?: Json
          cert_id?: string
          cert_name: string
          cert_number?: string | null
          cert_type?: string | null
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          expiry_date?: string | null
          hospital_id: string
          issue_date?: string | null
          issuing_body: string
          notes?: string | null
          staff_did: string
          status?: Database["public"]["Enums"]["certification_status"]
          updated_at?: string
          updated_by?: string | null
          verification_url?: string | null
          verified_by_admin?: boolean
        }
        Update: {
          audit_metadata?: Json
          cert_id?: string
          cert_name?: string
          cert_number?: string | null
          cert_type?: string | null
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          expiry_date?: string | null
          hospital_id?: string
          issue_date?: string | null
          issuing_body?: string
          notes?: string | null
          staff_did?: string
          status?: Database["public"]["Enums"]["certification_status"]
          updated_at?: string
          updated_by?: string | null
          verification_url?: string | null
          verified_by_admin?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "staff_certifications_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "staff_certifications_staff_did_fkey"
            columns: ["staff_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "staff_certifications_staff_did_fkey"
            columns: ["staff_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      staff_requests: {
        Row: {
          created_at: string
          details: string | null
          hospital_id: string | null
          request_id: string
          request_type: string
          resolved_at: string | null
          resolved_by: string | null
          staff_id: string
          status: Database["public"]["Enums"]["staff_request_status"]
          subject: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          hospital_id?: string | null
          request_id: string
          request_type: string
          resolved_at?: string | null
          resolved_by?: string | null
          staff_id: string
          status?: Database["public"]["Enums"]["staff_request_status"]
          subject: string
        }
        Update: {
          created_at?: string
          details?: string | null
          hospital_id?: string | null
          request_id?: string
          request_type?: string
          resolved_at?: string | null
          resolved_by?: string | null
          staff_id?: string
          status?: Database["public"]["Enums"]["staff_request_status"]
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_requests_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "staff_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_schedule: {
        Row: {
          confirmed: boolean
          created_at: string
          ends_at: string | null
          hospital_id: string | null
          notes: string | null
          patient_count: number
          role: string | null
          shift_date: string
          shift_id: string
          staff_id: string
          starts_at: string | null
          unit: string | null
        }
        Insert: {
          confirmed?: boolean
          created_at?: string
          ends_at?: string | null
          hospital_id?: string | null
          notes?: string | null
          patient_count?: number
          role?: string | null
          shift_date: string
          shift_id: string
          staff_id: string
          starts_at?: string | null
          unit?: string | null
        }
        Update: {
          confirmed?: boolean
          created_at?: string
          ends_at?: string | null
          hospital_id?: string | null
          notes?: string | null
          patient_count?: number
          role?: string | null
          shift_date?: string
          shift_id?: string
          staff_id?: string
          starts_at?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_schedule_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "staff_schedule_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_levels: {
        Row: {
          building_id: string | null
          floor_id: string | null
          hospital_id: string
          item_id: string
          last_movement_at: string | null
          quantity_batches: number
          quantity_total: number
          quantity_usable: number
          room_id: string | null
          stock_id: string
          storage_location: string | null
          updated_at: string
          ward_id: string | null
        }
        Insert: {
          building_id?: string | null
          floor_id?: string | null
          hospital_id: string
          item_id: string
          last_movement_at?: string | null
          quantity_batches?: number
          quantity_total?: number
          quantity_usable?: number
          room_id?: string | null
          stock_id?: string
          storage_location?: string | null
          updated_at?: string
          ward_id?: string | null
        }
        Update: {
          building_id?: string | null
          floor_id?: string | null
          hospital_id?: string
          item_id?: string
          last_movement_at?: string | null
          quantity_batches?: number
          quantity_total?: number
          quantity_usable?: number
          room_id?: string | null
          stock_id?: string
          storage_location?: string | null
          updated_at?: string
          ward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_levels_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["building_id"]
          },
          {
            foreignKeyName: "stock_levels_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["building_id"]
          },
          {
            foreignKeyName: "stock_levels_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["floor_id"]
          },
          {
            foreignKeyName: "stock_levels_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["floor_id"]
          },
          {
            foreignKeyName: "stock_levels_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "stock_levels_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "stock_levels_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "stock_levels_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["ward_id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          hospital_id: string | null
          item_id: string
          movement_id: string
          movement_type: string
          new_stock: number
          performed_by: string | null
          performed_by_name: string | null
          previous_stock: number
          quantity: number
          reason: string | null
          recorded_at: string
        }
        Insert: {
          hospital_id?: string | null
          item_id: string
          movement_id?: string
          movement_type: string
          new_stock: number
          performed_by?: string | null
          performed_by_name?: string | null
          previous_stock: number
          quantity: number
          reason?: string | null
          recorded_at?: string
        }
        Update: {
          hospital_id?: string | null
          item_id?: string
          movement_id?: string
          movement_type?: string
          new_stock?: number
          performed_by?: string | null
          performed_by_name?: string | null
          previous_stock?: number
          quantity?: number
          reason?: string | null
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["item_id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          contact_person: string | null
          country: string | null
          created_at: string
          email: string | null
          hospital_id: string
          is_active: boolean
          phone: string | null
          supplier_id: string
          supplier_name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          hospital_id: string
          is_active?: boolean
          phone?: string | null
          supplier_id?: string
          supplier_name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          hospital_id?: string
          is_active?: boolean
          phone?: string | null
          supplier_id?: string
          supplier_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      surgeries: {
        Row: {
          anesthesiologist: string | null
          created_at: string
          est_duration_min: number | null
          hospital_id: string | null
          operating_room: string | null
          patient_did: string | null
          procedure_name: string
          scheduled_for: string | null
          status: Database["public"]["Enums"]["schedule_status"]
          surgeon: string | null
          surgery_id: string
        }
        Insert: {
          anesthesiologist?: string | null
          created_at?: string
          est_duration_min?: number | null
          hospital_id?: string | null
          operating_room?: string | null
          patient_did?: string | null
          procedure_name: string
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["schedule_status"]
          surgeon?: string | null
          surgery_id: string
        }
        Update: {
          anesthesiologist?: string | null
          created_at?: string
          est_duration_min?: number | null
          hospital_id?: string | null
          operating_room?: string | null
          patient_did?: string | null
          procedure_name?: string
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["schedule_status"]
          surgeon?: string | null
          surgery_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "surgeries_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "surgeries_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "surgeries_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      user_wallet_preferences: {
        Row: {
          created_at: string
          hospital_id: string
          phantom_connected_at: string | null
          phantom_disconnected_at: string | null
          phantom_public_key: string | null
          prefer_user_signing: boolean
          preference_id: string
          require_confirmation: boolean
          updated_at: string
          user_id: string
          wallet_mode: string
        }
        Insert: {
          created_at?: string
          hospital_id: string
          phantom_connected_at?: string | null
          phantom_disconnected_at?: string | null
          phantom_public_key?: string | null
          prefer_user_signing?: boolean
          preference_id?: string
          require_confirmation?: boolean
          updated_at?: string
          user_id: string
          wallet_mode?: string
        }
        Update: {
          created_at?: string
          hospital_id?: string
          phantom_connected_at?: string | null
          phantom_disconnected_at?: string | null
          phantom_public_key?: string | null
          prefer_user_signing?: boolean
          preference_id?: string
          require_confirmation?: boolean
          updated_at?: string
          user_id?: string
          wallet_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_wallet_preferences_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      vaccines: {
        Row: {
          administered_by: string | null
          administered_on: string | null
          batch_number: string | null
          dose_number: number | null
          hospital_id: string | null
          next_due_on: string | null
          patient_did: string
          vaccine_id: string
          vaccine_name: string
        }
        Insert: {
          administered_by?: string | null
          administered_on?: string | null
          batch_number?: string | null
          dose_number?: number | null
          hospital_id?: string | null
          next_due_on?: string | null
          patient_did: string
          vaccine_id: string
          vaccine_name: string
        }
        Update: {
          administered_by?: string | null
          administered_on?: string | null
          batch_number?: string | null
          dose_number?: number | null
          hospital_id?: string | null
          next_due_on?: string | null
          patient_did?: string
          vaccine_id?: string
          vaccine_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vaccines_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "vaccines_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "vaccines_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      visitors: {
        Row: {
          hospital_id: string | null
          patient_did: string
          purpose: string | null
          relation: string | null
          requested_at: string
          requested_by: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["visitor_status"]
          visit_date: string | null
          visitor_id: string
          visitor_name: string
        }
        Insert: {
          hospital_id?: string | null
          patient_did: string
          purpose?: string | null
          relation?: string | null
          requested_at?: string
          requested_by?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["visitor_status"]
          visit_date?: string | null
          visitor_id: string
          visitor_name: string
        }
        Update: {
          hospital_id?: string | null
          patient_did?: string
          purpose?: string | null
          relation?: string | null
          requested_at?: string
          requested_by?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["visitor_status"]
          visit_date?: string | null
          visitor_id?: string
          visitor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitors_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "visitors_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "visitors_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
          {
            foreignKeyName: "visitors_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vitals: {
        Row: {
          bp_diastolic: number | null
          bp_systolic: number | null
          heart_rate: number | null
          hospital_id: string | null
          patient_did: string
          recorded_at: string
          resp_rate: number | null
          spo2: number | null
          temperature: number | null
          vitals_id: number
        }
        Insert: {
          bp_diastolic?: number | null
          bp_systolic?: number | null
          heart_rate?: number | null
          hospital_id?: string | null
          patient_did: string
          recorded_at?: string
          resp_rate?: number | null
          spo2?: number | null
          temperature?: number | null
          vitals_id?: number
        }
        Update: {
          bp_diastolic?: number | null
          bp_systolic?: number | null
          heart_rate?: number | null
          hospital_id?: string | null
          patient_did?: string
          recorded_at?: string
          resp_rate?: number | null
          spo2?: number | null
          temperature?: number | null
          vitals_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "vitals_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
          {
            foreignKeyName: "vitals_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "vitals_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      wards: {
        Row: {
          building_id: string
          capacity: number
          created_at: string
          description: string | null
          floor_id: string
          hospital_id: string
          total_rooms: number
          updated_at: string
          ward_code: string | null
          ward_id: string
          ward_name: string
          ward_type: string | null
        }
        Insert: {
          building_id: string
          capacity?: number
          created_at?: string
          description?: string | null
          floor_id: string
          hospital_id: string
          total_rooms?: number
          updated_at?: string
          ward_code?: string | null
          ward_id?: string
          ward_name: string
          ward_type?: string | null
        }
        Update: {
          building_id?: string
          capacity?: number
          created_at?: string
          description?: string | null
          floor_id?: string
          hospital_id?: string
          total_rooms?: number
          updated_at?: string
          ward_code?: string | null
          ward_id?: string
          ward_name?: string
          ward_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wards_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["building_id"]
          },
          {
            foreignKeyName: "wards_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["building_id"]
          },
          {
            foreignKeyName: "wards_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["floor_id"]
          },
          {
            foreignKeyName: "wards_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["floor_id"]
          },
          {
            foreignKeyName: "wards_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
    }
    Views: {
      patient_admission_history: {
        Row: {
          admission_bill: number | null
          admission_id: string | null
          admitted_at: string | null
          admitting_doctor: string | null
          bed: string | null
          diagnosis: string | null
          discharged_at: string | null
          length_of_stay_days: number | null
          patient_did: string | null
          room: string | null
          status: Database["public"]["Enums"]["admission_status"] | null
          total_transfers: number | null
          unpaid_balance: number | null
          ward: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admissions_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "admissions_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      patient_current_location: {
        Row: {
          admission_id: string | null
          admitted_at: string | null
          bed: string | null
          bed_number: string | null
          bed_type: string | null
          building_name: string | null
          expected_discharge: string | null
          floor_number: number | null
          hospital_name: string | null
          patient_did: string | null
          room_id: string | null
          room_number: string | null
          room_type: string | null
          status: Database["public"]["Enums"]["admission_status"] | null
          ward_id: string | null
          ward_name: string | null
          ward_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admissions_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "dids"
            referencedColumns: ["did"]
          },
          {
            foreignKeyName: "admissions_patient_did_fkey"
            columns: ["patient_did"]
            isOneToOne: false
            referencedRelation: "patient_master"
            referencedColumns: ["patient_did"]
          },
        ]
      }
      patient_master: {
        Row: {
          active_medications: number | null
          admission_id: string | null
          admission_status:
            | Database["public"]["Enums"]["admission_status"]
            | null
          admitted_at: string | null
          assigned_doctor_did: string | null
          assigned_nurse_id: string | null
          bed_id: string | null
          bed_number: string | null
          bed_status: string | null
          bed_type: string | null
          billing_last_updated: string | null
          building_code: string | null
          building_id: string | null
          building_name: string | null
          coverage_percentage: number | null
          cross_hospital_access_enabled: boolean | null
          diagnosis: string | null
          discharged_at: string | null
          emergency_access_enabled: boolean | null
          expected_discharge: string | null
          floor_id: string | null
          floor_name: string | null
          floor_number: number | null
          hospital_id: string | null
          hospital_name: string | null
          insurance_provider: string | null
          insurance_verification_enabled: boolean | null
          last_admission_date: string | null
          outstanding_balance: number | null
          patient_did: string | null
          patient_name: string | null
          patient_registered_at: string | null
          policy_number: string | null
          research_sharing_enabled: boolean | null
          room_capacity: number | null
          room_id: string | null
          room_number: string | null
          room_type: string | null
          total_billed: number | null
          total_lab_results: number | null
          total_medical_records: number | null
          total_paid: number | null
          total_procedures: number | null
          ward_code: string | null
          ward_id: string | null
          ward_name: string | null
          ward_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dids_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      signing_events_confirmed: {
        Row: {
          confirmed_at: string | null
          created_at: string | null
          event_id: string | null
          hospital_id: string | null
          record_type: string | null
          signer_type: string | null
          transaction_id: string | null
          user_id: string | null
          user_wallet: string | null
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string | null
          event_id?: string | null
          hospital_id?: string | null
          record_type?: string | null
          signer_type?: string | null
          transaction_id?: string | null
          user_id?: string | null
          user_wallet?: string | null
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string | null
          event_id?: string | null
          hospital_id?: string | null
          record_type?: string | null
          signer_type?: string | null
          transaction_id?: string | null
          user_id?: string | null
          user_wallet?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signing_events_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      signing_events_embedded: {
        Row: {
          confirmed_at: string | null
          created_at: string | null
          event_id: string | null
          hospital_id: string | null
          record_type: string | null
          signer_wallet: string | null
          transaction_id: string | null
          user_id: string | null
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string | null
          event_id?: string | null
          hospital_id?: string | null
          record_type?: string | null
          signer_wallet?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string | null
          event_id?: string | null
          hospital_id?: string | null
          record_type?: string | null
          signer_wallet?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signing_events_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      signing_events_failed: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_id: string | null
          hospital_id: string | null
          record_type: string | null
          signer_type: string | null
          status: string | null
          transaction_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_id?: string | null
          hospital_id?: string | null
          record_type?: string | null
          signer_type?: string | null
          status?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_id?: string | null
          hospital_id?: string | null
          record_type?: string | null
          signer_type?: string | null
          status?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signing_events_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      signing_events_phantom_users: {
        Row: {
          confirmed_at: string | null
          created_at: string | null
          event_id: string | null
          hospital_id: string | null
          record_type: string | null
          transaction_id: string | null
          user_id: string | null
          user_wallet: string | null
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string | null
          event_id?: string | null
          hospital_id?: string | null
          record_type?: string | null
          transaction_id?: string | null
          user_id?: string | null
          user_wallet?: string | null
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string | null
          event_id?: string | null
          hospital_id?: string | null
          record_type?: string | null
          transaction_id?: string | null
          user_id?: string | null
          user_wallet?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signing_events_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
      ward_occupancy: {
        Row: {
          currently_admitted: number | null
          discharged: number | null
          hospital_id: string | null
          total_admitted: number | null
          transferred: number | null
          ward: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admissions_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["hospital_id"]
          },
        ]
      }
    }
    Functions: {
      approve_consent: {
        Args: { p_grant_id: string; p_patient_did: string }
        Returns: boolean
      }
      generate_batch_number: { Args: { p_item_code: string }; Returns: string }
      generate_movement_id: { Args: never; Returns: string }
      get_active_consent: {
        Args: {
          p_doctor_did: string
          p_patient_did: string
          p_resource?: string
        }
        Returns: {
          access_started_at: string | null
          approved_at: string | null
          doctor_did: string
          doctor_name: string | null
          doctor_specialty: string | null
          expires_at: string | null
          grant_id: string
          granted_at: string
          patient_did: string
          reason: string | null
          rejected_at: string | null
          requested_at: string | null
          resource: string
          revoked_at: string | null
          status: Database["public"]["Enums"]["consent_status"]
        }
        SetofOptions: {
          from: "*"
          to: "consents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_daily_signing_volume: {
        Args: { p_date?: string; p_hospital_id: string }
        Returns: {
          date_key: string
          embedded_signings: number
          phantom_signings: number
          total_signings: number
        }[]
      }
      get_expiration_status: {
        Args: { p_expiry_date: string; p_threshold_days?: number }
        Returns: Database["public"]["Enums"]["expiration_status"]
      }
      get_patient_admission_history: {
        Args: { p_patient_did: string }
        Returns: {
          admission_id: string
          admitted_at: string
          bed: string
          diagnosis: string
          discharged_at: string
          length_of_stay_days: number
          status: string
          ward: string
        }[]
      }
      get_patient_current_admission: {
        Args: { p_patient_did: string }
        Returns: {
          admission_id: string
          admitted_at: string
          bed: string
          diagnosis: string
          expected_discharge: string
          room: string
          status: string
          ward: string
        }[]
      }
      get_patient_location: {
        Args: { p_patient_did: string }
        Returns: {
          bed_id: string
          bed_number: string
          bed_type: string
          building_id: string
          building_name: string
          floor_id: string
          floor_number: number
          hospital_id: string
          hospital_name: string
          patient_did: string
          room_id: string
          room_number: string
          room_type: string
          ward_id: string
          ward_name: string
          ward_type: string
        }[]
      }
      get_patient_medical_records: {
        Args: { p_patient_did: string }
        Returns: {
          author_name: string
          content: string
          created_at: string
          record_id: string
          record_type: string
          title: string
        }[]
      }
      get_patient_name: { Args: { p_patient_did: string }; Returns: string }
      get_prescription_with_items: {
        Args: { prescription_id: string }
        Returns: Json
      }
      get_signing_stats: {
        Args: { p_hospital_id: string }
        Returns: {
          confirmed_signings: number
          embedded_signings: number
          failed_signings: number
          phantom_signings: number
          success_rate: number
          total_signings: number
        }[]
      }
      get_user_signing_history: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          confirmed: boolean
          created_at: string
          event_id: string
          record_type: string
          signer_type: string
          status: string
          transaction_id: string
        }[]
      }
      is_batch_expired: { Args: { p_expiry_date: string }; Returns: boolean }
      is_batch_near_expiry: {
        Args: { p_expiry_date: string; p_threshold_days?: number }
        Returns: boolean
      }
      is_consent_active: {
        Args: {
          consent_record: Database["public"]["Tables"]["consents"]["Row"]
        }
        Returns: boolean
      }
      mark_audit_anchored: {
        Args: { p_anchor_id: string; p_status: string; p_tx_id: string }
        Returns: undefined
      }
      reject_consent: {
        Args: { p_grant_id: string; p_patient_did: string }
        Returns: boolean
      }
      request_consent: {
        Args: {
          p_doctor_did: string
          p_doctor_name: string
          p_doctor_specialty: string
          p_patient_did: string
          p_reason: string
          p_resource: string
        }
        Returns: string
      }
      validate_consent_access: {
        Args: {
          p_doctor_did: string
          p_patient_did: string
          p_resource: string
        }
        Returns: boolean
      }
      verify_audit_record: { Args: { p_tx_id: string }; Returns: Json }
      write_audit_record: {
        Args: {
          p_action: string
          p_actor_did: string
          p_actor_id: string
          p_auth_policy: string
          p_auth_status: string
          p_metadata: Json
          p_new_value: Json
          p_outcome: string
          p_prev_value: Json
          p_resource: string
          p_severity: string
          p_what_entity_id: string
          p_what_entity_type: string
          p_what_module: string
          p_where_hospital: string
          p_where_location: string
          p_who_email: string
          p_who_hospital_id: string
          p_who_name: string
          p_who_role: string
        }
        Returns: string
      }
    }
    Enums: {
      admission_status: "admitted" | "discharged" | "transferred"
      alert_severity: "info" | "warning" | "critical"
      alert_status: "open" | "investigating" | "resolved" | "dismissed"
      anchor_status: "pending" | "confirmed" | "failed"
      appt_status:
        | "pending"
        | "confirmed"
        | "rejected"
        | "rescheduled"
        | "cancelled"
        | "completed"
        | "suggested"
      asset_status: "available" | "in-use" | "maintenance" | "retired"
      attendance_action: "in" | "out"
      bed_status:
        | "available"
        | "occupied"
        | "reserved"
        | "cleaning"
        | "maintenance"
        | "blocked"
        | "emergency_reserved"
      card_status: "active" | "revoked" | "expired"
      certification_status: "active" | "expired" | "revoked" | "pending"
      consent_status:
        | "active"
        | "revoked"
        | "expired"
        | "pending"
        | "requested"
        | "rejected"
      did_status: "active" | "suspended" | "revoked"
      dispense_status: "pending" | "dispensed" | "cancelled"
      expiration_status: "valid" | "near_expiry" | "expired"
      inventory_item_status: "active" | "inactive" | "discontinued"
      inventory_item_type:
        | "medicine"
        | "consumable"
        | "medical_supply"
        | "equipment"
        | "other"
      med_status: "active" | "held" | "discontinued" | "completed"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      policy_status: "active" | "draft" | "retired"
      purchase_order_status:
        | "draft"
        | "submitted"
        | "confirmed"
        | "received"
        | "cancelled"
      room_status:
        | "available"
        | "occupied"
        | "reserved"
        | "cleaning"
        | "maintenance"
        | "blocked"
        | "emergency_reserved"
      rx_status: "active" | "dispensed" | "cancelled" | "expired"
      schedule_status: "scheduled" | "in-progress" | "completed" | "cancelled"
      staff_request_status: "pending" | "approved" | "rejected" | "completed"
      stock_movement_type:
        | "received"
        | "issued"
        | "dispensed"
        | "consumed"
        | "transferred"
        | "adjusted"
        | "returned"
        | "wasted"
        | "expired"
        | "damaged"
        | "other"
      user_role: "patient" | "doctor" | "staff" | "admin" | "super_admin"
      visitor_status:
        | "pending"
        | "approved"
        | "denied"
        | "checked-in"
        | "checked-out"
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
      admission_status: ["admitted", "discharged", "transferred"],
      alert_severity: ["info", "warning", "critical"],
      alert_status: ["open", "investigating", "resolved", "dismissed"],
      anchor_status: ["pending", "confirmed", "failed"],
      appt_status: [
        "pending",
        "confirmed",
        "rejected",
        "rescheduled",
        "cancelled",
        "completed",
        "suggested",
      ],
      asset_status: ["available", "in-use", "maintenance", "retired"],
      attendance_action: ["in", "out"],
      bed_status: [
        "available",
        "occupied",
        "reserved",
        "cleaning",
        "maintenance",
        "blocked",
        "emergency_reserved",
      ],
      card_status: ["active", "revoked", "expired"],
      certification_status: ["active", "expired", "revoked", "pending"],
      consent_status: [
        "active",
        "revoked",
        "expired",
        "pending",
        "requested",
        "rejected",
      ],
      did_status: ["active", "suspended", "revoked"],
      dispense_status: ["pending", "dispensed", "cancelled"],
      expiration_status: ["valid", "near_expiry", "expired"],
      inventory_item_status: ["active", "inactive", "discontinued"],
      inventory_item_type: [
        "medicine",
        "consumable",
        "medical_supply",
        "equipment",
        "other",
      ],
      med_status: ["active", "held", "discontinued", "completed"],
      payment_status: ["pending", "paid", "failed", "refunded"],
      policy_status: ["active", "draft", "retired"],
      purchase_order_status: [
        "draft",
        "submitted",
        "confirmed",
        "received",
        "cancelled",
      ],
      room_status: [
        "available",
        "occupied",
        "reserved",
        "cleaning",
        "maintenance",
        "blocked",
        "emergency_reserved",
      ],
      rx_status: ["active", "dispensed", "cancelled", "expired"],
      schedule_status: ["scheduled", "in-progress", "completed", "cancelled"],
      staff_request_status: ["pending", "approved", "rejected", "completed"],
      stock_movement_type: [
        "received",
        "issued",
        "dispensed",
        "consumed",
        "transferred",
        "adjusted",
        "returned",
        "wasted",
        "expired",
        "damaged",
        "other",
      ],
      user_role: ["patient", "doctor", "staff", "admin", "super_admin"],
      visitor_status: [
        "pending",
        "approved",
        "denied",
        "checked-in",
        "checked-out",
      ],
    },
  },
} as const
