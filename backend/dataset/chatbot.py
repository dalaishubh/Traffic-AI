

import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
# ── CELL B: Build context dict from existing lookups ────
# Everything here already exists in your notebook —
# we just pack it into one dict to pass to the LLM

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

# Sorted so the FIRST item is always the highest — the chatbot can just
# read off index 0 instead of guessing.
zone_risk_sorted     = zone_summary["zone_risk_score"].sort_values(ascending=False).round(3).to_dict()
zone_closures_sorted = zone_summary["closures"].sort_values(ascending=False).to_dict()

# corridor_risk_lookup / junction_risk_lookup were already built sorted
# descending earlier in the notebook (cells 3 & 4), so top_corridors /
# top_junctions below are already "highest risk first".
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

print(f"Context built — {len(json.dumps(TRAFFIC_CONTEXT)) // 4} tokens (approx)")
print("Peak hours:", data_peak_hours)
# ── CELL C: System prompt + tool schema ──────────────────
# Instead of asking Qwen to hand-write a JSON block (which we then had to
# regex out of free text — fragile, and easy to break), we give Qwen a
# proper *tool*. Qwen decides WHEN to call forecast_event() and WITH WHAT
# arguments. We run the real Python function ourselves and hand the
# result back to Qwen, whose only job at that point is to explain it.

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

