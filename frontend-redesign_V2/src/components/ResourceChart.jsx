import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

const ResourceChart = ({ officers = 0, barricades = 0 }) => {
  const data = [
    { name: 'Officers',   value: officers,   fill: 'var(--color-primary)' },
    { name: 'Barricades', value: barricades, fill: 'var(--color-warning)' },
  ];
  return (
    <div className="card p-5">
      <div className="mb-2">
        <h3 className="font-semibold text-[15px]">Resource requirement</h3>
        <p className="text-xs text-text-subtle">Recommended deployment based on current forecast</p>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: 'var(--color-text-subtle)', fontSize: 12 }} stroke="var(--color-border)" />
            <YAxis tick={{ fill: 'var(--color-text-subtle)', fontSize: 11 }} stroke="var(--color-border)" />
            <Tooltip
              cursor={{ fill: 'var(--color-surface-2)' }}
              contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ResourceChart;
