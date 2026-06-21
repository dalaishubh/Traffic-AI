import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { getMapJunctions } from "../services/api";
import L from "Leaflet";

const getRiskIcon = (score) => {
  if (score >= 15) return redIcon;
  if (score >= 5) return yellowIcon;
  return greenIcon;
};

const greenIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const yellowIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-yellow.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const redIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function MapPage() {
  const [junctions, setJunctions] = useState([]);

  useEffect(() => {
    const loadData = async () => {
  try {
    const data = await getMapJunctions();

    // console.log("TYPE:", typeof data);
    // console.log("IS ARRAY:", Array.isArray(data));
    // console.log("FIRST ITEM:", data[0]);

    setJunctions(data);
  } catch (err) {
    console.error(err);
  }
};

    loadData();
  }, []);
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="card p-6">
        <h1 className="text-2xl font-bold mb-2">Traffic Risk Map</h1>

        <p className="text-text-muted mb-6">
          Interactive traffic intelligence map.
        </p>

        <div className="overflow-hidden rounded-xl border border-border">
            <div className="mb-4 flex gap-6 text-sm">
  <div className="flex items-center gap-2">
    <span className="w-4 h-4 rounded-full bg-green-500"></span>
    Low Risk
  </div>

  <div className="flex items-center gap-2">
    <span className="w-4 h-4 rounded-full bg-yellow-500"></span>
    Medium Risk
  </div>

  <div className="flex items-center gap-2">
    <span className="w-4 h-4 rounded-full bg-red-500"></span>
    High Risk
  </div>
</div>
          <MapContainer
            center={[12.9716, 77.5946]}
            zoom={11}
            style={{ height: "600px", width: "100%" }}
          >
            <>
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {junctions.map((j, index) => (
    <Marker
  key={index}
  position={[
    Number(j.latitude),
    Number(j.longitude)
  ]}
  icon={getRiskIcon(j.risk_score)}
>
      <Popup>
  <div style={{ minWidth: "220px" }}>
    <h3>{j.junction}</h3>

    <p>
      <strong>Risk Score:</strong>{" "}
      {Number(j.risk_score).toFixed(2)}
    </p>

    <p>
      <strong>Risk Level:</strong>{" "}
      {j.risk_score >= 15
        ? "High"
        : j.risk_score >= 5
        ? "Medium"
        : "Low"}
    </p>
  </div>
</Popup>
    </Marker>
  ))}

              
            </>
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
