import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

const DATA = [
  { name: 'Low',      value: 42, color: 'var(--color-success)' },
  { name: 'Medium',   value: 28, color: 'var(--color-warning)' },
  { name: 'High',     value: 18, color: '#F97316' },
  { name: 'Critical', value: 12, color: 'var(--color-danger)' },
];

const RiskBreakdownChart = () => (
  <div className="card p-5">
    <div className="mb-2">
      <h3 className="font-semibold text-[15px]">Risk distribution</h3>
      <p className="text-xs text-text-subtle">Share of analyzed events by risk tier</p>
    </div>
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={DATA} dataKey="value" nameKey="name" innerRadius={55} outerRadius={88} paddingAngle={2}>
            {DATA.map((d, i) => <Cell key={i} fill={d.color} stroke="var(--color-surface)" strokeWidth={2} />)}
          </Pie>
          <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-text-muted)' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export default RiskBreakdownChart;
