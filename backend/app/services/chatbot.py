import os
import json
import re
import ast
import inspect
from groq import Groq
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

from app.services.traffic_engine import (
    df,
    corridor_risk_lookup,
    junction_risk_lookup,
    severity_map,
    forecast_event
)

# Build context dict from existing lookups
hour_risk        = df.groupby("event_hour")["road_closure"].mean()
temporal_mult    = (hour_risk / hour_risk.mean()).round(3).to_dict()
data_peak_hours  = hour_risk[hour_risk > hour_risk.quantile(0.75)].index.tolist()

df["closed_datetime"] = pd.to_datetime(
    df["closed_datetime"], format="mixed", utc=True, errors="coerce"
)
_closed = df[df["closed_datetime"].notna()].copy()
_closed["resolution_hours"] = (
    (_closed["closed_datetime"] - _closed["start_datetime"]).dt.total_seconds() / 3600
)
_closed = _closed[(_closed["resolution_hours"] > 0) & (_closed["resolution_hours"] < 500)]
resolution_times = _closed.groupby("event_cause")["resolution_hours"].median().round(1).to_dict()

zone_summary = df.groupby("zone").agg(
    total=("id", "count"),
    closures=("road_closure", "sum"),
    high_priority=("priority", lambda x: (x == "High").mean())
)
zone_summary["closure_rate"]    = zone_summary["closures"] / zone_summary["total"]
zone_summary["zone_risk_score"] = (
    0.6 * zone_summary["closure_rate"] + 0.4 * zone_summary["high_priority"]
).round(3)

zone_risk_sorted     = zone_summary["zone_risk_score"].sort_values(ascending=False).round(3).to_dict()
zone_closures_sorted = zone_summary["closures"].sort_values(ascending=False).to_dict()

TRAFFIC_CONTEXT = {
    "top_corridors": {
        k: round(v, 3)
        for k, v in list(corridor_risk_lookup.items())[:20]
        if k != "Non-corridor"
    },
    "top_junctions": {
        k: round(v, 3)
        for k, v in list(junction_risk_lookup.items())[:20]
        if str(k) != "nan"
    },
    "zone_risk_scores_sorted_desc":    zone_risk_sorted,
    "zone_closure_counts_sorted_desc": zone_closures_sorted,
    "temporal_multiplier_by_hour":     {str(k): v for k, v in temporal_mult.items()},
    "peak_hours":                      data_peak_hours,
    "resolution_hours_by_cause":       resolution_times,
    "severity_map":                    severity_map,
}

EVENT_TYPES = [
    "vehicle_breakdown", "pot_holes", "road_conditions", "water_logging",
    "accident", "construction", "public_event", "procession",
    "political_rally", "vip_movement", "protest",
]

FORECAST_TOOL = {
    "type": "function",
    "function": {
        "name": "forecast_event",
        "description": (
            "Run the traffic forecasting engine for a real or hypothetical "
            "road event in Bengaluru and return the predicted congestion "
            "score, risk level, clearance delay, officers required, "
            "barricades required, diversion routes and affected corridors."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "event_type": {"type": "string", "enum": EVENT_TYPES},
                "attendance": {
                    "type": "integer",
                    "description": "Crowd size. Use 0 for non-crowd events "
                                    "(accident, pot_holes, etc). Use 1000 if "
                                    "a crowd event has no stated attendance.",
                },
                "duration_hours": {"type": "number", "description": "Default 2 if unknown."},
                "corridor": {
                    "type": "string",
                    "description": "Match to a name in top_corridors if possible, "
                                    "else 'Mysore Road'.",
                },
                "junction": {
                    "type": "string",
                    "description": "Match to a name in top_junctions if possible, "
                                    "else 'MekhriCircle'.",
                },
                "road_closure": {"type": "boolean", "description": "Default false."},
                "start_hour": {
                    "type": "integer",
                    "description": "24h clock, e.g. 18 for 6pm. Default 12 if unknown.",
                },
            },
            "required": ["event_type"],
        },
    },
}

