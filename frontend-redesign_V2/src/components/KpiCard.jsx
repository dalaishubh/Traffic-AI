import React from 'react';

const toneMap = {
  default: 'text-text',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger:  'text-danger',
};

const KpiCard = ({ label, value, sublabel, icon: Icon, tone = 'default' }) => (
  <div className="card p-5">
    <div className="flex items-center justify-between gap-2">
      <span className="kpi-label truncate">{label}</span>
      {Icon && (
        <span className="text-text-subtle shrink-0">
          <Icon className="w-4 h-4" />
        </span>
      )}
    </div>
    <div className={`mt-2 font-display text-2xl sm:text-3xl font-bold tabular-nums tracking-tight ${toneMap[tone] || toneMap.default}`}>
      {value}
    </div>
    {sublabel && <div className="mt-1 text-xs text-text-subtle">{sublabel}</div>}
  </div>
);

export default KpiCard;
