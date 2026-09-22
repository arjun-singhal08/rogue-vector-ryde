# =============================================================================
# Synthetic Sample Data — NOT real Ryde data
# =============================================================================
# This module holds fake dispute cases used only for UI scaffolding and demo
# purposes. None of the numbers, names, routes, or timestamps come from a
# production system.
# =============================================================================

DISPUTES = [
    {
        "id": 1,
        "title": "Route Deviation",
        "rider_complaint": (
            "The driver took a much longer route than necessary and I was overcharged."
        ),
        "evidence": {
            "actual_route_summary": [
                "Main St",
                "Highway 101",
                "Oak Ave",
                "Pine Rd",
                "Market St",
            ],
            "optimal_route_summary": ["Main St", "Direct Blvd", "Market St"],
            "actual_duration_minutes": 42,
            "estimated_duration_minutes": 18,
            "fare_breakdown": {
                "base_fare": 5.00,
                "distance_charge": 18.50,
                "time_charge": 12.60,
                "surge_multiplier": 1.2,
                "total_charged": 43.32,
            },
        },
        "driver_profile": {
            "rating": 4.2,
            "total_completed_trips": 1247,
        },
        "rider_profile": {
            "prior_disputes": 0,
        },
    },
    {
        "id": 2,
        "title": "No-Show Charge",
        "rider_complaint": (
            "The driver never showed up but I was still charged a cancellation fee."
        ),
        "evidence": {
            "driver_gps_when_arrived": {
                "lat": 1.3521,
                "lng": 103.8198,
                "location_name": "Approx. 200 m from pickup point",
            },
            "timestamp_marked_arrived": "2024-06-15T14:23:00Z",
            "rider_chat_messages": [
                {
                    "timestamp": "2024-06-15T14:20:00Z",
                    "sender": "rider",
                    "text": "I'm at the pickup point, where are you?",
                },
                {
                    "timestamp": "2024-06-15T14:24:00Z",
                    "sender": "rider",
                    "text": "I don't see you, please confirm your location.",
                },
                {
                    "timestamp": "2024-06-15T14:30:00Z",
                    "sender": "rider",
                    "text": "I'm cancelling, you never arrived.",
                },
            ],
            "cancellation_fee_charged": 4.50,
        },
        "driver_profile": {
            "rating": 4.7,
            "total_completed_trips": 3420,
        },
        "rider_profile": {
            "prior_disputes": 2,
        },
    },
]