SYSTEM_PROMPT = f"""You are an AI traffic-management assistant for Bengaluru city police.

You have access to historical risk data derived from 8,173 real Bengaluru
traffic events:

{json.dumps(TRAFFIC_CONTEXT, indent=2)}

When choosing event_type, match the user's wording to these categories
EXACTLY — do not default to "public_event" unless none of these apply:
- "rally", "political rally", "party event"        -> political_rally
- "protest", "demonstration", "strike", "bandh"     -> protest
- "VIP", "minister", "convoy", "security movement"  -> vip_movement
- "procession", "yatra", "parade", "march"          -> procession
- "construction", "roadwork", "digging"             -> construction
- "accident", "collision", "crash"                  -> accident
- "water logging", "flooding"                       -> water_logging
- "pothole"                                         -> pot_holes
- "vehicle breakdown", "stalled vehicle"             -> vehicle_breakdown
- "road conditions", "surface damage"               -> road_conditions
- "festival", "concert", "fair", "exhibition", or any
  crowd gathering that doesn't match the above      -> public_event

You can handle five kinds of questions:
1. Questions about historical risk scores (which zones/corridors/junctions are highest risk, etc.)
2. Questions about peak congestion hours or typical clearance times by event type.
3. Questions predicting the impact of a specific planned or hypothetical event.
4. General traffic inquiries or route recommendations.
5. Operational queries asking what operators should do, how to respond, or for recommended action plans. For these, use the "strategy" section in the forecast output to state the recommended actions, priority level, deployment plan, and expected delay reduction.
"""

FORECAST_CALL_RE = re.compile(r"forecast_event\s*\((.*?)\)", re.DOTALL)

DATASET_HINTS = [
    "which corridor", "which zone", "which junction", "highest risk",
    "most closures", "average", "resolution time", "peak hour", "historical",
]

FORECAST_PARAM_ORDER = list(inspect.signature(forecast_event).parameters.keys())

KANNADA_HINTS = [
    "kannada", "ಕನ್ನಡ", "kannadalli", "kannada nalli", "kannadda",
    "speak kannada", "in kannada", "respond in kannada",
]

