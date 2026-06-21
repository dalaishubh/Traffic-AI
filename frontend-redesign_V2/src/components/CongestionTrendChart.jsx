import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const DATA = [
  { hour: '06', congestion: 18 }, { hour: '07', congestion: 32 }, { hour: '08', congestion: 58 },
  { hour: '09', congestion: 74 }, { hour: '10', congestion: 62 }, { hour: '11', congestion: 48 },
  { hour: '12', congestion: 42 }, { hour: '13', congestion: 44 }, { hour: '14', congestion: 40 },
  { hour: '15', congestion: 46 }, { hour: '16', congestion: 55 }, { hour: '17', congestion: 71 },
  { hour: '18', congestion: 82 }, { hour: '19', congestion: 78 }, { hour: '20', congestion: 60 },
  { hour: '21', congestion: 38 }, { hour: '22', congestion: 24 },
];

const CongestionTrendChart = () => (
  <div className="card p-5">
    <div className="mb-4">
      <h3 className="font-semibold text-[15px]">Historical congestion trend</h3>
      <p className="text-xs text-text-subtle">Average corridor congestion index by hour of day</p>
    </div>
    <div className="h-64 sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={DATA} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="congArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="hour" tick={{ fill: 'var(--color-text-subtle)', fontSize: 11 }} stroke="var(--color-border)" />
          <YAxis tick={{ fill: 'var(--color-text-subtle)', fontSize: 11 }} stroke="var(--color-border)" />
          <Tooltip
            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: 'var(--color-text-muted)' }}
          />
          <Area type="monotone" dataKey="congestion" stroke="var(--color-primary)" strokeWidth={2} fill="url(#congArea)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export default CongestionTrendChart;
