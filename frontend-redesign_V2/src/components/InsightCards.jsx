import React from 'react';
import { FiAlertTriangle, FiInfo, FiActivity, FiShield, FiTrendingUp } from 'react-icons/fi';

const InsightCards = ({ forecast, inputData }) => {
  if (!forecast) {
    return (
      <div className="card p-6 text-sm text-text-muted">
        Operational recommendations will appear here after a forecast is run.
      </div>
    );
  }

  const { score, delay, officers } = forecast;
  const { attendance, corridor, junction, road_closure, start_hour } = inputData || {};

  const insights = [];

  if (score > 75) {
    insights.push({ type: 'danger', icon: FiAlertTriangle, title: 'Critical congestion expected', desc: `Risk index of ${score}% indicates likely gridlock at ${junction}. Activate emergency diversion plan and pre-stage units.` });
  } else if (score > 50) {
    insights.push({ type: 'warning', icon: FiTrendingUp, title: 'High flow alert', desc: `Expected delay ${delay} min. Pre-deploy officers at ${junction} and notify upstream signals.` });
  } else {
    insights.push({ type: 'info', icon: FiShield, title: 'Stable traffic flow', desc: 'Conditions are within nominal ranges. Standard patrol coverage is sufficient.' });
  }

  if (road_closure) {
    insights.push({ type: 'danger', icon: FiAlertTriangle, title: 'Closure impact', desc: `Closing ${corridor} will force reroutes. Broadcast alternate pathways via VMS at least 90 minutes prior.` });
  }

  const peak = (start_hour >= 8 && start_hour <= 11) || (start_hour >= 17 && start_hour <= 20);
  if (peak) {
    insights.push({ type: 'warning', icon: FiActivity, title: 'Peak-hour overlap', desc: `Event start at ${String(start_hour).padStart(2, '0')}:00 overlaps citywide peak windows; congestion decay times can double.` });
  }

  if (officers > 15) {
    insights.push({ type: 'info', icon: FiInfo, title: 'Personnel allocation', desc: `Deploying ${officers} officers — establish 3 mobile check-posts around ${junction} and 2 officers at merging ramps.` });
  }

  if (attendance >= 5000) {
    insights.push({ type: 'warning', icon: FiInfo, title: 'High crowd density', desc: `Attendance ${Number(attendance).toLocaleString()} planned. Restrict pedestrian crossings on ${corridor} to avoid tailbacks.` });
  }

  const tone = {
    danger:  { wrap: 'border-danger/30 bg-danger-soft',  icon: 'text-danger'  },
    warning: { wrap: 'border-warning/30 bg-warning-soft', icon: 'text-warning' },
    info:    { wrap: 'border-primary/30 bg-primary-soft', icon: 'text-primary' },
  };

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-[15px]">Operational insights</h3>
      <p className="text-xs text-text-subtle mt-0.5">Automatically generated recommendations for the current scenario.</p>
      <ul className="mt-4 space-y-2.5">
        {insights.map((it, idx) => {
          const Icon = it.icon;
          const t = tone[it.type];
          return (
            <li key={idx} className={`border rounded-lg p-3 flex gap-3 ${t.wrap}`}>
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${t.icon}`} />
              <div className="min-w-0">
                <div className="text-sm font-semibold">{it.title}</div>
                <div className="text-xs text-text-muted mt-0.5 leading-relaxed">{it.desc}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default InsightCards;