COMPARISON_HINTS = [
    "compare", "vs", "versus", "difference between", "which is worse",
    "which is riskier", "better than", "compared to", "more important than",
    "more critical than", "higher risk than", "worse than", "is that more",
    "is it more", "than this", "than the current", "than the active",
    "than the dashboard", "comparison", "priority between", "prioritize between",
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
    time_words = ["today", "morning", "daily"]
    risk_words = ["risk", "briefing", "summary", "rundown", "overview"]
    return any(tw in t for tw in time_words) and any(rw in t for rw in risk_words)

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

class TrafficChatbot:
    def __init__(self, api_key: str):
        self.client = None
        self.history = []
        self._force_kannada = False
        self.active_simulation = None
        if api_key:
            try:
                self.client = Groq(api_key=api_key)
            except Exception as e:
                print(f"Error initializing Groq client: {e}")

    def set_active_simulation(self, simulation_data: dict):
        self.active_simulation = simulation_data

    def _call_llm(self, messages, use_tools: bool, force: bool = False, multiple: bool = False):
        kwargs = dict(
            model="llama-3.1-8b-instant",
            messages=messages,
            temperature=0.3,
            max_tokens=1024,
        )
        if use_tools:
            kwargs["tools"] = [MULTI_FORECAST_TOOL] if multiple else [FORECAST_TOOL]
            kwargs["tool_choice"] = "required" if force else "auto"
        return self.client.chat.completions.create(**kwargs)

    def _params_from_tool_call(self, msg) -> dict | None:
        if not msg.tool_calls:
            return None
        try:
            return json.loads(msg.tool_calls[0].function.arguments)
        except (json.JSONDecodeError, IndexError):
            return None

    def _params_from_text_call(self, text: str) -> dict | None:
        match = FORECAST_CALL_RE.search(text or "")
        if not match:
            return None
        try:
            tree = ast.parse(f"forecast_event({match.group(1)})", mode="eval")
            call_node = tree.body
            if not isinstance(call_node, ast.Call):
                return None

            args = {}
            for name, node in zip(FORECAST_PARAM_ORDER, call_node.args):
                args[name] = ast.literal_eval(node)
            for kw in call_node.keywords:
                if kw.arg is not None:
                    args[kw.arg] = ast.literal_eval(kw.value)
            return args or None
        except Exception:
            return None

    def _looks_like_dataset_question(self, text: str) -> bool:
        t = text.lower()
        return any(h in t for h in DATASET_HINTS)

    def _run_forecast(self, args: dict) -> dict:
        result = forecast_event(
            event_type     = args.get("event_type", "public_event"),
            attendance     = int(args.get("attendance", 0)),
            duration_hours = float(args.get("duration_hours", 2)),
            corridor       = args.get("corridor", "Mysore Road"),
            junction       = args.get("junction", "MekhriCircle"),
            road_closure   = bool(args.get("road_closure", False)),
            start_hour     = int(args.get("start_hour", 12)),
        )
        from app.services.advisor import generate_strategy
        result["strategy"] = generate_strategy(result)
        return result

    def _run_multi_forecast(self, events: list) -> list:
        return [self._run_forecast(e) for e in events]

    def _format_result(self, result: dict) -> str:
        event_name = result.get('event_type', '').replace('_', ' ').title()
        risk_level = result.get('risk', 'Unknown')
        score = int(round(result.get('score', 0)))
        clearance_time = result.get('traffic_clearance_min', 0)
        officers = result.get('officers', 0)
        barricades = result.get('barricades', 0)
        
        corridors = [c.get('corridor') for c in result.get('affected_corridors', []) if c.get('corridor')]
        corridor_bullets = "\n".join([f"• {c}" for c in corridors]) if corridors else "• None"
        
        output = f"""🚨 EVENT IMPACT FORECAST

Event
{event_name}

Risk
{risk_level} ({score}/100)

Clearance Time
{clearance_time} min

Resources
{officers} Officers
{barricades} Barricades

Affected Corridors
{corridor_bullets}"""
        return output

    def _format_comparison(self, label_a: str, result_a: dict, label_b: str, result_b: dict) -> str:
        def delta(a, b):
            d = round(b - a, 1)
            sign = "+" if d > 0 else ""
            return f"{sign}{d}"

        lines = [
            "### 📊 Scenario Comparison",
            "",
            f"| Metric | {label_a} | {label_b} | Delta |",
            "| :--- | :---: | :---: | :---: |",
            f"| **Risk Score** | {result_a['score']} | {result_b['score']} | {delta(result_a['score'], result_b['score'])} |",
            f"| **Risk Level** | {result_a['risk']} | {result_b['risk']} | — |",
            f"| **Clearance (min)** | {result_a['traffic_clearance_min']} | {result_b['traffic_clearance_min']} | {delta(result_a['traffic_clearance_min'], result_b['traffic_clearance_min'])} |",
            f"| **Officers** | {result_a['officers']} | {result_b['officers']} | {delta(result_a['officers'], result_b['officers'])} |",
            f"| **Barricades** | {result_a['barricades']} | {result_b['barricades']} | {delta(result_a['barricades'], result_b['barricades'])} |",
            f"| **Roads Affected** | {len(result_a['affected_corridors'])} | {len(result_b['affected_corridors'])} | {delta(len(result_a['affected_corridors']), len(result_b['affected_corridors']))} |",
        ]
        return "\n".join(lines)

    def _language_instruction(self) -> str:
        if getattr(self, "_force_kannada", False):
            return (
                " Respond in Kannada (ಕನ್ನಡ script), written naturally as a "
                "Bengaluru traffic officer would read it. Keep numbers, "
                "corridor names, and junction names in their original "
                "English/Latin form since those must match dataset records "
                "exactly — only the surrounding sentences should be Kannada."
            )
        return ""

    def chat_comparison(self, user_message: str) -> str:
        if not self.client:
            return "Groq client is not initialized."
        self.history.append({"role": "user", "content": user_message})
        
        system_content = SYSTEM_PROMPT
        if self.active_simulation:
            system_content += f"\n\nACTIVE DASHBOARD SIMULATION RESULT:\n"
            system_content += f"```json\n{json.dumps(self.active_simulation, indent=2)}\n```\n"
            system_content += (
                "\nCRITICAL: The user has currently run the above simulation on their dashboard. "
                "If the user is asking to compare a new scenario or event to 'this', 'the active event', "
                "'the current event', or 'the dashboard', you must call `forecast_multiple_events` with "
                "two events in the 'events' array: "
                "1. The active simulation reconstructed using its parameters (event_type, attendance, corridor, junction, road_closure, start_hour, duration_hours). "
                "2. The new scenario/event from the user's message."
            )
        messages = [{"role": "system", "content": system_content}] + self.history

        try:
            response = self._call_llm(messages, use_tools=True, multiple=True)
            msg = response.choices[0].message
        except Exception as e:
            return f"Error calling LLM: {e}"

        if not msg.tool_calls:
            fallback = "I couldn't extract two comparable events from that — try naming both events explicitly, e.g. 'compare a political rally with 5000 people at Mysore Road vs a protest at MekhriCircle.'"
            self.history.append({"role": "assistant", "content": fallback})
            return fallback

        try:
            args = json.loads(msg.tool_calls[0].function.arguments)
            events = args["events"][:2]
        except (json.JSONDecodeError, KeyError, IndexError):
            fallback = "I had trouble parsing the two events to compare — could you restate them one at a time?"
            self.history.append({"role": "assistant", "content": fallback})
            return fallback

        results = self._run_multi_forecast(events)
        formatted_a = self._format_result(results[0]).replace("🚨 EVENT IMPACT FORECAST", "🚨 EVENT IMPACT FORECAST (SCENARIO A)")
        formatted_b = self._format_result(results[1]).replace("🚨 EVENT IMPACT FORECAST", "🚨 EVENT IMPACT FORECAST (SCENARIO B)")
        
        label_a = events[0].get("event_type", "Scenario A").replace("_", " ").title()
        label_b = events[1].get("event_type", "Scenario B").replace("_", " ").title()
        diff_table = self._format_comparison(label_a, results[0], label_b, results[1])

        narration_prompt = (
            f"Here is a side-by-side comparison from forecast_event():\n"
            f"Scenario A data:\n```json\n{json.dumps(results[0], indent=2)}\n```\n\n"
            f"Scenario B data:\n```json\n{json.dumps(results[1], indent=2)}\n```\n\n"
            "Please write a highly concise, to-the-point operations comparison. "
            "Avoid wordiness and keep descriptions extremely short. "
            "Use clear, single-sentence bullet points to compare Scenario A and B under each heading. "
            "Provide solid operational justification for your answers based on the metrics. "
            "Address these five areas explicitly:\n"
            "1. **Explainable Delay Prediction**: Compare delay calculations/breakdowns between the two (from `delay_breakdown` field).\n"
            "2. **Historical Evidence for Corridor Selection**: Compare corridor/junction selections using historical risk levels or closure rates.\n"
            "3. **AI Confidence Scores**: Compare prediction confidence percentages (ML risk confidence or ML closure probability).\n"
            "4. **Command-Center Recommendations**: Differentiate operational priorities, recommended actions, and expected improvements.\n"
            "5. **Resource Planning**: Differentiate resource budgets/deployments between the two scenarios."
        )
        try:
            explanation_resp = self.client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": "You are a highly concise traffic operations advisor. Respond directly and briefly with minimal wordiness. Keep the description under each section to 1 or 2 concise bullet points at most, in the SAME language the user used in their last message." + self._language_instruction()},
                    {"role": "user", "content": narration_prompt},
                ],
                temperature=0.3,
                max_tokens=600,
            )
            explanation = explanation_resp.choices[0].message.content
        except Exception as e:
            explanation = f"Error generating comparison explanation: {e}"

        final = f"{formatted_a}\n\n{formatted_b}\n\n{diff_table}\n\n{explanation}"
        self.history.append({"role": "assistant", "content": final})
        return final

    def chat_resource_planning(self, user_message: str) -> str:
        if not self.client:
            return "Groq client is not initialized."
        self.history.append({"role": "user", "content": user_message})
        
        system_content = SYSTEM_PROMPT
        if self.active_simulation:
            system_content += f"\n\nACTIVE DASHBOARD SIMULATION RESULT:\n"
            system_content += f"```json\n{json.dumps(self.active_simulation, indent=2)}\n```\n"
        messages = [{"role": "system", "content": system_content}] + self.history

        try:
            response = self._call_llm(messages, use_tools=True, multiple=True)
            msg = response.choices[0].message
        except Exception as e:
            return f"Error calling LLM: {e}"

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

        cap_match = re.search(r"(\d+)\s*officers?", user_message, re.IGNORECASE)
        officer_cap = int(cap_match.group(1)) if cap_match else None
        
        barricade_match = re.search(r"(\d+)\s*barricades?", user_message, re.IGNORECASE)
        barricade_cap = int(barricade_match.group(1)) if barricade_match else None

        results = self._run_multi_forecast(events)
        
        formatted_events = []
        for idx, res in enumerate(results, 1):
            formatted_event = self._format_result(res).replace("🚨 EVENT IMPACT FORECAST", f"🚨 EVENT IMPACT FORECAST (EVENT #{idx})")
            formatted_events.append(formatted_event)

        labeled = [
            {"label": e.get("event_type", f"Event {i+1}").replace("_", " ").title(), **r}
            for i, (e, r) in enumerate(zip(events, results))
        ]
        # Rank by risk score, highest first — greedy allocation against cap
        labeled.sort(key=lambda x: x["score"], reverse=True)

        lines = [
            "### ⚖️ Resource-Constrained Prioritization",
            ""
        ]
        if officer_cap or barricade_cap:
            budget_notes = []
            if officer_cap:
                budget_notes.append(f"**Officer Budget**: {officer_cap}")
            if barricade_cap:
                budget_notes.append(f"**Barricade Budget**: {barricade_cap}")
            lines.append(" &middot; ".join(budget_notes))
            lines.append("")

        lines.extend([
            "| Rank | Event | Risk Score | Officers | Barricades | Status |",
            "| :---: | :--- | :---: | :---: | :---: | :---: |"
        ])

        running_officers = 0
        running_barricades = 0
        for rank, ev in enumerate(labeled, 1):
            running_officers += ev["officers"]
            running_barricades += ev["barricades"]
            
            fits_officers = (officer_cap is None or running_officers <= officer_cap)
            fits_barricades = (barricade_cap is None or running_barricades <= barricade_cap)
            fits = "🟢 Fits Budget" if (fits_officers and fits_barricades) else "🔴 Over Budget"
            
            lines.append(
                f"| #{rank} | {ev['label']} | {ev['score']} | {ev['officers']} | {ev['barricades']} | {fits} |"
            )
        plan_table = "\n".join(lines)

        narration_prompt = (
            f"Here is a resource-constrained prioritization table:\n```\n{plan_table}\n```\n\n"
            f"Event details:\n```json\n{json.dumps(results, indent=2)}\n```\n\n"
            "Please write a highly concise, to-the-point resource planning explanation. "
            "Avoid wordiness and keep descriptions extremely short. "
            "Use clear, single-sentence bullet points for each heading. "
            "Provide solid operational justification based on the table and metrics. "
            "Address these five areas explicitly:\n"
            "1. **Resource-Constrained Planning**: Explain prioritization and budget fit (which events fit vs exceed limits).\n"
            "2. **Explainable Delay Prediction**: Briefly detail the delay breakdown for the top-priority event (from `delay_breakdown` field).\n"
            "3. **Historical Evidence for Corridor Selection**: Explain corridor selections using historical risk levels/closure rates.\n"
            "4. **AI Confidence Scores**: State prediction confidence percentages.\n"
            "5. **Command-Center Recommendations**: Detail recommended actions, priorities, and expected delay reductions."
        )
        try:
            explanation_resp = self.client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": "You are a highly concise traffic operations advisor. Respond directly and briefly with minimal wordiness. Keep the description under each section to 1 or 2 concise bullet points at most, in the SAME language the user used in their last message." + self._language_instruction()},
                    {"role": "user", "content": narration_prompt},
                ],
                temperature=0.3,
                max_tokens=600,
            )
            explanation = explanation_resp.choices[0].message.content
        except Exception as e:
            explanation = f"Error generating resource explanation: {e}"

        formatted_events_str = "\n\n".join(formatted_events)
        final = f"{formatted_events_str}\n\n{plan_table}\n\n{explanation}"
        self.history.append({"role": "assistant", "content": final})
        return final

    def chat_briefing(self, hour_window: tuple[int, int] | None = None) -> str:
        if not self.client:
            return "Groq client is not initialized."
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
        try:
            response = self.client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": "You are a traffic control room briefing assistant. Be direct and operational." + self._language_instruction()},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                max_tokens=300,
            )
            briefing = response.choices[0].message.content
        except Exception as e:
            briefing = f"Error generating briefing: {e}"
        self.history.append({"role": "assistant", "content": briefing})
        return briefing

    def _refers_to_active_simulation(self, text: str) -> bool:
        if not self.active_simulation:
            return False
        t = text.lower()
        new_event_keywords = [
            "rally", "protest", "procession", "vip", "construction", 
            "accident", "breakdown", "water logging", "pothole"
        ]
        active_type = self.active_simulation.get("event_type", "").lower().replace("_", " ")
        for k in new_event_keywords:
            if k in t and k not in active_type:
                return False
                
        indicators = [
            "this", "current", "dashboard", "active", "simulation", 
            "shown", "display", "now", "here", "above", "result", "forecast",
            "officer", "barricade", "delay", "corridor", "recommendation",
            "priority", "action", "strategy", "clearance"
        ]
        return any(ind in t for ind in indicators)

    def _chat_single(self, user_message: str) -> str:
        print("ACTIVE SIMULATION STATE:", self.active_simulation)
        self.history.append({"role": "user", "content": user_message})
        
        system_content = SYSTEM_PROMPT
        if self.active_simulation:
            system_content += f"\n\nACTIVE DASHBOARD SIMULATION RESULT:\n"
            system_content += f"```json\n{json.dumps(self.active_simulation, indent=2)}\n```\n"
            system_content += (
                "\nCRITICAL: The user has currently run the above simulation on their dashboard. "
                "If the user asks questions referring to 'this event', 'the simulation', 'the dashboard forecast', "
                "or asks about officers, barricades, delays, or corridors for the active scenario, "
                "you MUST answer using these exact numbers. DO NOT propose a new tool call to `forecast_event` "
                "unless they ask for a new, different hypothetical scenario. Answer their questions directly "
                "based on the active dashboard simulation data."
            )

        messages = [{"role": "system", "content": system_content}] + self.history
        print("MESSAGES SENT TO LLM:", json.dumps(messages, indent=2))

        use_tools = True
        if self._refers_to_active_simulation(user_message):
            use_tools = False

        try:
            response = self._call_llm(messages, use_tools=use_tools)
            msg = response.choices[0].message
        except Exception as e:
            print(f"Error calling LLM: {e}")
            try:
                kwargs = dict(
                    model="llama-3.1-8b-instant",
                    messages=messages,
                    temperature=0.3,
                    max_tokens=1024,
                )
                response = self.client.chat.completions.create(**kwargs)
                msg = response.choices[0].message
            except Exception as inner_e:
                return f"Sorry, I encountered an API error: {inner_e}"

        params = None
        if use_tools:
            params = self._params_from_tool_call(msg) or self._params_from_text_call(msg.content or "")

            if params is None and not self._looks_like_dataset_question(user_message):
                try:
                    response = self._call_llm(messages, use_tools=True, force=True)
                    msg = response.choices[0].message
                    params = self._params_from_tool_call(msg) or self._params_from_text_call(msg.content or "")
                except Exception:
                    pass

        if params is not None:
            result = self._run_forecast(params)
            formatted = self._format_result(result)

            self.history.append({"role": "assistant", "content": ""})
            
            explanation_prompt = (
                "Here is the REAL forecast_event() output — the only numbers you're allowed to use:\n"
                f"```json\n{json.dumps(result, indent=2)}\n```\n\n"
                "Please write a highly concise, to-the-point operations briefing. "
                "Avoid wordiness and keep descriptions extremely short. "
                "Use clear, single-sentence bullet points for each heading. "
                "Provide solid operational justification based on the metrics. "
                "Address these five areas explicitly:\n"
                "1. **Explainable Delay Prediction**: Explain how the delay is calculated and broken down (from `delay_breakdown` field).\n"
                "2. **Historical Evidence for Corridor Selection**: Explain why this corridor and adjacent corridors were selected using historical risk levels/closure rates.\n"
                "3. **AI Confidence Scores**: State the prediction confidence percentage and its reliability.\n"
                "4. **Command-Center Recommendations**: Outline the priority level, actions, deployment, and expected improvement.\n"
                "5. **Resource Planning**: Provide brief insights on resource numbers compared to standard deployments."
            )

            self.history.append({
                "role": "user",
                "content": explanation_prompt,
            })

            try:
                concise_system = (
                    "You are a highly concise traffic operations advisor. Respond directly and briefly with minimal wordiness. "
                    "Keep the description under each section to 1 or 2 concise bullet points at most.\n\n"
                ) + system_content + self._language_instruction()
                explanation_resp = self._call_llm(
                    [{"role": "system", "content": concise_system}] + self.history,
                    use_tools=False,
                )
                explanation = explanation_resp.choices[0].message.content
            except Exception as e:
                explanation = f"Calculations completed successfully. Please check the summary block above. Error details: {e}"

            if len(self.history) >= 2:
                self.history.pop()
                self.history.pop()
            self.history.append({"role": "assistant", "content": json.dumps(params)})
            self.history.append({"role": "assistant", "content": explanation})

            return formatted + "\n\n" + explanation

        else:
            content = msg.content or "No response from model."
            self.history.append({"role": "assistant", "content": content})
            return content

    def chat(self, user_message: str) -> str:
        if not self.client:
            return "Sorry, the chatbot service is currently unavailable because the Groq API key is not configured. Please set GROQ_API_KEY in your .env file."
        
        lang = _detect_language_request(user_message)
        if lang == "kannada":
            self._force_kannada = True
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

        return self._chat_single(user_message)

    def reset(self):
        self.history = []
        self._force_kannada = False

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
bot = TrafficChatbot(api_key=GROQ_API_KEY)
