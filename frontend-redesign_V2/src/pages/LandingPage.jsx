import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiArrowRight, FiTrendingUp, FiShield, FiMap, FiUsers, FiBarChart2, FiClock } from 'react-icons/fi';

const STATS = [
  { value: '8,173', label: 'Historical events analyzed' },
  { value: '22', label: 'Active corridors monitored' },
  { value: '294', label: 'Junction hotspots mapped' },
];

const FEATURES = [
  {
    icon: FiTrendingUp,
    title: 'Congestion forecasting',
    desc: 'Predict corridor-level delay and risk before an event begins, using historical and contextual signals.',
  },
  {
    icon: FiShield,
    title: 'Risk classification',
    desc: 'Each scenario is scored and tiered (Low to Critical) so dispatchers know exactly when to escalate.',
  },
  {
    icon: FiUsers,
    title: 'Resource planning',
    desc: 'Get recommended officer counts and barricade units sized to the predicted load — not guesswork.',
  },
  {
    icon: FiBarChart2,
    title: 'Scenario comparison',
    desc: 'Compare with-closure vs. without-closure plans side-by-side to support data-backed decisions.',
  },
  {
    icon: FiClock,
    title: 'Forecast history',
    desc: 'Recent simulations are saved locally so planners can review and revisit previous what-if runs.',
  },
  {
    icon: FiMap,
    title: 'Spatial overview',
    desc: 'A map-based view of corridors and junctions provides operational context at a glance.',
  },
];

const LandingPage = () => {
  return (
    <div>
      <section className="border-b border-border bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-soft text-primary">
              Smart City · Operational Intelligence
            </span>
            <h1 className="mt-5 font-display font-bold text-3xl sm:text-5xl leading-[1.1] tracking-tight">
              Forecast traffic impact <br className="hidden sm:block" />
              <span className="text-primary">before it happens.</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-text-muted max-w-2xl leading-relaxed">
              A decision-support platform for city traffic authorities. Simulate events, estimate
              congestion risk, and plan officer and barricade deployment with confidence.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/forecast" className="btn-primary">
                Open forecast desk
                <FiArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/analytics" className="btn-secondary">
                View analytics
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-5">
          {STATS.map((s) => (
            <div key={s.label} className="card p-6">
              <div className="font-display text-3xl sm:text-4xl font-bold tracking-tight tabular-nums">
                {s.value}
              </div>
              <div className="mt-1 text-sm text-text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-14 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">
              Built for traffic operations teams
            </h2>
            <p className="mt-3 text-text-muted">
              Six focused capabilities that turn raw event parameters into operational plans —
              clear scores, clear actions, clear comparisons.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="card p-6 hover:border-border-strong transition-colors">
                  <div className="w-9 h-9 rounded-md bg-primary-soft text-primary inline-flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="mt-4 font-semibold text-[15px]">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-text-muted leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <h3 className="font-display text-2xl font-bold tracking-tight">Ready to simulate a scenario?</h3>
            <p className="mt-2 text-text-muted">Configure event parameters and get a risk-tiered forecast in seconds.</p>
          </div>
          <Link to="/forecast" className="btn-primary">
            Launch forecast desk <FiArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
