import React from "react";
import { motion } from "framer-motion";
import { 
  FiAlertCircle, 
  FiLayers, 
  FiTrendingDown, 
  FiBriefcase, 
  FiShuffle, 
  FiInfo 
} from "react-icons/fi";
import ActionCard from "./ActionCard";

export default function StrategyAdvisor({ forecastData }) {
  if (!forecastData) {
    return (
      <div className="flex items-center justify-center p-8 text-xs text-slate-400">
        No operational data available.
      </div>
    );
  }

  const strategy = forecastData.strategy || {};
  const priority = strategy.priority || "Low";
  const actions = strategy.actions || [];
  const deploymentPlan = strategy.deployment_plan || [];
  const diversion = strategy.diversion || { primary: "N/A", secondary: "N/A", emergency: "N/A" };
  const estimatedImprovement = strategy.estimated_improvement || "0%";

  // Determine priority color themes
  let theme = {
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    glow: "shadow-emerald-950/20",
    pulse: "bg-emerald-500",
    complexity: "Routine Monitoring"
  };

  if (priority.toLowerCase() === "critical") {
    theme = {
      color: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
      badge: "bg-rose-500/15 text-rose-400 border-rose-500/30",
      glow: "shadow-rose-950/20",
      pulse: "bg-rose-500",
      complexity: "Critical Action Plan"
    };
  } else if (priority.toLowerCase() === "high") {
    theme = {
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
      badge: "bg-orange-500/15 text-orange-400 border-orange-500/30",
      glow: "shadow-orange-950/20",
      pulse: "bg-orange-500",
      complexity: "High Command Control"
    };
  } else if (priority.toLowerCase() === "medium") {
    theme = {
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      glow: "shadow-amber-950/20",
      pulse: "bg-amber-500",
      complexity: "Standard Diversion"
    };
  }

  return (
    <div className="space-y-6 text-slate-200">
      {/* Active Strategy Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-center justify-between gap-3 p-4 rounded-xl border ${theme.bg} ${theme.border} ${theme.glow} shadow-lg`}
      >
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${theme.pulse}`} />
            <span className={`relative inline-flex rounded-full h-3 w-3 ${theme.pulse}`} />
          </span>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Active Strategy Engine
            </h3>
            <p className="text-[10px] text-slate-500">
              Deterministic Decision Support Recommendation
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Risk Score</span>
          <span className="text-xs font-extrabold text-white font-mono">{forecastData.score} / 100</span>
        </div>
      </motion.div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* KPI 1: Priority Level */}
        <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Priority Level</span>
            <FiAlertCircle className="w-3.5 h-3.5" />
          </div>
          <div className="mt-2.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide border ${theme.badge}`}>
              {priority}
            </span>
          </div>
        </div>

        {/* KPI 2: Response Complexity */}
        <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Complexity</span>
            <FiLayers className="w-3.5 h-3.5" />
          </div>
          <div className="mt-2.5">
            <div className="text-xs font-bold text-white tracking-tight">
              {theme.complexity}
            </div>
            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold block mt-0.5">
              Control Tier
            </span>
          </div>
        </div>

        {/* KPI 3: Recommended Personnel */}
        <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Personnel</span>
            <FiBriefcase className="w-3.5 h-3.5" />
          </div>
          <div className="mt-2.5">
            <div className="text-sm font-bold text-cyan-400 font-mono">
              {forecastData.officers || 0} Officers
            </div>
            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold block mt-0.5">
              Field Deployments
            </span>
          </div>
        </div>

        {/* KPI 4: Expected Delay Reduction */}
        <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Delay Reduc.</span>
            <FiTrendingDown className="w-3.5 h-3.5" />
          </div>
          <div className="mt-2.5">
            <div className="text-sm font-bold text-emerald-400 font-mono">
              {estimatedImprovement}
            </div>
            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold block mt-0.5">
              Expected Improvement
            </span>
          </div>
        </div>
      </div>

      {/* Recommended Actions */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pl-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
          Recommended Actions
        </h4>
        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
          {actions.length > 0 ? (
            actions.map((act, index) => (
              <ActionCard key={index} action={act} index={index} />
            ))
          ) : (
            <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
              No actions required.
            </div>
          )}
        </div>
      </div>

      {/* Resource Deployment */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pl-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          Resource Deployment
        </h4>
        <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl text-xs space-y-2">
          {deploymentPlan.length > 0 ? (
            deploymentPlan.map((plan, i) => (
              <div key={i} className="flex items-start gap-2 text-slate-300">
                <span className="mt-1 w-1 h-1 rounded-full bg-cyan-400 shrink-0" />
                <span className="leading-relaxed">{plan}</span>
              </div>
            ))
          ) : (
            <p className="text-slate-500 italic text-center py-1">No special resources needed.</p>
          )}
        </div>
      </div>

      {/* Diversion Route Intelligence */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pl-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Diversion Intelligence
        </h4>
        <div className="p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl space-y-3">
          {/* Primary Route */}
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider shrink-0 w-24">
              Primary Route
            </span>
            <div className="flex-1 text-right min-w-0">
              <span className="text-xs text-indigo-400 font-bold block truncate">
                {diversion.primary || "N/A"}
              </span>
            </div>
          </div>
          
          {/* Secondary Route */}
          <div className="flex items-center justify-between gap-4 text-xs border-t border-slate-900 pt-2.5">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider shrink-0 w-24">
              Secondary Route
            </span>
            <div className="flex-1 text-right min-w-0">
              <span className="text-xs text-slate-300 font-semibold block truncate">
                {diversion.secondary || "N/A"}
              </span>
            </div>
          </div>

          {/* Emergency Bypass */}
          <div className="flex items-center justify-between gap-4 text-xs border-t border-slate-900 pt-2.5">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider shrink-0 w-24">
              Emergency Route
            </span>
            <div className="flex-1 text-right min-w-0">
              <span className={`text-xs font-bold block truncate ${diversion.emergency !== "N/A" ? "text-rose-400" : "text-slate-500"}`}>
                {diversion.emergency || "N/A"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
