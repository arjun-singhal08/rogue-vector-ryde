import type { DisputeCase, ReviewResult } from "./types";

export const CASES: DisputeCase[] = [
  {
    id: 1,
    title: "Route Deviation",
    rider_complaint:
      "The driver took a much longer route than necessary and I was overcharged.",
    evidence: {
      actual_route_summary: ["Main St", "Highway 101", "Oak Ave", "Pine Rd", "Market St"],
      optimal_route_summary: ["Main St", "Direct Blvd", "Market St"],
      actual_duration_minutes: 42,
      estimated_duration_minutes: 18,
      fare_breakdown: {
        base_fare: 5.0,
        distance_charge: 18.5,
        time_charge: 12.6,
        surge_multiplier: 1.2,
        total_charged: 43.32,
      },
    },
    driver_profile: {
      rating: 4.2,
      total_completed_trips: 1247,
    },
    rider_profile: {
      prior_disputes: 0,
    },
  },
  {
    id: 2,
    title: "No-Show Charge Dispute",
    rider_complaint:
      "I was at the pickup point at Tiong Bahru Plaza on time but the driver never showed up. I waited 10 minutes at the lobby and couldn't find the car. The app charged me a $4.00 cancellation fee for a 'no-show' which is completely unfair — I was there, the driver was not. I want the charge reversed immediately.",
    evidence: {
      dispute_ticket: {
        dispute_id: "DISP-002",
        trip_id: "TRIP-2026-09945",
        filed_by: "rider",
        dispute_type: "no_show_charge",
        description:
          "I was at the pickup point at Tiong Bahru Plaza on time but the driver never showed up. I waited 10 minutes at the lobby and couldn't find the car. The app charged me a $4.00 cancellation fee for a 'no-show' which is completely unfair — I was there, the driver was not. I want the charge reversed immediately.",
        filed_at: "2026-09-13T09:20:00+08:00",
        status: "open",
      },
      trip_data: {
        trip_id: "TRIP-2026-09945",
        rider_id: "R-7823",
        driver_id: "D-2398",
        pickup_location: { name: "Tiong Bahru Plaza", lat: 1.2847, lng: 103.8382 },
        dropoff_location: { name: "VivoCity", lat: 1.2648, lng: 103.8223 },
        scheduled_time: "2026-09-13T08:45:00+08:00",
        driver_arrival_time: "2026-09-13T08:43:00+08:00",
        driver_wait_start: "2026-09-13T08:43:00+08:00",
        cancellation_time: "2026-09-13T08:51:00+08:00",
        cancellation_fee: 4.0,
        cancellation_reason: "rider_no_show",
      },
      gps_telemetry: [
        { timestamp: "2026-09-13T08:31:00+08:00", lat: 1.292, lng: 103.845, speed_kmh: 42, status: "en_route" },
        { timestamp: "2026-09-13T08:34:00+08:00", lat: 1.289, lng: 103.843, speed_kmh: 38, status: "en_route" },
        { timestamp: "2026-09-13T08:38:00+08:00", lat: 1.2865, lng: 103.84, speed_kmh: 25, status: "en_route" },
        { timestamp: "2026-09-13T08:41:00+08:00", lat: 1.2852, lng: 103.8388, speed_kmh: 12, status: "en_route" },
        { timestamp: "2026-09-13T08:43:00+08:00", lat: 1.2847, lng: 103.8382, speed_kmh: 0, status: "arrived" },
        { timestamp: "2026-09-13T08:45:00+08:00", lat: 1.2847, lng: 103.8382, speed_kmh: 0, status: "waiting" },
        { timestamp: "2026-09-13T08:48:00+08:00", lat: 1.2847, lng: 103.8382, speed_kmh: 0, status: "waiting" },
        { timestamp: "2026-09-13T08:51:00+08:00", lat: 1.2847, lng: 103.8382, speed_kmh: 0, status: "cancelled" },
      ],
      chat_logs: [
        { timestamp: "2026-09-13T08:43:00+08:00", sender: "driver", type: "message", content: "I've arrived at the pickup point, I'm at the lobby area." },
        { timestamp: "2026-09-13T08:45:20+08:00", sender: "driver", type: "message", content: "I'm waiting at the lobby area, white Honda HR-V plate SGP 4521 M." },
        { timestamp: "2026-09-13T08:47:05+08:00", sender: "driver", type: "call", content: "Outgoing call to rider — not answered (rang 22s, no response)." },
        { timestamp: "2026-09-13T08:49:30+08:00", sender: "driver", type: "message", content: "Hi, are you coming down? I've been waiting a while." },
        { timestamp: "2026-09-13T08:50:45+08:00", sender: "driver", type: "message", content: "Please let me know, otherwise I'll have to cancel the trip." },
        { timestamp: "2026-09-13T08:51:00+08:00", sender: "system", type: "system", content: "Trip cancelled by driver. Reason: rider_no_show. Cancellation fee of $4.00 applied." },
      ],
      app_events: [
        { timestamp: "2026-09-13T08:30:00+08:00", event_type: "booking_confirmed", details: "Rider R-7823 booked trip TRIP-2026-09945 from Tiong Bahru Plaza to VivoCity. Scheduled pickup 08:45." },
        { timestamp: "2026-09-13T08:30:15+08:00", event_type: "driver_assigned", details: "Driver D-2398 (Lim Wei Ming, Honda HR-V SGP 4521 M) assigned. ETA 13 min." },
        { timestamp: "2026-09-13T08:30:20+08:00", event_type: "driver_en_route", details: "Driver started navigating to pickup location. Live tracking enabled." },
        { timestamp: "2026-09-13T08:43:00+08:00", event_type: "driver_arrived", details: "Driver GPS within 10m of pickup point. Speed 0 km/h. Auto-arrival confirmed." },
        { timestamp: "2026-09-13T08:43:05+08:00", event_type: "rider_notified", details: "Push notification + in-app alert sent to rider: 'Your driver has arrived.'" },
        { timestamp: "2026-09-13T08:43:10+08:00", event_type: "wait_timer_started", details: "Free wait timer started. 3 min free wait period ends at 08:46." },
        { timestamp: "2026-09-13T08:47:05+08:00", event_type: "driver_called_rider", details: "Driver initiated in-app call to rider. Call rang 22s, no answer." },
        { timestamp: "2026-09-13T08:46:10+08:00", event_type: "wait_timer_expired", details: "Free 3-min wait period expired. Rider had not boarded. Cancellation fee now applicable per policy." },
        { timestamp: "2026-09-13T08:51:00+08:00", event_type: "cancellation_fee_applied", details: "No-show threshold (8 min) reached. $4.00 cancellation fee charged to rider payment method (e-wallet)." },
        { timestamp: "2026-09-13T08:51:05+08:00", event_type: "driver_released", details: "Driver D-2398 released from trip. Trip status: cancelled (rider_no_show)." },
      ],
      cancellation_policy: {
        policy_note:
          "Policy parameters aligned with Ryde's publicly documented Cancellation and Waiting Time Policy (help.rydesharing.com) as of Oct 2026; specific dispute scenario and data remain fully synthetic.",
        free_wait_time_min: 3,
        cancellation_fee_after_wait: 4.0,
        no_show_threshold_min: 8,
        no_show_threshold_note:
          "Synthetic/demo value; Ryde does not publish an exact separate no-show threshold beyond the 3-minute grace period.",
        fee_goes_to: "driver_compensation",
      },
    },
    driver_profile: {
      name: "Lim Wei Ming",
      rating: 4.9,
      total_completed_trips: 3201,
      account_age_days: 900,
      dispute_history: { total_disputes: 1, upheld_against: 0, rejected: 1 },
      fraud_flags: 0,
      vehicle: "Honda HR-V (SGP 4521 M)",
    },
    rider_profile: {
      name: "Michael Wong",
      rating: 3.9,
      total_trips: 34,
      account_age_days: 210,
      prior_disputes: 4,
      dispute_history: { total_disputes: 4, upheld: 1, rejected: 3 },
      fraud_flags: 1,
      fraud_flag_details: "flagged_for_frequent_late_cancellations",
      payment_method: "e-wallet",
    },
  },
  {
    id: 3,
    title: "Property Damage Dispute",
    rider_complaint:
      "The driver is wrongly charging me $35 for vehicle cleaning after my ride. They claim I spilled a drink on the back seat, but I did not have a drink in the car and I believe the stain was already there. I want the cleaning charge removed.",
    evidence: {
      dispute_ticket: {
        dispute_id: "DISP-003",
        trip_id: "TRIP-2026-10418",
        filed_by: "rider",
        dispute_type: "property_damage_cleaning_fee",
        description:
          "Rider disputes a $35.00 vehicle cleaning charge after the driver reported a spilled drink stain on the rear passenger seat.",
        filed_at: "2026-09-18T19:42:00+08:00",
        status: "open",
      },
      trip_data: {
        trip_id: "TRIP-2026-10418",
        rider_id: "R-4419",
        driver_id: "D-6154",
        pickup_location: { name: "Orchard Gateway", lat: 1.3007, lng: 103.839 },
        dropoff_location: { name: "Katong Shopping Centre", lat: 1.3043, lng: 103.9023 },
        pickup_time: "2026-09-18T18:55:00+08:00",
        dropoff_time: "2026-09-18T19:24:00+08:00",
        fare_charged: 24.7,
        cleaning_fee: 35.0,
      },
      driver_submitted_photo: {
        timestamp: "2026-09-18T19:29:00+08:00",
        description:
          "Driver-submitted in-app photo showing a dark spilled-drink stain on the right side of the rear passenger seat, filed 5 minutes after drop-off.",
        metadata:
          "Uploaded through the driver app as a cleaning-fee report; photo has no before-ride comparison image.",
      },
      cleaning_fee_charge_event: {
        timestamp: "2026-09-18T19:36:00+08:00",
        amount: 35.0,
        reason: "vehicle_cleaning",
        status: "charged_to_rider_payment_method",
      },
      chat_logs: [
        { timestamp: "2026-09-18T19:31:00+08:00", sender: "driver", type: "message", content: "Hi, I found a drink spill on the back seat after your trip and have submitted a cleaning report." },
        { timestamp: "2026-09-18T19:39:00+08:00", sender: "system", type: "system", content: "A $35.00 cleaning fee was applied based on the driver's submitted report." },
        { timestamp: "2026-09-18T19:43:00+08:00", sender: "rider", type: "message", content: "I did not spill anything. I did not bring a drink into the car, and the stain may have already been there." },
        { timestamp: "2026-09-18T19:48:00+08:00", sender: "driver", type: "message", content: "The stain was not visible to me before your ride. I noticed it only after drop-off." },
      ],
      app_events: [
        { timestamp: "2026-09-18T18:55:00+08:00", event_type: "trip_started", details: "Trip TRIP-2026-10418 started from Orchard Gateway." },
        { timestamp: "2026-09-18T19:24:00+08:00", event_type: "trip_completed", details: "Trip completed at Katong Shopping Centre." },
        { timestamp: "2026-09-18T19:29:00+08:00", event_type: "driver_photo_report_submitted", details: "Driver submitted one photo of a rear-seat stain via the in-app cleaning report flow." },
        { timestamp: "2026-09-18T19:36:00+08:00", event_type: "cleaning_fee_applied", details: "$35.00 cleaning fee charged to rider payment method." },
      ],
      ambiguity_notes: [
        "The photo was submitted shortly after drop-off, which supports the driver's report.",
        "There is no pre-ride interior photo, so the evidence cannot prove definitively when or by whom the stain was caused.",
        "The rider has a clean trip history with no prior disputes, which supports the rider's credibility but is not conclusive.",
      ],
    },
    driver_profile: {
      name: "Nur Aisyah Tan",
      rating: 4.8,
      total_completed_trips: 1186,
      account_age_days: 540,
      dispute_history: { total_disputes: 3, cleaning_fee_reports: 1, upheld: 2, rejected: 1 },
      fraud_flags: 0,
      vehicle: "Toyota Prius (SJP 8842 K)",
    },
    rider_profile: {
      name: "Sarah Lim",
      rating: 4.9,
      total_trips: 50,
      account_age_days: 420,
      prior_disputes: 0,
      dispute_history: { total_disputes: 0, upheld: 0, rejected: 0 },
      fraud_flags: 0,
      trip_history_note: "50 completed trips with no prior disputes or cleaning-fee incidents.",
      payment_method: "credit_card",
    },
  },
  {
    id: 4,
    title: "Lost Item Dispute",
    rider_complaint:
      "I left my phone in the vehicle shortly after drop-off. The driver first said they would check, then asked for an unreasonable delivery fee to return it and stopped responding. I want help getting my phone back fairly.",
    evidence: {
      dispute_ticket: {
        dispute_id: "DISP-004",
        trip_id: "TRIP-2026-10877",
        filed_by: "rider",
        dispute_type: "lost_item_return",
        description:
          "Rider reports a phone left in the vehicle and disputes the driver's requested delivery fee for returning it.",
        filed_at: "2026-09-22T23:20:00+08:00",
        status: "open",
      },
      trip_data: {
        trip_id: "TRIP-2026-10877",
        rider_id: "R-9031",
        driver_id: "D-7741",
        pickup_location: { name: "Bugis Junction", lat: 1.2996, lng: 103.8558 },
        dropoff_location: { name: "Holland Village MRT", lat: 1.3122, lng: 103.7964 },
        pickup_time: "2026-09-22T21:28:00+08:00",
        dropoff_time: "2026-09-22T21:56:00+08:00",
        fare_charged: 18.9,
      },
      lost_item_report: {
        item: "smartphone",
        reported_missing_at: "2026-09-22T22:04:00+08:00",
        time_after_dropoff_min: 8,
        reported_location: "Rider states the phone was last seen on the rear seat during the ride.",
      },
      chat_logs: [
        { timestamp: "2026-09-22T22:05:00+08:00", sender: "rider", type: "message", content: "Hi, I think I left my phone in your car. I got out 8 minutes ago at Holland Village MRT. Could you please check the back seat?" },
        { timestamp: "2026-09-22T22:09:00+08:00", sender: "driver", type: "message", content: "I am driving another passenger now. I will check after this trip." },
        { timestamp: "2026-09-22T22:34:00+08:00", sender: "driver", type: "message", content: "I found a phone at the back. I can return it tomorrow if you pay $45 delivery fee." },
        { timestamp: "2026-09-22T22:36:00+08:00", sender: "rider", type: "message", content: "That fee is too high. I can meet you near your next pickup or pay a reasonable return fee through the app." },
        { timestamp: "2026-09-22T22:52:00+08:00", sender: "rider", type: "message", content: "Please confirm a fair way to return it. This is urgent." },
        { timestamp: "2026-09-22T23:18:00+08:00", sender: "system", type: "system", content: "No further driver response recorded before dispute was filed." },
      ],
      app_events: [
        { timestamp: "2026-09-22T21:56:00+08:00", event_type: "trip_completed", details: "Trip completed at Holland Village MRT." },
        { timestamp: "2026-09-22T22:04:00+08:00", event_type: "lost_item_report_created", details: "Rider reported missing smartphone 8 minutes after drop-off." },
        { timestamp: "2026-09-22T22:34:00+08:00", event_type: "driver_item_found_message", details: "Driver message states they found a phone in the vehicle." },
        { timestamp: "2026-09-22T23:20:00+08:00", event_type: "support_ticket_opened", details: "Rider opened lost-item dispute after the return-fee chat remained unresolved." },
      ],
      lost_item_policy: {
        return_coordination: "Rider and driver should coordinate return through in-app messaging or support.",
        fee_note:
          "Any return compensation in this demo case is synthetic and should be assessed for reasonableness.",
      },
      evidence_weight_notes: [
        "The report was filed shortly after drop-off, which supports the rider's claim.",
        "The driver's own message says they found a phone, which strongly supports that an item was in the vehicle.",
        "The driver's two prior similar complaints matter, but both were resolved and do not prove misconduct in this case.",
        "The exact fee reasonableness remains partly subjective without a published route or return-cost record.",
      ],
    },
    driver_profile: {
      name: "Daniel Koh",
      rating: 4.6,
      total_completed_trips: 2140,
      account_age_days: 760,
      dispute_history: {
        total_disputes: 5,
        lost_item_complaints: 2,
        lost_item_resolved: 2,
        upheld_against: 1,
        rejected: 2,
      },
      fraud_flags: 0,
      vehicle: "Hyundai Ioniq (SND 9021 B)",
    },
    rider_profile: {
      name: "Alicia Tan",
      rating: 4.7,
      total_trips: 87,
      account_age_days: 610,
      prior_disputes: 1,
      dispute_history: { total_disputes: 1, upheld: 1, rejected: 0 },
      fraud_flags: 0,
      payment_method: "credit_card",
    },
  },
];