You can handle four kinds of questions:
...
"""
# ── CELL D: Chatbot class ────────────────────────────────
import re
import ast
import inspect

FORECAST_CALL_RE = re.compile(r"forecast_event\s*\((.*?)\)", re.DOTALL)

DATASET_HINTS = [
    "which corridor", "which zone", "which junction", "highest risk",
    "most closures", "average", "resolution time", "peak hour", "historical",
]

# Real parameter order of forecast_event(), used to correctly map
# POSITIONAL arguments if Qwen writes the call that way instead of using
# keyword args. Without this, positional calls like
# forecast_event("political_rally", 5000, 3, "Bellary Road 1", ...)
# were being silently dropped (only kw.arg-based parsing existed before),
# so every value fell back to defaults and you'd quietly get a
# "public_event" / "Mysore Road" / "MekhriCircle" forecast instead of the
# event actually being asked about.
FORECAST_PARAM_ORDER = list(inspect.signature(forecast_event).parameters.keys())


class TrafficChatbot:

    def __init__(self, api_key: str):
        self.client = Groq(api_key=api_key)
        self.history = []
        print("Chatbot ready. Type your event or question.")

    def _call_llm(self, messages, use_tools: bool, force: bool = False):
        kwargs = dict(
            model="qwen/qwen3-32b",
            messages=messages,
            temperature=0.3,
            max_tokens=1024,
            reasoning_format="hidden",  # stop "thinking" text leaking into content
        )
        if use_tools:
            kwargs["tools"] = [FORECAST_TOOL]
            kwargs["tool_choice"] = "required" if force else "auto"
        return self.client.chat.completions.create(**kwargs)

    # --- extraction: two independent ways Qwen might hand us parameters ---

    def _params_from_tool_call(self, msg) -> dict | None:
        if not msg.tool_calls:
            return None
        try:
            return json.loads(msg.tool_calls[0].function.arguments)
        except (json.JSONDecodeError, IndexError):
            return None

    def _params_from_text_call(self, text: str) -> dict | None:
        """Catches Qwen writing forecast_event(...) as plain Python-looking
        text instead of a real tool call. We parse it with ast.literal_eval
        only (safe — no arbitrary code execution), mapping BOTH positional
        and keyword arguments using the real function's parameter order,
        then run the REAL forecast_event() with those args. We never trust
        numbers Qwen typed, only numbers our own function computed."""
        match = FORECAST_CALL_RE.search(text or "")
        if not match:
            return None
        try:
            tree = ast.parse(f"forecast_event({match.group(1)})", mode="eval")
            call_node = tree.body
            if not isinstance(call_node, ast.Call):
                return None

            args = {}
            # positional args -> map by forecast_event's real signature order
            for name, node in zip(FORECAST_PARAM_ORDER, call_node.args):
                args[name] = ast.literal_eval(node)
            # keyword args override/add on top
            for kw in call_node.keywords:
                if kw.arg is not None:
                    args[kw.arg] = ast.literal_eval(kw.value)

            return args or None
        except Exception:
            return None

    def _looks_like_dataset_question(self, text: str) -> bool:
        t = text.lower()
        return any(h in t for h in DATASET_HINTS)

    # --- running the real engine ---

    def _run_forecast(self, args: dict) -> dict:
        return forecast_event(
            event_type     = args.get("event_type", "public_event"),
            attendance     = int(args.get("attendance", 0)),
            duration_hours = float(args.get("duration_hours", 2)),
            corridor       = args.get("corridor", "Mysore Road"),
            junction       = args.get("junction", "MekhriCircle"),
            road_closure   = bool(args.get("road_closure", False)),
            start_hour     = int(args.get("start_hour", 12)),
        )

    def _format_result(self, result: dict) -> str:
        n_roads = len(result["affected_corridors"])
        lines = [
            f"{'='*52}",
            "  EVENT IMPACT FORECAST",
            f"{'='*52}",
            f"  Event          : {result['event_type'].replace('_', ' ').title()}",
            f"  Congestion     : {result['score']} / 100  [{result['risk']}]",
            f"  Clearance time : {result['traffic_clearance_min']} minutes",
            f"  Officers       : {result['officers']}",
            f"  Barricades     : {result['barricades']}",
            f"  Roads affected : {n_roads}",
            "",
            "  AFFECTED CORRIDORS:",
        ]
        for c in result["affected_corridors"]:
            lines.append(
                f"    {c['corridor']:<25} -> {c['delay_min']} min "
                f"({c['impact_pct']}% impact) [{c['risk_level']}]"
            )
        if result["diversion_routes"]:
            lines.append("")
            lines.append("  DIVERSION ROUTES:")
            for r in result["diversion_routes"]:
                lines.append(f"    {r}")
        lines.append(f"{'='*52}")
        return "\n".join(lines)

    def chat(self, user_message: str) -> str:
        self.history.append({"role": "user", "content": user_message})
        messages = [{"role": "system", "content": SYSTEM_PROMPT}] + self.history

        response = self._call_llm(messages, use_tools=True)
        msg = response.choices[0].message

        params = self._params_from_tool_call(msg) or self._params_from_text_call(msg.content or "")

        # Safety net: looked like a forecast question, but we got neither a
        # real tool call nor a parseable forecast_event(...) text call —
        # force the model to use the tool properly instead of letting it
        # free-text an answer it can't back up with real numbers.
        if params is None and not self._looks_like_dataset_question(user_message):
            response = self._call_llm(messages, use_tools=True, force=True)
            msg = response.choices[0].message
            params = self._params_from_tool_call(msg) or self._params_from_text_call(msg.content or "")

        if params is not None:
            result = self._run_forecast(params)
            formatted = self._format_result(result)

            self.history.append({"role": "assistant", "content": ""})
            self.history.append({
                "role": "user",
                "content": (
                    "Here is the REAL forecast_event() output — the only "
                    "numbers you're allowed to use:\n"
                    f"```json\n{json.dumps(result, indent=2)}\n```\n\n"
                    "Using ONLY these numbers (do not invent, round, or add "
                    "any new figures), give your assessment as 4 short "
                    "bullet points, each under 20 words:\n"
                    "- Congestion risk and the main reason for it\n"
                    "- Officers needed and whether that's high for this kind of event\n"
                    "- Barricades needed\n"
                    "- How many roads/corridors are affected and which diversion route to use"
                ),
            })

            explanation_resp = self._call_llm(
                [{"role": "system", "content": SYSTEM_PROMPT}] + self.history,
                use_tools=False,
            )
            explanation = explanation_resp.choices[0].message.content

            # clean history: drop the scratch instruction, keep a tidy record
            self.history.pop()
            self.history.pop()
            self.history.append({"role": "assistant", "content": json.dumps(params)})
            self.history.append({"role": "assistant", "content": explanation})

            return formatted + "\n\n" + explanation

        else:
            content = msg.content
            self.history.append({"role": "assistant", "content": content})
            return content

    def reset(self):
        self.history = []
        print("Conversation reset.")
# ── CELL E: Run chatbot ──────────────────────────────────
# Add your Groq API key here. Get a free key at https://console.groq.com
#
# IMPORTANT: never leave a real key hard-coded in a notebook you share
# (e.g. on Kaggle/GitHub) — anyone who sees it can use your quota. Prefer
# Kaggle secrets:
#   from kaggle_secrets import UserSecretsClient
#   GROQ_API_KEY = UserSecretsClient().get_secret("GROQ_API_KEY")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
bot = TrafficChatbot(api_key=GROQ_API_KEY)