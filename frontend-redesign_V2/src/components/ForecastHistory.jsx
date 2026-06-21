import React from 'react';
import { tierStyle } from './RiskScoreCard';

const ForecastHistory = ({ entries = [], onClear }) => {
  if (!entries.length) {
    return (
      <div className="card p-6 text-sm text-text-muted">
        No recent forecasts yet. Run a simulation to populate this history.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-border">
        <div className="min-w-0">
          <h3 className="font-semibold text-[15px] truncate">Recent forecasts</h3>
          <p className="text-xs text-text-subtle">Last {entries.length} simulations (stored locally)</p>
        </div>
        <button onClick={onClear} className="text-xs text-text-muted hover:text-danger transition-colors shrink-0">
          Clear
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-surface-2">
            <tr className="text-left text-xs uppercase tracking-wider text-text-subtle">
              <th className="px-5 py-2.5 font-semibold">Timestamp</th>
              <th className="px-5 py-2.5 font-semibold">Event</th>
              <th className="px-5 py-2.5 font-semibold">Junction</th>
              <th className="px-5 py-2.5 font-semibold text-right">Score</th>
              <th className="px-5 py-2.5 font-semibold">Risk</th>
              <th className="px-5 py-2.5 font-semibold">Delay (min)</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const style = tierStyle(e.risk);
              return (
                <tr key={e.id} className="border-t border-border hover:bg-surface-2/60">
                  <td className="px-5 py-2.5 text-text-muted whitespace-nowrap">{e.timestamp}</td>
                  <td className="px-5 py-2.5">{e.eventLabel}</td>
                  <td className="px-5 py-2.5 text-text-muted">{e.junction}</td>
                  <td className="px-5 py-2.5 text-right font-semibold tabular-nums">{e.score.toFixed(1)}</td>
                  <td className="px-5 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.fg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                      {e.risk}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-text-muted">{e.delay}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ForecastHistory;
