import React, { useState, useMemo } from 'react';
import {
  FiAlertTriangle,
  FiActivity,
  FiMapPin,
  FiTrendingUp,
  FiClock,
  FiUsers,
  FiSliders
} from 'react-icons/fi';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

import KpiCard from '../components/KpiCard';
import CongestionTrendChart from '../components/CongestionTrendChart';
import RiskBreakdownChart from '../components/RiskBreakdownChart';
import MapPlaceholder from '../components/MapPlaceholder';

const CORRIDOR_RANKINGS = [
  { name: 'Mysore Road', events: 743, score: 82 },
  { name: 'Bellary Road 1', events: 610, score: 33 },
  { name: 'ORR North 1', events: 275, score: 22 },
  { name: 'ORR East 1', events: 244, score: 18 },
  { name: 'Hosur Road', events: 298, score: 17 },
  { name: 'Tumkur Road', events: 458, score: 12 },
  { name: 'Bellary Road 2', events: 379, score: 12 },
  { name: 'Old Madras Road', events: 263, score: 12 },
  { name: 'Magadi Road', events: 245, score: 10 },
];

const CORRIDOR_RISK_SCORES = {
  "Mysore Road": 0.82,
  "Bellary Road 1": 0.33,
  "ORR North 1": 0.22,
  "ORR East 1": 0.18,
  "Hosur Road": 0.17,
  "Tumkur Road": 0.12,
  "Bellary Road 2": 0.12,
  "Old Madras Road": 0.12,
  "Magadi Road": 0.10,
};

