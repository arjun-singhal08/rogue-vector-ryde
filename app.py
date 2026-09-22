# =============================================================================
# ROGUE VECTOR — Ryde Dispute Resolver (Streamlit UI Scaffold)
# =============================================================================
# This is the main entry point for the Streamlit app.
# If you are new to Streamlit: run this file with:
#     streamlit run app.py
# =============================================================================

import streamlit as st

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

        # --- Route Deviation evidence ---
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

        # --- No-Show Charge evidence ---
        elif "driver_gps_when_arrived" in ev:
            st.markdown("**Driver GPS when marked 'Arrived':**")
            gps = ev["driver_gps_when_arrived"]
            st.write(f"- Location: {gps['location_name']}")
            st.write(f"- Coordinates: ({gps['lat']}, {gps['lng']})")
            st.write(f"- Timestamp: {ev['timestamp_marked_arrived']}")

            st.markdown("**Rider Chat Messages:**")
            # Loop through each message and render it as a bullet point.
            for msg in ev["rider_chat_messages"]:
                st.write(
                    f"- *{msg['timestamp']}* **{msg['sender'].capitalize()}:** {msg['text']}"
                )

            st.markdown("**Cancellation Fee:**")
            st.write(f"${ev['cancellation_fee_charged']:.2f}")

# -------------------------- RIGHT COLUMN: Profiles ---------------------------
with right_col:
    st.header("Profiles")

    # st.container with `border=True` draws a subtle box around the content.
    # This mimics a "card" look without needing custom HTML/CSS.
    with st.container(border=True):
        st.markdown("**Driver Profile**")
        driver = selected_dispute["driver_profile"]
        st.write(f"Rating: {driver['rating']} ⭐")
        st.write(f"Completed trips: {driver['total_completed_trips']:,}")

    # Add a little vertical gap between cards.
    st.markdown(" ")

    with st.container(border=True):
        st.markdown("**Rider Profile**")
        rider = selected_dispute["rider_profile"]
        st.write(f"Prior disputes: {rider['prior_disputes']}")


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
