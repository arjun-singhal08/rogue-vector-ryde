# =============================================================================
# ROGUE VECTOR — Ryde Dispute Resolver (Streamlit UI Scaffold)
# =============================================================================
# This is the main entry point for the Streamlit app.
# If you are new to Streamlit: run this file with:
#     streamlit run app.py
# =============================================================================

import os

import streamlit as st

# Load environment variables from .env at startup.
# This makes values like GEMINI_API_KEY available via os.environ.
from dotenv import load_dotenv

load_dotenv()

# Import our fake data.  We keep all data in a separate file so the UI code
# stays clean and easy to read.
from data.sample_disputes import DISPUTES

# Import the placeholder agent functions.
# In a later iteration these will be replaced by real LLM API calls.
from agents.dispute_agents import driver_advocate, judge_ruling, rider_advocate


# ------------------------------------------------------------------------------
# 1. PAGE CONFIGURATION
# ------------------------------------------------------------------------------
# st.set_page_config must be the first Streamlit command in the script.
# It controls the browser tab title, the favicon emoji, and the page width.
# `layout="wide"` uses the full width of the browser instead of a narrow column.
st.set_page_config(
    page_title="ROGUE VECTOR — Ryde Dispute Resolver",
    page_icon="⚡",
    layout="wide",
)


# ------------------------------------------------------------------------------
# 2. HEADER
# ------------------------------------------------------------------------------
# st.title renders a large heading at the top of the page.
st.title("⚡ ROGUE VECTOR — Ryde Dispute Resolver")


# ------------------------------------------------------------------------------
# 3. SIDEBAR — DISPUTE SELECTOR
# ------------------------------------------------------------------------------
# Anything placed inside `st.sidebar` appears in the left-hand panel.
# This is a great spot for navigation controls that shouldn't steal space
# from the main content area.
st.sidebar.header("Select a Dispute Case")

# Build a friendly label for each dispute so the dropdown is readable.
# We use a dictionary so we can quickly look up the full case object later.
dispute_options = {
    f"Case #{d['id']}: {d['title']}": d
    for d in DISPUTES
}

# st.selectbox shows a dropdown.  The user sees the friendly labels; we capture
# the chosen label string in `selected_label`.
selected_label = st.sidebar.selectbox(
    label="Choose a case to review",
    options=list(dispute_options.keys()),
)

# Grab the actual dispute dictionary that matches the label the user picked.
selected_dispute = dispute_options[selected_label]


# ------------------------------------------------------------------------------
# 4. COMPLAINT SUMMARY
# ------------------------------------------------------------------------------
# st.subheader creates a medium-sized heading.
st.subheader(selected_dispute["title"])

# st.markdown lets us write formatted text.  Double asterisks make bold text.
st.markdown(f"**Rider Complaint:** {selected_dispute['rider_complaint']}")

# st.divider draws a thin horizontal line to visually separate sections.
st.divider()


# ------------------------------------------------------------------------------
# 5. EVIDENCE & PROFILES LAYOUT
# ------------------------------------------------------------------------------
# st.columns splits the page into side-by-side vertical columns.
# The list [2, 1] means the first column gets 2/3 of the width and the
# second column gets 1/3.
left_col, right_col = st.columns([2, 1])

# --------------------------- LEFT COLUMN: Evidence ---------------------------
with left_col:
    st.header("Evidence")

    # st.expander creates a collapsible box.  `expanded=True` means it starts
    # open.  This keeps the page tidy if we add more sections later.
    with st.expander("Trip & Route Evidence", expanded=True):
        ev = selected_dispute["evidence"]

        # --- Route Deviation evidence (Case #1) ---
        if "actual_route_summary" in ev:
            # Display the route as a readable arrow-separated string.
            st.markdown("**Actual Route Taken:**")
            st.write(" → ".join(ev["actual_route_summary"]))

            st.markdown("**Optimal Route:**")
            st.write(" → ".join(ev["optimal_route_summary"]))

            # st.metric shows a big number with an optional delta indicator.
            # It is perfect for highlighting key stats like time overruns.
            duration_diff = ev["actual_duration_minutes"] - ev["estimated_duration_minutes"]
            st.metric(
                label="Trip Duration",
                value=f"{ev['actual_duration_minutes']} min",
                delta=f"+{duration_diff} min vs estimate",
            )

            st.markdown("**Fare Breakdown:**")
            fare = ev["fare_breakdown"]
            st.write(f"- Base fare: **${fare['base_fare']:.2f}**")
            st.write(f"- Distance charge: **${fare['distance_charge']:.2f}**")
            st.write(f"- Time charge: **${fare['time_charge']:.2f}**")
            st.write(f"- Surge multiplier: **{fare['surge_multiplier']}×**")
            st.divider()
            st.write(f"**Total charged:** ${fare['total_charged']:.2f}")

        # --- Rich No-Show Charge evidence (Case #2) ---
        elif "gps_telemetry" in ev:
            trip = ev["trip_data"]

            st.markdown("**Trip Details**")
            st.write(f"- Pickup: {trip['pickup_location']['name']}")
            st.write(f"- Dropoff: {trip['dropoff_location']['name']}")
            st.write(f"- Scheduled pickup: {trip['scheduled_time']}")
            st.write(f"- Driver arrived: {trip['driver_arrival_time']}")
            st.write(f"- Cancelled: {trip['cancellation_time']}")
            st.write(f"- Cancellation fee: **${trip['cancellation_fee']:.2f}**")
            st.write(f"- Cancellation reason (app): {trip['cancellation_reason']}")

            st.divider()

            st.markdown("**GPS Telemetry**")
            # st.dataframe renders a scrollable table from a list of dicts.
            st.dataframe(ev["gps_telemetry"], use_container_width=True)

            st.divider()

            st.markdown("**Chat Logs**")
            for msg in ev["chat_logs"]:
                sender = msg["sender"].capitalize()
                msg_type = f" ({msg['type']})" if msg["type"] != "message" else ""
                st.write(f"- *{msg['timestamp']}* **{sender}**{msg_type}: {msg['content']}")

            st.divider()

            st.markdown("**App Events**")
            for evt in ev["app_events"]:
                st.write(f"- *{evt['timestamp']}* **{evt['event_type']}**: {evt['details']}")

            st.divider()

            st.markdown("**Cancellation Policy**")
            policy = ev["cancellation_policy"]
            st.write(f"- Free wait time: {policy['free_wait_time_min']} min")
            st.write(f"- Fee after free wait: ${policy['cancellation_fee_after_wait']:.2f}")
            st.write(f"- No-show threshold: {policy['no_show_threshold_min']} min")
            st.write(f"- Fee goes to: {policy['fee_goes_to']}")

