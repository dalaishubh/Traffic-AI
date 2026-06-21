import React from 'react';
import { FiClock } from 'react-icons/fi';

const TimelineCard = ({ stage, isFirst, isLast }) => {
  const getImpactColor = (pct) => {
    if (pct >= 80) return 'text-red-500 border-red-500/25 bg-red-500/10';
    if (pct >= 40) return 'text-yellow-500 border-yellow-500/25 bg-yellow-500/10';
    return 'text-green-500 border-green-500/25 bg-green-500/10';
  };

  const getMarkerColor = (pct) => {
    if (pct >= 80) return 'bg-red-500 shadow-red-500/50';
    if (pct >= 40) return 'bg-yellow-500 shadow-yellow-500/50';
    return 'bg-green-500 shadow-green-500/50';
  };

  return (
    <div className="flex gap-4 relative">
      {/* Line column */}
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-3.5 h-3.5 rounded-full ${getMarkerColor(stage.impact_pct)} shadow-lg z-10`} />
        {!isLast && <div className="w-0.5 flex-1 bg-border my-1" />}
      </div>

      {/* Content column */}
      <div className="flex-1 pb-6">
        <div className="card p-4 space-y-2 border-l-4 border-l-primary/40 hover:border-l-primary transition-all">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-xs font-mono font-bold text-text-muted bg-surface-2 px-2 py-0.5 rounded">
              <FiClock className="w-3 h-3" /> {String(stage.minute).padStart(2, '0')} min
            </span>
            <span className={`px-2 py-0.5 rounded-full text-2xs font-bold border ${getImpactColor(stage.impact_pct)}`}>
              {stage.impact_pct}% Impact
            </span>
          </div>

          <h4 className="font-display font-bold text-sm tracking-tight text-text">
            {stage.title}
          </h4>

          {stage.corridor && (
            <div className="text-xs font-semibold text-primary/80">
              Corridor: <span className="text-text">{stage.corridor}</span>
            </div>
          )}

          <p className="text-xs text-text-muted leading-relaxed">
            {stage.description}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TimelineCard;
