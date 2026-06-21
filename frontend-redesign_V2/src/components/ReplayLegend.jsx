import React from 'react';

const ReplayLegend = () => {
  const legendItems = [
    { label: 'Critical (≥80% Impact)', colorClass: 'bg-red-500' },
    { label: 'Warning (≥40% Impact)', colorClass: 'bg-yellow-500' },
    { label: 'Success (<40% Impact)', colorClass: 'bg-green-500' },
  ];

  return (
    <div className="bg-surface-2 p-3.5 rounded-xl border border-border space-y-2">
      <h4 className="text-2xs font-bold uppercase tracking-wider text-text-muted">
        Congestion Density Legend
      </h4>
      <div className="grid grid-cols-3 gap-2 text-3xs font-medium text-text-subtle font-semibold">
        {legendItems.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${item.colorClass} animate-pulse shrink-0`} />
            <span className="truncate">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReplayLegend;
