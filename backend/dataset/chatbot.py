# ═══════════════════════════════════════════════════════════
# CHATBOT UPGRADE — 4 new capabilities beyond forecast_event() wrapping
#
# Paste these as NEW cells after your existing Cell D (TrafficChatbot
# class). They extend the same class — nothing in Cell B/C/D needs to
# change, and your existing forecast/dataset-question behavior is
# untouched.
#
# What's new and WHY each one is a genuine upgrade, not just more code:
#
# 1. COMPARISON MODE
#    "Compare this rally vs last week's protest at MekhriCircle"
#    -> calls forecast_event() TWICE, diffs the real fields (officers,
#    score, clearance, affected corridor count), explains the delta.
#    A dashboard form can't do this — it only ever shows one forecast
#    at a time. This is the single most defensible "why do we need an
#    LLM at all" answer you can give judges.
#
# 2. PROACTIVE DAILY RISK BRIEFING
#    Bot can be asked (or scheduled) to scan TRAFFIC_CONTEXT and
#    volunteer top-3 highest-risk corridors/junctions for a given hour
#    window WITHOUT the user specifying a hypothetical event. Turns
#    the bot from reactive Q&A into something an ops desk would
#    actually open every morning.
#
# 3. RESOURCE-CONSTRAINED PLANNING
#    "I only have 6 officers available today, which 2 of these 3
#    events should I prioritize?" — ranks multiple real forecasts
#    against a hard resource cap. Genuinely different question type,
#    not covered by your existing DATASET_HINTS or forecast intent.
#
# 4. MULTILINGUAL / KANNADA SUPPORT
#    Same forecast_event() numbers, explanation text in Kannada
#    (or Kanglish) on request. The LLM never computes anything either
#    way, so this is purely a presentation-language switch — zero risk
#    to forecast accuracy.
# ═══════════════════════════════════════════════════════════


# ── CELL F: Language detection + comparison/resource intent hints ──

KANNADA_HINTS = [
    "kannada", "ಕನ್ನಡ", "kannadalli", "kannada nalli", "kannadda",
    "speak kannada", "in kannada", "respond in kannada",
]

COMPARISON_HINTS = [
    "compare", "vs", "versus", "difference between", "which is worse",
    "which is riskier", "better than", "compared to",
]

RESOURCE_PLANNING_HINTS = [
    "only have", "limited officers", "limited barricades", "prioritize",
    "which should i", "can't cover all", "not enough officers",
    "budget of", "available officers",
]

BRIEFING_HINTS = [
    "daily briefing", "today's risk", "todays risk", "morning briefing",
    "risk summary", "give me a briefing", "watch out for",
    "overview of risk", "risk overview", "briefing",
]


def _detect_language_request(text: str) -> str | None:
    """Returns 'kannada' if the user explicitly asked for it, else None.
    We only switch language on explicit request — never guess from script,
    since Bengaluru officers code-switch between English/Kannada/Kanglish
    constantly and guessing wrong is worse than just asking once."""
    t = text.lower()
    return "kannada" if any(h in t for h in KANNADA_HINTS) else None


def _looks_like_comparison(text: str) -> bool:
    t = text.lower()
    return any(h in t for h in COMPARISON_HINTS)


def _looks_like_resource_planning(text: str) -> bool:
    t = text.lower()
    return any(h in t for h in RESOURCE_PLANNING_HINTS)


def _looks_like_briefing_request(text: str) -> bool:
    t = text.lower()
    if any(h in t for h in BRIEFING_HINTS):
        return True
    # Broader fallback: officers phrase this many different ways
    # ("what's today's risk look like", "morning risk rundown", etc.)
    # so also match any time-word + risk-word combination anywhere in
    # the message rather than relying only on exact phrases above.
    time_words = ["today", "morning", "daily"]
    risk_words = ["risk", "briefing", "summary", "rundown", "overview"]
    return any(tw in t for tw in time_words) and any(rw in t for rw in risk_words)


# ── CELL G: Extraction tool for comparison & resource-planning calls ──
# Qwen needs to be able to propose MULTIPLE forecast_event() calls in one
# turn for comparison/resource questions. We give it a second tool that
# wraps a list of event specs, reusing the exact same parameter schema as
# FORECAST_TOOL so there's only one source of truth for valid arguments.

