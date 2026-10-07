# =============================================================================
# ROGUE VECTOR — Ryde Dispute Resolver
# =============================================================================
# Streamlit entry point. Run with:
#     streamlit run app.py
# =============================================================================

import html

import streamlit as st
from dotenv import load_dotenv

from agents.dispute_agents import driver_advocate, judge_ruling, rider_advocate
from data.sample_disputes import DISPUTES

load_dotenv()

st.set_page_config(
    page_title="ROGUE VECTOR — Dispute Review",
    page_icon="RV",
    layout="wide",
)


# ------------------------------------------------------------------------------
# Styling
# ------------------------------------------------------------------------------
st.markdown(
    """
    <style>
        .stApp {
            background: #f6f8f8;
            color: #111827;
        }

        h1, h2, h3, h4, h5, h6, p, li, label {
            color: #111827;
        }

        .rv-card {
            box-sizing: border-box;
            width: 100%;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 1rem 1.15rem;
            margin-bottom: 1rem;
            color: #111827;
        }

        .rv-header-card {
            border-left: 4px solid #0f766e;
        }

        .rv-judge-card {
            border-left: 5px solid #0f766e;
        }

        .rv-kicker {
            color: #0f766e;
            font-size: 0.78rem;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            margin-bottom: 0.35rem;
        }

        .rv-title {
            font-size: 1.75rem;
            line-height: 1.2;
            font-weight: 700;
            margin: 0 0 0.45rem 0;
            color: #111827;
        }

        .rv-section-title {
            font-size: 1.05rem;
            font-weight: 700;
            margin: 0 0 0.55rem 0;
            color: #111827;
        }

        .rv-muted {
            color: #4b5563;
            font-size: 0.93rem;
        }

        .rv-text {
            color: #111827;
            line-height: 1.55;
            text-align: left;
            letter-spacing: normal;
            overflow-wrap: anywhere;
            word-break: break-word;
        }

        .rv-pill {
            display: inline-block;
            border: 1px solid #99f6e4;
            background: #f0fdfa;
            color: #115e59;
            border-radius: 999px;
            padding: 0.18rem 0.6rem;
            font-size: 0.78rem;
            font-weight: 700;
            margin-right: 0.35rem;
        }

        .rv-warning-pill {
            display: inline-block;
            border: 1px solid #fed7aa;
            background: #fff7ed;
            color: #9a3412;
            border-radius: 999px;
            padding: 0.18rem 0.6rem;
            font-size: 0.78rem;
            font-weight: 700;
            margin-right: 0.35rem;
        }

        .rv-preview {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-left: 3px solid #0f766e;
            border-radius: 8px;
            padding: 0.85rem 1rem;
            color: #111827;
            line-height: 1.5;
            overflow-wrap: anywhere;
            word-break: break-word;
        }

        .rv-notice {
            border-left: 4px solid #0f766e;
            background: #ffffff;
            border-radius: 8px;
            padding: 0.85rem 1rem;
            border-top: 1px solid #e5e7eb;
            border-right: 1px solid #e5e7eb;
            border-bottom: 1px solid #e5e7eb;
            color: #374151;
        }
    </style>
    """,
    unsafe_allow_html=True,
)


# ------------------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------------------
def as_html(value: object) -> str:
    """Escape model/data text for safe HTML display while preserving line breaks."""
    return html.escape(str(value)).replace("\n", "<br>")


def labelize(key: str) -> str:
    return key.replace("_", " ").title()


def money(value: float) -> str:
    return f"${value:.2f}"


def case_option(dispute: dict) -> str:
    return f"Case #{dispute['id']} — {dispute['title']}"


def agent_failed(output: object) -> bool:
    return isinstance(output, str) and output.strip().startswith("[ERROR]")


def ruling_failed(ruling: object) -> bool:
    if not isinstance(ruling, dict):
        return True
    return str(ruling.get("decision", "")).strip() == "[ERROR]" or str(
        ruling.get("explanation", "")
    ).strip().startswith("[ERROR]")


def compact_preview(text: object, limit: int = 420) -> str:
    value = " ".join(str(text).split())
    if len(value) <= limit:
        return value
    return f"{value[:limit].rstrip()}..."