const AnalyticsPage = () => {
  // Simulator inputs
  const [corridor, setCorridor] = useState('Mysore Road');
  const [attendance, setAttendance] = useState(5000);
  const [duration, setDuration] = useState(3);
  const [startHour, setStartHour] = useState(18);
  const [roadClosure, setRoadClosure] = useState(true);

  // Constants
  const getCorridorRisk = (name) => CORRIDOR_RISK_SCORES[name] || 0.2;
  const getJunctionRisk = () => 0.25; // baseline junction risk

  // Dynamic simulation computation
  const simulatedScenarios = useMemo(() => {
    const eventsToCompare = [
      { id: 'vehicle_breakdown', label: 'Vehicle Breakdown', severity: 1 },
      { id: 'pot_holes', label: 'Potholes', severity: 2 },
      { id: 'road_conditions', label: 'Bad Road Conditions', severity: 2 },
      { id: 'fog_low_visibility', label: 'Fog / Low Visibility', severity: 2 },
      { id: 'debris', label: 'Debris on Road', severity: 3 },
      { id: 'congestion', label: 'Normal Congestion', severity: 3 },
      { id: 'water_logging', label: 'Water Logging / Flooding', severity: 3 },
      { id: 'others', label: 'Others', severity: 3 },
      { id: 'tree_fall', label: 'Tree Fall', severity: 4 },
      { id: 'accident', label: 'Road Accident', severity: 4 },
      { id: 'construction', label: 'Road Construction', severity: 5 },
      { id: 'public_event', label: 'Concert / Public Event', severity: 6 },
      { id: 'procession', label: 'Religious/Public Procession', severity: 7 },
      { id: 'political_rally', label: 'Political Rally', severity: 8 },
      { id: 'vip_movement', label: 'VIP / Convoy Movement', severity: 9 },
      { id: 'protest', label: 'Protest / Demonstration', severity: 9 }
    ];

    return eventsToCompare.map(evt => {
      // 1. Predict delay score
      let score = 0;
      score += Math.min(attendance / 1000, 10) * 4; // crowd impact
      score += Math.min(duration, 8) * 2;           // duration impact
      score += evt.severity * 4;                    // severity impact
      score += getCorridorRisk(corridor) * 20;      // corridor risk
      score += getJunctionRisk() * 20;              // junction risk

      if (roadClosure) {
        score += 15;
      }

      const isPeak = [8, 9, 10, 17, 18, 19, 20].includes(startHour);
      const timeFactor = isPeak ? 1.8 : 1.0;
      score += Math.max((timeFactor - 1) * 10, 0);

      const eventBonus = {
        vip_movement: 10,
        political_rally: 8,
        protest: 10,
        procession: 5
      };
      score += eventBonus[evt.id] || 0;
      const finalScore = Math.min(Math.round(score * 100) / 100, 100);

      // 2. Predict clearance delay (minutes)
      let delay = 5;
      delay += attendance / 500;
      delay += duration * 2;
      if (roadClosure) {
        delay += 10;
      }
      delay += finalScore * 0.2;
      const finalDelay = Math.min(Math.round(delay), 120);

      // 3. Officers required
      let officers = 0;
      const minorHazardTypes = [
        "vehicle_breakdown", "pot_holes", "road_conditions",
        "water_logging", "fog_low_visibility", "debris", "congestion",
      ];
      if (evt.id === 'vehicle_breakdown') {
        officers = 3;
      } else if (minorHazardTypes.includes(evt.id)) {
        officers = 4;
      } else if (['accident', 'tree_fall'].includes(evt.id)) {
        officers = 5;
      } else if (evt.id === 'construction') {
        officers = 5;
        if (finalScore >= 80) officers += 2;
        else if (finalScore >= 60) officers += 1;
      } else {
        officers = 5 + Math.floor(attendance / 1000);
        const eventBoost = {
          others: 1,
          public_event: 2,
          procession: 3,
          political_rally: 5,
          vip_movement: 7,
          protest: 8,
        };
        officers += eventBoost[evt.id] || 0;
        if (finalScore >= 80) officers += 5;
        else if (finalScore >= 60) officers += 3;
      }
      const finalOfficers = Math.min(officers, 50);

      // Risk level tier
      let riskLevel = 'Low';
      if (finalScore >= 75) riskLevel = 'Critical';
      else if (finalScore >= 50) riskLevel = 'High';
      else if (finalScore >= 25) riskLevel = 'Medium';

      return {
        ...evt,
        score: finalScore,
        delay: finalDelay,
        officers: finalOfficers,
        risk: riskLevel
      };
    });
  }, [corridor, attendance, duration, startHour, roadClosure]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">Analytics</div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-1">Executive overview</h1>
        <p className="text-sm text-text-muted mt-1">
          Aggregated traffic intelligence across the city's monitored corridors and historical event database.
        </p>
      </div>

      {/* Row 1 */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard label="Total events analyzed" value="8,173" sublabel="Last 24 months" icon={FiActivity} />
        <KpiCard label="High-risk events" value="1,427" sublabel="17.5% of total" icon={FiAlertTriangle} tone="danger" />
        <KpiCard label="Avg. congestion index" value="54.8" sublabel="Citywide baseline" icon={FiTrendingUp} tone="warning" />
        <KpiCard label="Most impacted corridor" value="Mysore Road" sublabel="82 avg. score" icon={FiMapPin} tone="primary" />
      </section>

      {/* Row 2 */}
      <section>
        <CongestionTrendChart />
      </section>

      {/* Row 3 */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RiskBreakdownChart />
        <div className="card p-5">
          <div className="mb-2">
            <h3 className="font-semibold text-[15px]">Corridor rankings</h3>
            <p className="text-xs text-text-subtle">Top corridors by average congestion score</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CORRIDOR_RANKINGS} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--color-text-subtle)', fontSize: 11 }} stroke="var(--color-border)" />
                <YAxis dataKey="name" type="category" width={130} tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} stroke="var(--color-border)" />
                <Tooltip
                  cursor={{ fill: 'var(--color-surface-2)' }}
                  contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="score" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Row 3.5: Scenario Simulator Side-by-Side Table */}
      <section className="card p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="font-semibold text-[16px] flex items-center gap-2">
              <FiSliders className="text-primary w-4 h-4" />
              Multi-Event Scenario Simulator
            </h3>
            <p className="text-xs text-text-subtle mt-0.5">Compare how a single location handles different event profiles simultaneously.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-text-muted">
              <input
                type="checkbox"
                checked={roadClosure}
                onChange={(e) => setRoadClosure(e.target.checked)}
                className="w-3.5 h-3.5 accent-[var(--color-primary)] rounded"
              />
              Road Closure
            </label>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-surface-2 border border-border">
          <div>
            <label className="kpi-label">Corridor</label>
            <select
              value={corridor}
              onChange={(e) => setCorridor(e.target.value)}
              className="input-field mt-1 py-1 px-2 text-xs"
            >
              {Object.keys(CORRIDOR_RISK_SCORES).map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="kpi-label">Attendance</label>
            <input
              type="number"
              min="0"
              value={attendance}
              onChange={(e) => setAttendance(Number(e.target.value))}
              className="input-field mt-1 py-1 px-2 text-xs"
            />
          </div>
          <div>
            <label className="kpi-label">Duration (Hours)</label>
            <input
              type="number"
              min="1"
              max="24"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="input-field mt-1 py-1 px-2 text-xs"
            />
          </div>
          <div>
            <label className="kpi-label">Start Hour</label>
            <select
              value={startHour}
              onChange={(e) => setStartHour(Number(e.target.value))}
              className="input-field mt-1 py-1 px-2 text-xs"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
              ))}
            </select>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto border border-border rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-2 border-b border-border text-text-subtle font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4 text-center">Risk Tier</th>
                <th className="py-3 px-4 text-center">Expected Delay</th>
                <th className="py-3 px-4 text-center">Officers Required</th>
              </tr>
            </thead>
            <tbody>
              {simulatedScenarios.map((s, idx) => {
                const styleMap = {
                  Critical: 'bg-danger-soft text-danger',
                  High: 'bg-warning-soft text-warning',
                  Medium: 'bg-warning-soft text-warning',
                  Low: 'bg-success-soft text-success'
                };
                return (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-surface-2/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-text">{s.label}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${styleMap[s.risk]}`}>
                        {s.risk}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center gap-1 font-bold text-text-muted">
                        <FiClock className="w-3.5 h-3.5 text-text-subtle" />
                        <span>{s.delay} mins</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center gap-1 font-bold text-text-muted">
                        <FiUsers className="w-3.5 h-3.5 text-primary" />
                        <span>{s.officers} personnel</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Row 4 */}
      <section>
        <MapPlaceholder />
      </section>
    </div>
  );
};

export default AnalyticsPage;