MULTI_FORECAST_TOOL = {
    "type": "function",
    "function": {
        "name": "forecast_multiple_events",
        "description": (
            "Run the traffic forecasting engine for TWO OR MORE events at "
            "once, for comparison or resource-prioritization questions. "
            "Each event uses the exact same fields as forecast_event."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "events": {
                    "type": "array",
                    "minItems": 2,
                    "items": FORECAST_TOOL["function"]["parameters"],
                    "description": "One entry per event being compared.",
                },
            },
            "required": ["events"],
        },
    },
}


# ── CELL H: Extend TrafficChatbot with the 4 new capabilities ──
# Monkey-patching the existing class keeps this a pure addition — your
# Cell D class definition doesn't need to be touched or duplicated.

def _run_multi_forecast(self, events: list) -> list:
    return [self._run_forecast(e) for e in events]


def _format_comparison(self, label_a: str, result_a: dict, label_b: str, result_b: dict) -> str:
    """Diffs two REAL forecast_event() outputs field by field. Every
    number here came from your trained models / rule engine — nothing
    is computed by the LLM, the LLM only narrates this table afterward."""
    def delta(a, b):
        d = round(b - a, 1)
        sign = "+" if d > 0 else ""
        return f"{sign}{d}"

    lines = [
        f"{'='*58}",
        "  SCENARIO COMPARISON",
        f"{'='*58}",
        f"  {'Metric':<22}{label_a:>15}{label_b:>15}{'Delta':>8}",
        f"  {'-'*58}",
        f"  {'Risk score':<22}{result_a['score']:>15}{result_b['score']:>15}{delta(result_a['score'], result_b['score']):>8}",
        f"  {'Risk level':<22}{result_a['risk']:>15}{result_b['risk']:>15}",
        f"  {'Clearance (min)':<22}{result_a['traffic_clearance_min']:>15}{result_b['traffic_clearance_min']:>15}"
        f"{delta(result_a['traffic_clearance_min'], result_b['traffic_clearance_min']):>8}",
        f"  {'Officers':<22}{result_a['officers']:>15}{result_b['officers']:>15}"
        f"{delta(result_a['officers'], result_b['officers']):>8}",
        f"  {'Barricades':<22}{result_a['barricades']:>15}{result_b['barricades']:>15}"
        f"{delta(result_a['barricades'], result_b['barricades']):>8}",
        f"  {'Roads affected':<22}{len(result_a['affected_corridors']):>15}{len(result_b['affected_corridors']):>15}",
        f"{'='*58}",
    ]
    return "\n".join(lines)


def chat_comparison(self, user_message: str) -> str:
    """Handles 'compare X vs Y' questions: forces Qwen to use
    MULTI_FORECAST_TOOL, runs forecast_event() once per scenario, builds
    a real diff table, then asks Qwen to narrate ONLY that diff table."""
    self.history.append({"role": "user", "content": user_message})
    messages = [{"role": "system", "content": SYSTEM_PROMPT}] + self.history

    response = self.client.chat.completions.create(
        model="qwen/qwen3-32b",
        messages=messages,
        temperature=0.3,
        max_tokens=1024,
        reasoning_format="hidden",
        tools=[MULTI_FORECAST_TOOL],
        tool_choice="required",
    )
    msg = response.choices[0].message

    if not msg.tool_calls:
        fallback = "I couldn't extract two comparable events from that — try naming both events explicitly, e.g. 'compare a rally with 5000 people vs a protest with 8000 people, both at MekhriCircle.'"
        self.history.append({"role": "assistant", "content": fallback})
        return fallback

    try:
        args = json.loads(msg.tool_calls[0].function.arguments)
        events = args["events"][:2]  # only ever compare 2 at a time for now
    except (json.JSONDecodeError, KeyError, IndexError):
        fallback = "I had trouble parsing the two events to compare — could you restate them one at a time?"
        self.history.append({"role": "assistant", "content": fallback})
        return fallback

    results = self._run_multi_forecast(events)
    label_a = events[0].get("event_type", "Scenario A").replace("_", " ").title()
    label_b = events[1].get("event_type", "Scenario B").replace("_", " ").title()
    diff_table = self._format_comparison(label_a, results[0], label_b, results[1])

    narration_prompt = (
        f"Here is a REAL side-by-side comparison from forecast_event() — "
        f"the only numbers you're allowed to use:\n```\n{diff_table}\n```\n\n"
        f"In 3 short sentences (plain text): state which scenario is riskier "
        f"and by how much, what the officer/barricade gap means operationally, "
        f"and one concrete recommendation."
    )
    explanation_resp = self.client.chat.completions.create(
        model="qwen/qwen3-32b",
        messages=[
            {"role": "system", "content": "You are a concise traffic operations advisor. Reply in exactly 3 sentences, plain text only, in the SAME language the user used in their last message." + self._language_instruction()},
            {"role": "user", "content": narration_prompt},
        ],
        temperature=0.3,
        max_tokens=300,
        reasoning_format="hidden",
    )
    explanation = explanation_resp.choices[0].message.content

    final = diff_table + "\n\n" + explanation
    self.history.append({"role": "assistant", "content": final})
    return final


