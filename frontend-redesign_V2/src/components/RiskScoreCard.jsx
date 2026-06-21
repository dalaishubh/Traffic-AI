import React from 'react';

const tierStyles = {
  Low:      { fg: 'text-success', bg: 'bg-success-soft', dot: 'bg-success', ring: 'stroke-success', text: 'Low' },
  Medium:   { fg: 'text-warning', bg: 'bg-warning-soft', dot: 'bg-warning', ring: 'stroke-warning', text: 'Medium' },
  High:     { fg: 'text-warning', bg: 'bg-warning-soft', dot: 'bg-warning', ring: 'stroke-warning', text: 'High' },
  Critical: { fg: 'text-danger',  bg: 'bg-danger-soft',  dot: 'bg-danger',  ring: 'stroke-danger',  text: 'Critical' },
};

export const tierStyle = (risk) => tierStyles[risk] || tierStyles.Low;

const RiskScoreCard = ({ score = 0, risk = 'Low', baseline = 50 }) => {
  const style = tierStyle(risk);
  const trend = score - baseline;
  const trendLabel =
    trend === 0
      ? 'at baseline'
      : trend > 0
        ? `+${trend.toFixed(1)}% above baseline`
        : `${trend.toFixed(1)}% below baseline`;

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const dashOffset = circumference * (1 - pct);

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="kpi-label">Risk score</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-4xl sm:text-5xl font-bold tabular-nums tracking-tight">
              {score.toFixed(1)}
            </span>
            <span className="text-sm text-text-subtle">/ 100</span>
          </div>
          <div className="mt-3">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.fg}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
              {style.text} risk tier
            </span>
          </div>
          <p className={`mt-3 text-xs font-medium ${trend > 0 ? 'text-danger' : trend < 0 ? 'text-success' : 'text-text-subtle'}`}>
            {trendLabel}
          </p>
        </div>

        <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--color-border)" strokeWidth="10" />
            <circle
              cx="60" cy="60" r={radius} fill="none"
              className={style.ring}
              strokeWidth="10" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 700ms ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-xl font-bold tabular-nums ${style.fg}`}>{Math.round(score)}%</span>
            <span className="text-[10px] uppercase tracking-wider text-text-subtle mt-0.5">Index</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskScoreCard;
