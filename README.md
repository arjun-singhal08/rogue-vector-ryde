# ROGUE VECTOR — Ryde Dispute Resolver

ROGUE VECTOR — Ryde Dispute Resolver is a Streamlit demo app that reviews synthetic ride-hailing dispute cases, presents the available trip evidence and user profiles, and uses Groq-backed agent prompts to generate both sides of the argument plus an impartial ruling. It is intended as a prototype for exploring explainable, evidence-grounded dispute resolution workflows.

## Agent workflow

- **Rider Advocate**: argues the rider's side using only the complaint and evidence in the selected case.
- **Driver Advocate**: argues the driver's side using only the same evidence plus relevant driver context.
- **Judge Agent**: weighs both arguments against the raw evidence, returns a decision, confidence score, explanation, and flags low-confidence rulings for human review.

The current sample disputes include route deviation and no-show charge scenarios, and additional synthetic dispute categories can be added in `data/sample_disputes.py`.

## Setup

1. Clone the repository:

   ```bash
   git clone <repo-url>
   cd rogue-vector-ryde
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Create a `.env` file in the project root and add your Groq API key:

   ```env
   GROQ_API_KEY=your_api_key_here
   ```

4. Run the Streamlit app:

   ```bash
   streamlit run app.py
   ```

## Data note

All disputes, profiles, routes, timestamps, and evidence shown in this project are synthetic and for demonstration purposes only.