def chat_resource_planning(self, user_message: str) -> str:
    """Handles 'I only have N officers, which events should I prioritize'
    questions. Runs forecast_event() for each event mentioned, ranks by
    score, and greedily allocates against the stated officer cap — pure
    arithmetic on REAL model outputs, no LLM guessing of priority."""
    self.history.append({"role": "user", "content": user_message})
    messages = [{"role": "system", "content": SYSTEM_PROMPT}] + self.history

    response = self.client.chat.completions.create(
        model="qwen/qwen3-32b",
        messages=messages,
        temperature=0.3,
        max_tokens=1024,
        reasoning_format="hidden",
        tools=[MULTI_FORECAST_TOOL],
        tool_choice="required",
    )
    msg = response.choices[0].message

    if not msg.tool_calls:
        fallback = "Tell me the events you're choosing between (type, crowd size, location) and how many officers/barricades you have available."
        self.history.append({"role": "assistant", "content": fallback})
        return fallback

    try:
        args = json.loads(msg.tool_calls[0].function.arguments)
        events = args["events"]
    except (json.JSONDecodeError, KeyError):
        fallback = "I had trouble parsing the events — could you list them one at a time?"
        self.history.append({"role": "assistant", "content": fallback})
        return fallback

    # Extract the officer cap from the user's own message via a tiny
    # regex on digits near "officer" — falls back to None (no cap shown)
    # if not found, rather than guessing a number.
    cap_match = re.search(r"(\d+)\s*officers?", user_message, re.IGNORECASE)
    officer_cap = int(cap_match.group(1)) if cap_match else None

    results = self._run_multi_forecast(events)
    labeled = [
        {"label": e.get("event_type", f"Event {i+1}").replace("_", " ").title(), **r}
        for i, (e, r) in enumerate(zip(events, results))
    ]
    # Rank by risk score, highest first — greedy allocation against cap
    labeled.sort(key=lambda x: x["score"], reverse=True)

    lines = [f"{'='*58}", "  RESOURCE-CONSTRAINED PRIORITIZATION", f"{'='*58}"]
    if officer_cap:
        lines.append(f"  Officer budget: {officer_cap}")
    lines.append("")

    running_total = 0
    for rank, ev in enumerate(labeled, 1):
        running_total += ev["officers"]
        fits = "FITS BUDGET" if (officer_cap is None or running_total <= officer_cap) else "OVER BUDGET"
        lines.append(
            f"  #{rank} {ev['label']:<20} score={ev['score']:<6} "
            f"officers={ev['officers']:<4} running_total={running_total:<5} [{fits}]"
        )
    lines.append(f"{'='*58}")
    plan_table = "\n".join(lines)

    narration_prompt = (
        f"Here is a REAL resource-prioritization table — the only numbers "
        f"you're allowed to use:\n```\n{plan_table}\n```\n\n"
        f"In 3 short sentences (plain text): say which event(s) should get "
        f"officers first and why, which (if any) won't fit the budget, and "
        f"one mitigation for whichever event gets deprioritized."
    )
    explanation_resp = self.client.chat.completions.create(
        model="qwen/qwen3-32b",
        messages=[
            {"role": "system", "content": "You are a concise traffic operations advisor. Reply in exactly 3 sentences, plain text only, in the SAME language the user used in their last message." + self._language_instruction()},
            {"role": "user", "content": narration_prompt},
        ],
        temperature=0.3,
        max_tokens=300,
        reasoning_format="hidden",
    )
    explanation = explanation_resp.choices[0].message.content

    final = plan_table + "\n\n" + explanation
    self.history.append({"role": "assistant", "content": final})
    return final


