import React from "react";
import { motion } from "framer-motion";
import { 
  FiUsers, 
  FiShield, 
  FiMapPin, 
  FiVolume2, 
  FiAlertTriangle, 
  FiCheckSquare 
} from "react-icons/fi";

const getIcon = (text) => {
  const t = text.toLowerCase();
  if (t.includes("officer") || t.includes("personnel")) {
    return <FiUsers className="w-5 h-5 text-cyan-400" />;
  }
  if (t.includes("barricade") || t.includes("junction") || t.includes("block")) {
    return <FiShield className="w-5 h-5 text-amber-400" />;
  }
  if (t.includes("diversion") || t.includes("route")) {
    return <FiMapPin className="w-5 h-5 text-indigo-400" />;
  }
  if (t.includes("advisory") || t.includes("broadcast") || t.includes("signage")) {
    return <FiVolume2 className="w-5 h-5 text-emerald-400" />;
  }
  if (t.includes("escalate") || t.includes("command") || t.includes("critical")) {
    return <FiAlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />;
  }
  return <FiCheckSquare className="w-5 h-5 text-blue-400" />;
};

export default function ActionCard({ action, index }) {
  const stepNumber = String(index + 1).padStart(2, "0");
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ scale: 1.02, x: 4 }}
      className="group relative flex items-start gap-4 p-4 bg-slate-900/40 hover:bg-slate-800/50 border border-slate-800 hover:border-slate-700/80 rounded-xl transition-all duration-300 shadow-md hover:shadow-cyan-950/20"
    >
      {/* Step Number Badge */}
      <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] font-mono font-bold text-slate-400 group-hover:text-cyan-400 group-hover:border-cyan-500/30 transition-colors">
        {stepNumber}
      </div>

      {/* Icon Wrapper */}
      <div className="flex-shrink-0 mt-1 p-2 rounded-lg bg-slate-950/40 border border-slate-800/50">
        {getIcon(action)}
      </div>

      {/* Action Content */}
      <div className="flex-1 min-w-0 pr-2">
        <p className="text-xs font-semibold text-slate-100 leading-relaxed group-hover:text-white transition-colors">
          {action}
        </p>
        <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider block mt-1">
          Tactical Objective
        </span>
      </div>

      {/* Side Glow Decorator */}
      <div className="absolute left-0 top-1/4 bottom-1/4 w-[2px] bg-transparent group-hover:bg-cyan-500/50 rounded-r transition-all" />
    </motion.div>
  );
}
