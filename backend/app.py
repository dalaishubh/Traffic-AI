from flask import Flask, request, jsonify
from app.services import traffic_engine as engine

app = Flask(__name__)

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok" if engine.MODELS_READY else "degraded",
                     "models_ready": engine.MODELS_READY})

@app.route("/forecast", methods=["POST"])
def forecast():
    data = request.json
    try:
        result = engine.forecast_event(
            event_type     = data["event_type"],
            attendance     = data.get("attendance", 1000),
            duration_hours = data.get("duration_hours", 2),
            corridor       = data.get("corridor", "Mysore Road"),
            junction       = data.get("junction", "MekhriCircle"),
            road_closure   = data.get("road_closure", False),
            start_hour     = data.get("start_hour", 12),
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/resolve_location", methods=["POST"])
def resolve_location():
    data = request.json
    return jsonify(engine.resolve_location_from_coords(data["lat"], data["lon"]))

@app.route("/junction_nodes", methods=["GET"])
def junction_nodes():
    return jsonify(engine.junction_nodes)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)