def render_html_card(title: str, body: str, *, kicker: str | None = None, css_class: str = "") -> None:
    kicker_html = f'<div class="rv-kicker">{html.escape(kicker)}</div>' if kicker else ""
    st.markdown(
        f"""
        <div class="rv-card {css_class}">
            {kicker_html}
            <div class="rv-section-title">{html.escape(title)}</div>
            <div class="rv-text">{as_html(body)}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_key_values(data: dict, *, money_keys: set[str] | None = None) -> None:
    money_keys = money_keys or set()
    for key, value in data.items():
        label = labelize(key)
        if isinstance(value, dict):
            if "name" in value:
                st.write(f"- **{label}:** {value['name']}")
            else:
                st.write(f"- **{label}:**")
                st.json(value)
        elif isinstance(value, list):
            st.write(f"- **{label}:**")
            for item in value:
                st.write(f"  - {item}")
        elif key in money_keys and isinstance(value, (int, float)):
            st.write(f"- **{label}:** {money(float(value))}")
        else:
            st.write(f"- **{label}:** {value}")


def render_chat_logs(messages: list[dict]) -> None:
    for msg in messages:
        sender = str(msg.get("sender", "unknown")).capitalize()
        msg_type = f" ({msg['type']})" if msg.get("type") != "message" else ""
        st.write(f"- *{msg.get('timestamp')}* **{sender}**{msg_type}: {msg.get('content')}")


def render_app_events(events: list[dict]) -> None:
    for event in events:
        st.write(f"- *{event.get('timestamp')}* **{event.get('event_type')}**: {event.get('details')}")


def render_profiles(dispute: dict) -> None:
    driver_col, rider_col = st.columns(2)

    with driver_col:
        with st.container(border=True):
            st.subheader("Driver profile")
            render_key_values(dispute["driver_profile"])

    with rider_col:
        with st.container(border=True):
            st.subheader("Rider profile")
            render_key_values(dispute["rider_profile"])


def render_route_deviation(dispute: dict) -> None:
    ev = dispute["evidence"]
    route_tab, fare_tab, profiles_tab, raw_tab = st.tabs(
        ["Route comparison", "Fare details", "Profiles", "Raw evidence"]
    )

    with route_tab:
        st.subheader("Route comparison")
        st.write("**Actual route taken**")
        st.write(" → ".join(ev["actual_route_summary"]))
        st.write("**Optimal route**")
        st.write(" → ".join(ev["optimal_route_summary"]))
        duration_diff = ev["actual_duration_minutes"] - ev["estimated_duration_minutes"]
        st.metric(
            "Trip duration",
            f"{ev['actual_duration_minutes']} min",
            f"+{duration_diff} min vs estimate",
        )

    with fare_tab:
        st.subheader("Fare breakdown")
        fare = ev["fare_breakdown"]
        render_key_values(fare, money_keys={"base_fare", "distance_charge", "time_charge", "total_charged"})

    with profiles_tab:
        render_profiles(dispute)

    with raw_tab:
        st.json(ev)


def render_no_show(dispute: dict) -> None:
    ev = dispute["evidence"]
    trip_tab, gps_tab, comms_tab, policy_tab, profiles_tab, raw_tab = st.tabs(
        ["Trip details", "GPS telemetry", "Comms & events", "Policy", "Profiles", "Raw evidence"]
    )

    with trip_tab:
        st.subheader("Trip details")
        render_key_values(ev["trip_data"], money_keys={"cancellation_fee"})

    with gps_tab:
        st.subheader("GPS telemetry")
        st.dataframe(ev["gps_telemetry"], width="stretch")

    with comms_tab:
        st.subheader("Chat logs")
        render_chat_logs(ev["chat_logs"])
        st.divider()
        st.subheader("App events")
        render_app_events(ev["app_events"])

    with policy_tab:
        st.subheader("Cancellation policy")
        render_key_values(ev["cancellation_policy"], money_keys={"cancellation_fee_after_wait"})

    with profiles_tab:
        render_profiles(dispute)

    with raw_tab:
        st.json(ev)


def render_property_damage(dispute: dict) -> None:
    ev = dispute["evidence"]
    trip_tab, photo_tab, comms_tab, notes_tab, profiles_tab, raw_tab = st.tabs(
        ["Trip & charge", "Photo report", "Comms & events", "Ambiguity", "Profiles", "Raw evidence"]
    )

    with trip_tab:
        st.subheader("Trip details")
        render_key_values(ev["trip_data"], money_keys={"fare_charged", "cleaning_fee"})
        st.divider()
        st.subheader("Cleaning fee charge event")
        render_key_values(ev["cleaning_fee_charge_event"], money_keys={"amount"})

    with photo_tab:
        st.subheader("Driver-submitted photo report")
        render_key_values(ev["driver_submitted_photo"])

    with comms_tab:
        st.subheader("Chat logs")
        render_chat_logs(ev["chat_logs"])
        st.divider()
        st.subheader("App events")
        render_app_events(ev["app_events"])

    with notes_tab:
        st.subheader("Ambiguity notes")
        for note in ev["ambiguity_notes"]:
            st.write(f"- {note}")

    with profiles_tab:
        render_profiles(dispute)

    with raw_tab:
        st.json(ev)


def render_lost_item(dispute: dict) -> None:
    ev = dispute["evidence"]
    report_tab, comms_tab, policy_tab, profiles_tab, raw_tab = st.tabs(
        ["Trip & report", "Comms & events", "Policy & evidence notes", "Profiles", "Raw evidence"]
    )

    with report_tab:
        st.subheader("Trip details")
        render_key_values(ev["trip_data"], money_keys={"fare_charged"})
        st.divider()
        st.subheader("Lost item report")
        render_key_values(ev["lost_item_report"])

    with comms_tab:
        st.subheader("Chat logs")
        render_chat_logs(ev["chat_logs"])
        st.divider()
        st.subheader("App events")
        render_app_events(ev["app_events"])

    with policy_tab:
        st.subheader("Lost item policy context")
        render_key_values(ev["lost_item_policy"])
        st.divider()
        st.subheader("Evidence weight notes")
        for note in ev["evidence_weight_notes"]:
            st.write(f"- {note}")

    with profiles_tab:
        render_profiles(dispute)

    with raw_tab:
        st.json(ev)


def render_evidence(dispute: dict) -> None:
    ev = dispute["evidence"]
    if "actual_route_summary" in ev:
        render_route_deviation(dispute)
    elif "gps_telemetry" in ev:
        render_no_show(dispute)
    elif "driver_submitted_photo" in ev:
        render_property_damage(dispute)
    elif "lost_item_report" in ev:
        render_lost_item(dispute)
    else:
        st.json(ev)


def run_review(dispute: dict) -> dict:
    case_id = dispute["id"]
    with st.status("Running agent review", expanded=True) as status:
        try:
            st.write("Running Rider Advocate...")
            rider_case = rider_advocate(dispute)
            if agent_failed(rider_case):
                status.update(label="Review failed during Rider Advocate", state="error", expanded=True)
                return {
                    "case_id": case_id,
                    "status": "failed",
                    "failed_stage": "Rider Advocate",
                    "error": rider_case,
                    "rider_case": rider_case,
                }

            st.write("Running Driver Advocate...")
            driver_case = driver_advocate(dispute)
            if agent_failed(driver_case):
                status.update(label="Review failed during Driver Advocate", state="error", expanded=True)
                return {
                    "case_id": case_id,
                    "status": "failed",
                    "failed_stage": "Driver Advocate",
                    "error": driver_case,
                    "rider_case": rider_case,
                    "driver_case": driver_case,
                }

            st.write("Running Judge Agent...")
            ruling = judge_ruling(rider_case, driver_case, dispute)
            if ruling_failed(ruling):
                explanation = ruling.get("explanation") if isinstance(ruling, dict) else str(ruling)
                status.update(label="Review failed during Judge Agent", state="error", expanded=True)
                return {
                    "case_id": case_id,
                    "status": "failed",
                    "failed_stage": "Judge Agent",
                    "error": explanation,
                    "rider_case": rider_case,
                    "driver_case": driver_case,
                    "ruling": ruling,
                }

            status.update(label="Review complete", state="complete", expanded=False)
            return {
                "case_id": case_id,
                "status": "complete",
                "rider_case": rider_case,
                "driver_case": driver_case,
                "ruling": ruling,
            }
        except Exception as exc:
            status.update(label="Review failed", state="error", expanded=True)
            return {
                "case_id": case_id,
                "status": "failed",
                "failed_stage": "Unexpected error",
                "error": str(exc),
            }


def render_advocate_panel(title: str, text: object) -> None:
    preview = compact_preview(text)
    st.markdown(
        f"""
        <div class="rv-preview">
            <div class="rv-section-title">{html.escape(title)}</div>
            <div class="rv-text">{as_html(preview)}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    with st.expander(f"View full {title.lower()} reasoning"):
        st.markdown(f'<div class="rv-text">{as_html(text)}</div>', unsafe_allow_html=True)


def render_review_results(result: dict | None, selected_case_id: int) -> None:
    if not result or result.get("case_id") != selected_case_id:
        st.markdown(
            """
            <div class="rv-notice">
                No review has been run for this case yet. Select <strong>Review case</strong> to run the existing agent workflow.
            </div>
            """,
            unsafe_allow_html=True,
        )
        return

    if result.get("status") == "failed":
        st.error(f"Review failed during {result.get('failed_stage', 'agent processing')}.")
        st.markdown(f"**Error details:** {result.get('error', 'Unknown error')}")
        if result.get("rider_case") or result.get("driver_case"):
            st.subheader("Partial agent output")
            cols = st.columns(2)
            with cols[0]:
                if result.get("rider_case"):
                    render_advocate_panel("Rider Advocate", result["rider_case"])
            with cols[1]:
                if result.get("driver_case"):
                    render_advocate_panel("Driver Advocate", result["driver_case"])
        return

    ruling = result["ruling"]
    if ruling.get("escalate"):
        st.warning("Human review required. The model-reported confidence is below the automated-resolution threshold.")
    else:
        st.info("Human-review escalation was not triggered by the current confidence rule.")

    st.markdown(
        f"""
        <div class="rv-card rv-judge-card">
            <div class="rv-kicker">Judge recommendation</div>
            <div class="rv-title">{html.escape(str(ruling.get('decision', 'N/A')))}</div>
            <p class="rv-text"><strong>Model-reported confidence (not verified accuracy):</strong> {html.escape(str(ruling.get('confidence', 'N/A')))}</p>
            <p class="rv-text"><strong>Explanation:</strong><br>{as_html(ruling.get('explanation', 'No explanation returned.'))}</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.subheader("Advocate reasoning")
    rider_col, driver_col = st.columns(2)
    with rider_col:
        render_advocate_panel("Rider Advocate", result["rider_case"])
    with driver_col:
        render_advocate_panel("Driver Advocate", result["driver_case"])


# ------------------------------------------------------------------------------
# Session state and selection
# ------------------------------------------------------------------------------
if "review_results" not in st.session_state:
    st.session_state.review_results = {}

st.sidebar.markdown("### ROGUE VECTOR")
st.sidebar.caption("Dispute-review operations dashboard")

case_labels = [case_option(dispute) for dispute in DISPUTES]
selected_label = st.sidebar.selectbox("Case", case_labels)
selected_dispute = DISPUTES[case_labels.index(selected_label)]
selected_case_id = selected_dispute["id"]

st.sidebar.divider()
st.sidebar.caption("All data is synthetic and for demonstration only.")


# ------------------------------------------------------------------------------
# Header and action
# ------------------------------------------------------------------------------
header_col, action_col = st.columns([4, 1.2], vertical_alignment="center")
with header_col:
    st.markdown(
        f"""
        <div class="rv-card rv-header-card">
            <div class="rv-kicker">Case #{selected_case_id}</div>
            <div class="rv-title">{html.escape(selected_dispute['title'])}</div>
            <div class="rv-text"><strong>Complaint summary:</strong> {as_html(selected_dispute['rider_complaint'])}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

with action_col:
    review_clicked = st.button("Review case", type="primary", width="stretch")
    st.caption("Runs the existing three-agent workflow.")

if review_clicked:
    st.session_state.review_results[selected_case_id] = run_review(selected_dispute)


# ------------------------------------------------------------------------------
# Results first after processing
# ------------------------------------------------------------------------------
st.subheader("Recommendation")
render_review_results(st.session_state.review_results.get(selected_case_id), selected_case_id)


# ------------------------------------------------------------------------------
# Evidence dashboard
# ------------------------------------------------------------------------------
st.subheader("Evidence review")
render_evidence(selected_dispute)


# ------------------------------------------------------------------------------
# Footer notice
# ------------------------------------------------------------------------------
st.divider()
st.caption("Synthetic-data notice: all disputes, profiles, routes, timestamps, and evidence are synthetic and for demonstration purposes only.")
