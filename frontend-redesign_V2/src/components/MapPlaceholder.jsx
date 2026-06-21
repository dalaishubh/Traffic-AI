import React from 'react';
import { FiLayers } from 'react-icons/fi';

const HOTSPOTS = [
  { x: 22, y: 38, label: 'Silk Board',   risk: 'danger' },
  { x: 55, y: 24, label: 'Hebbal',       risk: 'warning' },
  { x: 70, y: 60, label: 'Tin Factory',  risk: 'warning' },
  { x: 38, y: 70, label: 'Dairy Circle', risk: 'success' },
];

const riskColor = {
  danger:  'var(--color-danger)',
  warning: 'var(--color-warning)',
  success: 'var(--color-success)',
};

const MapPlaceholder = () => (
  <div className="card overflow-hidden">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-3 border-b border-border">
      <div className="min-w-0">
        <h3 className="font-semibold text-[15px] flex items-center gap-2">
          <FiLayers className="w-4 h-4 text-primary shrink-0" />
          Traffic intelligence map
        </h3>
        <p className="text-xs text-text-subtle">Corridor overlays and junction hotspots · Bengaluru metropolitan grid</p>
      </div>
      <span className="text-[11px] uppercase tracking-wider text-text-subtle shrink-0">Future GIS integration</span>
    </div>

    <div className="relative h-[320px] bg-surface-2">
      <svg viewBox="0 0 500 320" className="w-full h-full">
        <defs>
          <pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--color-border)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="500" height="320" fill="url(#map-grid)" />

        <path d="M 30 250 Q 200 100 470 70"  stroke="var(--color-primary)" strokeOpacity="0.55" strokeWidth="3"   fill="none" />
        <path d="M 40 60  Q 200 150 460 280" stroke="var(--color-primary)" strokeOpacity="0.35" strokeWidth="2.5" fill="none" strokeDasharray="6 4" />
        <path d="M 80 30 L 90 300"   stroke="var(--color-border-strong)" strokeWidth="2" fill="none" />
        <path d="M 380 20 L 410 310" stroke="var(--color-border-strong)" strokeWidth="2" fill="none" />
        <path d="M 20 180 L 480 180" stroke="var(--color-border-strong)" strokeWidth="2" fill="none" />

        {HOTSPOTS.map((h, i) => {
          const cx = (h.x / 100) * 500;
          const cy = (h.y / 100) * 320;
          const c = riskColor[h.risk];
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r="14" fill={c} fillOpacity="0.15" />
              <circle cx={cx} cy={cy} r="6"  fill={c} />
              <text x={cx + 12} y={cy + 4} fontSize="11" fill="var(--color-text)" fontFamily="Inter">
                {h.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 text-[11px] bg-surface/90 border border-border rounded-md px-2.5 py-1.5 backdrop-blur">
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-danger" />High congestion</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning" />Moderate</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-success" />Free flow</span>
      </div>
    </div>
  </div>
);

export default MapPlaceholder;