# -------------------------- RIGHT COLUMN: Profiles ---------------------------
with right_col:
    st.header("Profiles")

    # st.container with `border=True` draws a subtle box around the content.
    # This mimics a "card" look without needing custom HTML/CSS.
    with st.container(border=True):
        st.markdown("**Driver Profile**")
        driver = selected_dispute["driver_profile"]
        if "name" in driver:
            st.write(f"Name: {driver['name']}")
        st.write(f"Rating: {driver['rating']} ⭐")
        trips = driver.get("total_completed_trips") or driver.get("total_trips", 0)
        st.write(f"Completed trips: {trips:,}")
        if "account_age_days" in driver:
            st.write(f"Account age: {driver['account_age_days']} days")
        if "vehicle" in driver:
            st.write(f"Vehicle: {driver['vehicle']}")
        if "dispute_history" in driver:
            dh = driver["dispute_history"]
            st.write(f"Disputes: {dh.get('total_disputes', 0)} total")
        if "fraud_flags" in driver:
            st.write(f"Fraud flags: {driver['fraud_flags']}")

    # Add a little vertical gap between cards.
    st.markdown(" ")

    with st.container(border=True):
        st.markdown("**Rider Profile**")
        rider = selected_dispute["rider_profile"]
        if "name" in rider:
            st.write(f"Name: {rider['name']}")
        if "rating" in rider:
            st.write(f"Rating: {rider['rating']} ⭐")
        if "total_trips" in rider:
            st.write(f"Total trips: {rider['total_trips']:,}")
        if "account_age_days" in rider:
            st.write(f"Account age: {rider['account_age_days']} days")
        if "prior_disputes" in rider:
            st.write(f"Prior disputes: {rider['prior_disputes']}")
        if "dispute_history" in rider:
            dh = rider["dispute_history"]
            st.write(
                f"Dispute history: {dh.get('total_disputes', 0)} total "
                f"({dh.get('upheld', 0)} upheld, {dh.get('rejected', 0)} rejected)"
            )
        if "fraud_flags" in rider:
            st.write(f"Fraud flags: {rider['fraud_flags']}")
        if "fraud_flag_details" in rider:
            st.write(f"Flag details: {rider['fraud_flag_details']}")
        if "payment_method" in rider:
            st.write(f"Payment: {rider['payment_method']}")


# ------------------------------------------------------------------------------
# 6. ACTION BUTTON
# ------------------------------------------------------------------------------
# We create three columns and put the button in the middle one so it appears
# roughly centered below the evidence.
btn_col1, btn_col2, btn_col3 = st.columns([1, 2, 1])

with btn_col2:
    # st.button returns True on the rerun that happens *after* the user clicks.
    if st.button("Review this complaint", use_container_width=True):
        # ------------------------------------------------------------------
        # These three calls are PLACEHOLDERS.
        # In the future they will be replaced by real LLM API calls that
        # generate arguments and a structured ruling based on the evidence.
        # ------------------------------------------------------------------
        rider_case = rider_advocate(selected_dispute)
        driver_case = driver_advocate(selected_dispute)
        ruling = judge_ruling(rider_case, driver_case, selected_dispute)

        st.success("Review complete — see the results below.")

        st.divider()

        # ------------------------ Rider's Argument ------------------------
        st.header("Rider's Argument")
        with st.container(border=True):
            st.write(rider_case)

        # ------------------------ Driver's Argument -----------------------
        st.header("Driver's Argument")
        with st.container(border=True):
            st.write(driver_case)

        # -------------------------- Judge's Ruling ------------------------
        st.header("Judge's Ruling")
        with st.container(border=True):
            st.markdown(f"**Decision:** {ruling['decision']}")
            st.markdown(f"**Confidence:** {ruling['confidence']}")
            st.markdown(f"**Explanation:** {ruling['explanation']}")


# ------------------------------------------------------------------------------
# 7. FOOTER
# ------------------------------------------------------------------------------
st.divider()
# st.caption renders small, muted text — ideal for disclaimers.
st.caption("All data shown above is synthetic and for demonstration purposes only.")