export const MOCK_RESULTS: Record<number, ReviewResult> = {
  1: {
    caseId: 1,
    status: "complete",
    riderCase:
      "The rider's core grievance is that the driver took a significantly longer route than necessary, resulting in an overcharge. The evidence shows the actual route (Main St → Highway 101 → Oak Ave → Pine Rd → Market St) took 42 minutes, while the optimal route (Main St → Direct Blvd → Market St) should have taken only 18 minutes. The fare breakdown shows a total charge of $43.32. The rider has no prior disputes.",
    driverCase:
      "The driver does not dispute that the route taken was longer than the optimal path. However, the available evidence does not establish why the detour occurred — there is no GPS telemetry, no app event log, and no chat transcript for this trip. The driver has a 4.2 rating across 1,247 completed trips with no prior route-deviation disputes, which suggests generally reliable service.",
    decision: "SIMULATED — ESCALATE FOR HUMAN REVIEW",
    confidence: "52%",
    explanation:
      "The evidence confirms the route was longer than optimal and the fare was higher as a result, but it does not establish why the detour occurred. There is no GPS data, app event log, or driver statement in the record to explain the route choice. Because the evidence is incomplete, the model-reported confidence is below the automated-resolution threshold. This simulated result recommends human review to gather additional information before making a determination.",
    escalate: true,
  },
  2: {
    caseId: 2,
    status: "complete",
    riderCase:
      "The rider was present at the pickup location and waited in the lobby area. The driver claims to have arrived, but the rider never saw the vehicle. The cancellation fee of $4.00 is unfair because the rider was ready and available. The chat logs show the driver sent messages, but the rider disputes receiving them or the driver being at the correct location.",
    driverCase:
      "The driver arrived at the pickup point at 08:43, confirmed by GPS telemetry showing the vehicle stationary at the correct coordinates. The driver sent multiple messages and attempted a call that went unanswered. The rider did not board within the 8-minute no-show threshold, and the cancellation fee was applied per policy after the free 3-minute wait period expired.",
    decision: "SIMULATED — UPHELD",
    confidence: "68%",
    explanation:
      "GPS data confirms the driver was at the pickup location. The rider's claim of not seeing the car is not independently verified. However, the rider's history of 4 prior disputes (3 rejected) is noted. The cancellation fee is upheld per policy, but the case is flagged for review of lobby-area pickup procedures.",
    escalate: false,
  },
  3: {
    caseId: 3,
    status: "complete",
    riderCase:
      "The rider denies spilling any drink and states they did not bring a beverage into the vehicle. The cleaning fee of $35.00 is unjustified. There is no pre-ride photo to prove the stain existed before the trip, and the rider has a clean history with 50 trips and zero prior disputes.",
    driverCase:
      "The driver submitted a photo of the stain within 5 minutes of drop-off, which supports the claim that the damage occurred during the ride. The driver states the stain was not visible before pickup. The photo shows a clear spilled-drink stain on the rear passenger seat.",
    decision: "SIMULATED — ESCALATE FOR HUMAN REVIEW",
    confidence: "48%",
    explanation:
      "The evidence is genuinely ambiguous. The photo supports the driver's report, but there is no pre-ride comparison image to confirm the stain was caused during this trip. The rider's clean history supports credibility, but does not disprove the driver's claim. The confidence is below the automated-resolution threshold, so this case requires human review to assess the photo and determine fair liability.",
    escalate: true,
  },
  4: {
    caseId: 4,
    status: "complete",
    riderCase:
      "The rider reported the missing phone within 8 minutes of drop-off, which is prompt and credible. The driver acknowledged finding a phone in the vehicle. The requested $45 delivery fee is unreasonable, and the driver stopped responding after the rider offered alternatives. The rider has a generally clean dispute history.",
    driverCase:
      "The driver found a phone and offered to return it for a fee that covers time and fuel. The driver was driving another passenger when first contacted and responded when possible. The driver has 2 prior lost-item complaints, but both were resolved without misconduct findings. The driver disputes that the fee is unreasonable given the distance and time required.",
    decision: "SIMULATED — UPHELD",
    confidence: "65%",
    explanation:
      "The rider's prompt report and the driver's admission of finding a phone strongly support the rider's claim. The $45 fee requested by the driver is excessive. The driver should coordinate return through the app's lost-item flow at a reasonable fee. The driver's prior resolved complaints are noted but do not prove misconduct here.",
    escalate: false,
  },
};
