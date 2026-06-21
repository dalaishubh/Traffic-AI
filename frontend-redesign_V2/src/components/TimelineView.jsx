import React from 'react';
import { FiActivity, FiTrendingUp } from 'react-icons/fi';
import TimelineCard from './TimelineCard';

const TimelineView = ({ timelineData, peakMin, confidence }) => {
  if (!timelineData || timelineData.length === 0) {
    return (
      <div className="text-center p-6 text-sm text-text-muted">
        No timeline data available.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timeline KPIs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 flex flex-col justify-between border-t-2 border-t-primary">
          <div className="flex items-center gap-1.5 text-xs text-text-muted font-medium">
            <FiActivity className="text-primary w-4 h-4" /> Peak Congestion
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-bold font-mono text-text">
              +{peakMin} mins
            </span>
          </div>
          <div className="text-2xs text-text-subtle mt-1">Expected max queue depth</div>
        </div>

        <div className="card p-4 flex flex-col justify-between border-t-2 border-t-warning">
          <div className="flex items-center gap-1.5 text-xs text-text-muted font-medium">
            <FiTrendingUp className="text-warning w-4 h-4" /> Prediction Confidence
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-bold font-mono text-text">
              {confidence}%
            </span>
          </div>
          <div className="text-2xs text-text-subtle mt-1">Historical pattern match</div>
        </div>
      </div>

      {/* Vertical Timeline Card List */}
      <div className="card p-5 bg-surface-dark space-y-1">
        <h3 className="font-display font-bold text-sm uppercase tracking-wider text-text-muted mb-4 border-b border-border pb-2">
          Disruption Propagation Timeline
        </h3>
        <div className="flex flex-col mt-2">
          {timelineData.map((stage, idx) => (
            <TimelineCard
              key={idx}
              stage={stage}
              isFirst={idx === 0}
              isLast={idx === timelineData.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TimelineView;
