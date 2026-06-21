import React from 'react';
import { tierStyle } from './RiskScoreCard';
import { FiArrowRight } from 'react-icons/fi';

const Block = ({ title, badge, badgeTone, data }) => {
  const style = tierStyle(data.risk);
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold truncate">{title}</h4>
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${badgeTone}`}>{badge}</span>
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="kpi-label">Risk score</div>
          <div className="font-display text-3xl font-bold tabular-nums">{data.score.toFixed(1)}</div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${style.bg} ${style.fg}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
          {data.risk}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="kpi-label">Delay</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{data.delay} min</dd>
        </div>
        <div>
          <dt className="kpi-label">Officers</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{data.officers}</dd>
        </div>
        <div>
          <dt className="kpi-label">Barricades</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{data.barricades}</dd>
        </div>
      </dl>
    </div>
  );
};

const ScenarioComparison = ({ scenarioA, scenarioB }) => {
  if (!scenarioA || !scenarioB) {
    return (
      <div className="card p-6 text-sm text-text-muted">
        Run a forecast to compare scenarios with and without road closure.
      </div>
    );
  }

  const delta = scenarioB.score - scenarioA.score;
  const elevated = delta > 0;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-[15px]">Scenario comparison</h3>
          <p className="text-xs text-text-subtle">Impact of road closure on the same event configuration.</p>
        </div>
        <span className={`self-start text-xs font-medium px-2.5 py-1 rounded-full ${elevated ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'}`}>
          Δ {elevated ? '+' : ''}{delta.toFixed(1)} pts
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Block
          title="No road closure"
          badge="Baseline"
          badgeTone="bg-surface-2 text-text-muted"
          data={scenarioA}
        />
        <Block
          title="With road closure"
          badge="Restricted"
          badgeTone="bg-primary-soft text-primary"
          data={scenarioB}
        />
      </div>
      <div className="mt-4 text-xs text-text-muted flex items-start gap-2">
        <FiArrowRight className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          {delta > 20
            ? `Closure raises congestion by ${delta.toFixed(1)} points — recommend keeping the corridor open and diverting heavy vehicles 3 hours prior.`
            : delta > 0
              ? `Closure adds ${delta.toFixed(1)} points of congestion. Acceptable if ${scenarioB.barricades} barricades are deployed in advance.`
              : `Closure does not materially worsen congestion (${delta.toFixed(1)} pts). Proceed if operationally required.`}
        </span>
      </div>
    </div>
  );
};

export default ScenarioComparison;
