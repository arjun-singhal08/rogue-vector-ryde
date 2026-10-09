export interface Location {
  name: string;
  lat: number;
  lng: number;
}

export interface ChatMessage {
  timestamp: string;
  sender: string;
  type: string;
  content: string;
}

export interface AppEvent {
  timestamp: string;
  event_type: string;
  details: string;
}

export interface GPSTelemetry {
  timestamp: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  status: string;
}

export interface DisputeTicket {
  dispute_id: string;
  trip_id: string;
  filed_by: string;
  dispute_type: string;
  description: string;
  filed_at: string;
  status: string;
}

export interface TripData {
  trip_id: string;
  rider_id?: string;
  driver_id?: string;
  pickup_location?: Location;
  dropoff_location?: Location;
  pickup_time?: string;
  dropoff_time?: string;
  scheduled_time?: string;
  driver_arrival_time?: string;
  driver_wait_start?: string;
  cancellation_time?: string;
  cancellation_fee?: number;
  cancellation_reason?: string;
  fare_charged?: number;
  cleaning_fee?: number;
}

export interface Evidence {
  dispute_ticket?: DisputeTicket;
  trip_data?: TripData;
  actual_route_summary?: string[];
  optimal_route_summary?: string[];
  actual_duration_minutes?: number;
  estimated_duration_minutes?: number;
  fare_breakdown?: Record<string, number>;
  gps_telemetry?: GPSTelemetry[];
  chat_logs?: ChatMessage[];
  app_events?: AppEvent[];
  cancellation_policy?: Record<string, unknown>;
  driver_submitted_photo?: Record<string, string>;
  cleaning_fee_charge_event?: Record<string, unknown>;
  ambiguity_notes?: string[];
  lost_item_report?: Record<string, unknown>;
  lost_item_policy?: Record<string, string>;
  evidence_weight_notes?: string[];
  [key: string]: unknown;
}

export interface Profile {
  name?: string;
  rating?: number;
  total_completed_trips?: number;
  total_trips?: number;
  account_age_days?: number;
  prior_disputes?: number;
  dispute_history?: Record<string, unknown>;
  fraud_flags?: number;
  vehicle?: string;
  payment_method?: string;
  trip_history_note?: string;
  fraud_flag_details?: string;
}

export interface DisputeCase {
  id: number;
  title: string;
  rider_complaint: string;
  evidence: Evidence;
  driver_profile: Profile;
  rider_profile: Profile;
  expected_ruling?: string;
}

export interface ReviewResult {
  caseId: number;
  status: "idle" | "running" | "complete" | "failed";
  operationalState?: "processing" | "waiting_retry";
  retryDeadline?: number;
  riderCase?: string;
  driverCase?: string;
  decision?: string;
  confidence?: string;
  explanation?: string;
  escalate?: boolean;
  error?: string;
  elapsedMs?: number;
}