def chat_briefing(self, hour_window: tuple[int, int] | None = None) -> str:
    """Proactive daily risk briefing — no hypothetical event needed.
    Pulls top-3 highest-risk corridors/junctions directly from
    TRAFFIC_CONTEXT (already sorted descending) and the temporal
    multiplier for the requested hour window, then asks Qwen to phrase
    it as a short morning briefing. Pure data lookup, zero forecasting,
    so this is instant and free of any model uncertainty."""
    top_corridors = list(TRAFFIC_CONTEXT["top_corridors"].items())[:3]
    top_junctions = list(TRAFFIC_CONTEXT["top_junctions"].items())[:3]
    peak_hours = TRAFFIC_CONTEXT["peak_hours"]

    window_note = ""
    if hour_window:
        start, end = hour_window
        hours_in_window = [h for h in range(start, end + 1) if h in peak_hours]
        window_note = f"\nRequested window {start}:00-{end}:00 overlaps peak hours: {hours_in_window or 'none'}"

    briefing_data = (
        f"Top 3 highest-risk corridors today: {top_corridors}\n"
        f"Top 3 highest-risk junctions today: {top_junctions}\n"
        f"City-wide peak risk hours: {peak_hours}"
        f"{window_note}"
    )

    prompt = (
        f"Using ONLY this real historical risk data:\n{briefing_data}\n\n"
        f"Write a 4-line morning briefing for a traffic control room duty "
        f"officer. Line 1: greeting + date context. Line 2: top risk "
        f"corridors to watch. Line 3: top risk junctions. Line 4: peak "
        f"hours to pre-position resources. Plain text, no markdown."
    )
    response = self.client.chat.completions.create(
        model="qwen/qwen3-32b",
        messages=[
            {"role": "system", "content": "You are a traffic control room briefing assistant. Be direct and operational." + self._language_instruction()},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=300,
        reasoning_format="hidden",
    )
    briefing = response.choices[0].message.content
    self.history.append({"role": "assistant", "content": briefing})
    return briefing


def chat_v2(self, user_message: str) -> str:
    """
    Drop-in replacement for .chat() that routes to the 4 new capabilities
    BEFORE falling back to your existing forecast/dataset logic. Call
    this instead of .chat() to get all upgrades; .chat() itself is left
    untouched so nothing breaks if you still call it directly somewhere.
    """
    lang = _detect_language_request(user_message)
    if lang == "kannada":
        self._force_kannada = True  # sticky for the rest of the session
        confirm = (
            "Sari, ee mele ella forecast explanations Kannada-nalli "
            "kodthini. (Got it — I'll explain forecasts in Kannada from "
            "now on. The numbers themselves never change, only the "
            "language of the explanation.)"
        )
        self.history.append({"role": "assistant", "content": confirm})
        return confirm

    if _looks_like_briefing_request(user_message):
        return self.chat_briefing()

    if _looks_like_comparison(user_message):
        return self.chat_comparison(user_message)

    if _looks_like_resource_planning(user_message):
        return self.chat_resource_planning(user_message)

    # Fall back to your existing single-forecast / dataset-question logic
    return self.chat(user_message)


def _language_instruction(self) -> str:
    """Appended to every narration system prompt when Kannada mode is on.
    Kept separate from SYSTEM_PROMPT itself so the big TRAFFIC_CONTEXT
    block never needs to be re-sent in Kannada — only the FINAL
    explanation text changes language, the tool-calling / extraction
    step always stays in English since event_type enum values, corridor
    names etc. must match the dataset exactly regardless of input
    language."""
    if getattr(self, "_force_kannada", False):
        return (
            " Respond in Kannada (ಕನ್ನಡ script), written naturally as a "
            "Bengaluru traffic officer would read it. Keep numbers, "
            "corridor names, and junction names in their original "
            "English/Latin form since those must match dataset records "
            "exactly — only the surrounding sentences should be Kannada."
        )
    return ""


TrafficChatbot._language_instruction = _language_instruction


# Attach all new methods to the existing class without redefining it
TrafficChatbot._run_multi_forecast = _run_multi_forecast
TrafficChatbot._format_comparison = _format_comparison
TrafficChatbot.chat_comparison = chat_comparison
TrafficChatbot.chat_resource_planning = chat_resource_planning
TrafficChatbot.chat_briefing = chat_briefing
TrafficChatbot.chat_v2 = chat_v2

print("Chatbot upgraded: comparison mode, resource planning, daily")
print("briefing, and Kannada-on-request are now available via .chat_v2()")