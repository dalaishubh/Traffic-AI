import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiDownload, FiAlertTriangle, FiShield, FiClock, FiUsers, FiMapPin } from 'react-icons/fi';
import jsPDF from 'jspdf';

import ChatButton from "../components/chat/ChatButton";
import ChatWindow from "../components/chat/ChatWindow";
import { getForecast, getTimeline } from '../services/api';
import TimelineView from '../components/TimelineView';
import useReplayEngine from '../hooks/useReplayEngine';
import ReplayControl from '../components/ReplayControl';
import ReplaySlider from '../components/ReplaySlider';
import ReplayLegend from '../components/ReplayLegend';

import RiskScoreCard, { tierStyle } from '../components/RiskScoreCard';
import KpiCard from '../components/KpiCard';
import ResourceChart from '../components/ResourceChart';
import ScenarioComparison from '../components/ScenarioComparison';
import InsightCards from '../components/InsightCards';
import ForecastHistory from '../components/ForecastHistory';

const EVENT_TYPES = [
  { value: 'political_rally', label: 'Political Rally' },
  { value: 'procession', label: 'Procession' },
  { value: 'protest', label: 'Protest' },
  { value: 'vip_movement', label: 'VIP Movement' },
  { value: 'public_event', label: 'Public Gathering / Event' },
  { value: 'construction', label: 'Road Construction' },
  { value: 'accident', label: 'Road Accident' },
  { value: 'water_logging', label: 'Water Logging' },
  { value: 'vehicle_breakdown', label: 'Vehicle Breakdown' },
];

const eventLabel = (v) => (EVENT_TYPES.find((e) => e.value === v) || {}).label || v;

const HISTORY_KEY = 'tip-forecast-history';
const HISTORY_LIMIT = 20;

const loadHistory = () => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};
const saveHistory = (entries) => {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(entries)); } catch { }
};

const SectionTitle = ({ eyebrow, title, description }) => (
  <div className="mb-4">
    <div className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</div>
    <h2 className="font-display text-xl font-bold tracking-tight mt-1">{title}</h2>
    {description && <p className="text-sm text-text-muted mt-1">{description}</p>}
  </div>
);

const DashboardPage = () => {
  const navigate = useNavigate();
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chatOpen, setChatOpen] = useState(false);

  const [inputParams, setInputParams] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [scenarioA, setScenarioA] = useState(null);
  const [scenarioB, setScenarioB] = useState(null);
  const [history, setHistory] = useState(loadHistory);

  const [timelineData, setTimelineData] = useState(null);
  const [peakMin, setPeakMin] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [loadingTimeline, setLoadingTimeline] = useState(true);

  const timelineSteps = timelineData ? timelineData.map(item => item.minute) : [0, 15, 30, 45, 60];

  const {
    currentMinute,
    isPlaying,
    speed,
    play,
    pause,
    reset,
    setSpeed,
    setMinute
  } = useReplayEngine(timelineSteps);

  useEffect(() => {
    const formDataStr = localStorage.getItem('forecast_form_data');
    if (!formDataStr) {
      navigate('/forecast');
      return;
    }
    
    setHasData(true);
    const parsedFormData = JSON.parse(formDataStr);
    setInputParams(parsedFormData);
    
    (async () => {
      try {
        setLoading(true);
        setError('');
        
        // 1. Fetch primary forecast
        const data = await getForecast(parsedFormData);
        setForecastData(data);
        localStorage.setItem('forecast_result', JSON.stringify(data));
        
        // 2. Fetch scenario variations
        const [a, b] = await Promise.all([
          getForecast({ ...parsedFormData, road_closure: false }),
          getForecast({ ...parsedFormData, road_closure: true }),
        ]);
        setScenarioA(a);
        setScenarioB(b);

        // 3. Fetch timeline details
        const timelineRes = await getTimeline(
          data.incident_location.corridor,
          data.score,
          data.traffic_clearance_min
        );
        
        setTimelineData(timelineRes.timeline);
        setPeakMin(timelineRes.peak_congestion_minutes);
        setConfidence(timelineRes.confidence_pct);

        // 4. Update history
        const entry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: new Date().toLocaleString(),
          eventLabel: eventLabel(parsedFormData.event_type),
          junction: parsedFormData.junction,
          score: data.score,
          risk: data.risk,
          delay: data.delay,
        };
        const next = [entry, ...loadHistory()].slice(0, HISTORY_LIMIT);
        setHistory(next);
        saveHistory(next);

        setLoadingTimeline(false);
        setLoading(false);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
        setError('Failed to calculate forecast metrics. Simulation engine offline.');
        setLoadingTimeline(false);
        setLoading(false);
      }
    })();
  }, [navigate]);

  // Broadcast replay state changes to Leaflet iframe map
  useEffect(() => {
    const iframe = document.getElementById('mapIframe');
    if (iframe && iframe.contentWindow && timelineData) {
      iframe.contentWindow.postMessage({
        type: 'REPLAY_UPDATE',
        minute: currentMinute,
        timeline: timelineData
      }, '*');
    }
  }, [currentMinute, timelineData]);

  const handleReset = () => {
    reset();
    const iframe = document.getElementById('mapIframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'REPLAY_RESET' }, '*');
    }
  };

  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  const handleExportPdf = () => {
    if (!forecastData || !inputParams) return;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const left = 48;
    let y = 56;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
    doc.text('Urban Traffic Digital Twin', left, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(110);
    y += 18; doc.text('Forecast report', left, y);
    y += 14; doc.text(`Generated: ${new Date().toLocaleString()}`, left, y);

    doc.setDrawColor(220); doc.line(left, y + 10, pageW - left, y + 10);
    y += 32; doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('Event details', left, y);

    const details = [
      ['Event type', eventLabel(inputParams.event_type)],
      ['Start hour', `${String(inputParams.start_hour).padStart(2, '0')}:00`],
      ['Duration', `${inputParams.duration_hours} hour(s)`],
      ['Attendance', Number(inputParams.attendance).toLocaleString()],
      ['Corridor', inputParams.corridor],
      ['Junction', inputParams.junction],
      ['Road closure', inputParams.road_closure ? 'Active' : 'Not in effect'],
    ];
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    y += 16;
    details.forEach(([k, v]) => {
      doc.setTextColor(110); doc.text(k, left, y);
      doc.setTextColor(20); doc.text(String(v), left + 130, y);
      y += 16;
    });

    y += 12; doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('Forecast summary', left, y);
    y += 6; doc.setDrawColor(230); doc.line(left, y + 4, pageW - left, y + 4);
    y += 22;

    const kpis = [
      ['Risk score', `${forecastData.score.toFixed(1)} / 100`],
      ['Risk tier', forecastData.risk + (forecastData.confidence !== null ? ` (${forecastData.confidence}% confidence)` : '')],
      ['Expected delay', `${forecastData.delay} minutes`],
      ['Closure probability', `${forecastData.ml_closure_probability}%`],
      ['Officers required', String(forecastData.officers)],
      ['Barricades required', String(forecastData.barricades)],
    ];
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    kpis.forEach(([k, v]) => {
      doc.setTextColor(110); doc.text(k, left, y);
      doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.text(String(v), left + 180, y);
      doc.setFont('helvetica', 'normal');
      y += 16;
    });

    if (scenarioA && scenarioB) {
      y += 14; doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
      doc.text('Scenario comparison', left, y);
      y += 22; doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
      doc.setTextColor(110); doc.text('Without closure', left, y); doc.text('With closure', left + 220, y);
      y += 16; doc.setTextColor(20);
      doc.text(`Score: ${scenarioA.score.toFixed(1)} (${scenarioA.risk})`, left, y);
      doc.text(`Score: ${scenarioB.score.toFixed(1)} (${scenarioB.risk})`, left + 220, y);
      y += 14;
      doc.text(`Delay: ${scenarioA.delay} min`, left, y);
      doc.text(`Delay: ${scenarioB.delay} min`, left + 220, y);
    }

    doc.setFontSize(9); doc.setTextColor(140);
    doc.text(
      'Urban Traffic Digital Twin · operational decision support',
      left, doc.internal.pageSize.getHeight() - 28
    );

    doc.save(`forecast-${inputParams.junction.replace(/\s+/g, '-')}-${Date.now()}.pdf`);
  };

  if (!hasData) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-background">
        <div className="text-sm text-text-muted">Loading digital twin...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-background">
        <div className="text-sm text-text-muted flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Running forecast simulation and building digital twin map...
        </div>
      </div>
    );
  }

  const ready = !!forecastData;
  const rs = ready ? tierStyle(forecastData.risk) : null;
  const tierTone = ready ? rs.fg.replace('text-', '') : 'default';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10 text-slate-200">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">Forecast desk</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-1 text-white">Predictive simulation</h1>
          <p className="text-sm text-text-muted mt-1">
            Simulated forecast results for <span className="font-semibold text-text">{inputParams?.corridor}</span> (Junction: {inputParams?.junction}).
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => navigate('/forecast')}
            className="btn-secondary flex items-center gap-2 text-xs py-2 px-3 cursor-pointer"
          >
            <FiArrowLeft className="w-4 h-4" />
            Edit Parameters
          </button>
          <button
            onClick={handleExportPdf}
            disabled={!ready}
            className="btn-secondary disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 text-xs py-2 px-3 cursor-pointer"
          >
            <FiDownload className="w-4 h-4" />
            Export PDF report
          </button>
        </div>
      </div>

      {error && (
        <div className="card p-3 flex items-center gap-2 border-danger/30 bg-danger-soft text-danger text-sm">
          <FiAlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Interactive Spatial Twin & Sidebar Control Center */}
      <section className="space-y-4">
        <SectionTitle
          eyebrow="Operations Map"
          title="Disruption Timeline & Propagation Layers"
          description="Observe structural delays propagating dynamically through secondary alternate corridors."
        />
        
        <div className="flex flex-col lg:flex-row w-full h-[650px] border border-border bg-surface rounded-xl overflow-hidden shadow-2xl">
          {/* Map iframe container */}
          <div className="flex-1 h-full bg-slate-950 min-h-[300px]">
            <iframe
              id="mapIframe"
              src={`/gridlock_dashboard.html?hide_sidebar=true&ors_key=${encodeURIComponent(import.meta.env.VITE_ORS_API_KEY || '')}`}
              className="w-full h-full border-none"
              title="Gridlock Operations Dashboard"
            />
          </div>

          {/* Sidebar Control Center */}
          <div className="w-full lg:w-[440px] h-full border-t lg:border-t-0 lg:border-l border-border bg-surface flex flex-col shrink-0 p-5 overflow-hidden">
            <h2 className="font-display font-bold text-base tracking-tight mb-1 flex items-center gap-2 text-white">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              Disruption Timeline & Propagation Layers
            </h2>
            <p className="text-2xs text-text-subtle mb-4 border-b border-border pb-3">
              Observe structural delays propagating dynamically through secondary alternate corridors.
            </p>

            {loadingTimeline ? (
              <div className="flex-1 flex items-center justify-center text-xs text-text-muted">
                Analyzing traffic propagation layers...
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-1">
                <div className="space-y-6">
                  {/* Attached Timeline View & KPIs */}
                  <div className="space-y-3">
                    <h3 className="font-display font-bold text-xs text-text-muted uppercase tracking-wider">
                      Disruption Timeline
                    </h3>
                    <TimelineView
                      timelineData={timelineData}
                      peakMin={peakMin}
                      confidence={confidence}
                    />
                  </div>

                  <div className="space-y-4 pt-4 border-t border-border">
                    <h3 className="font-display font-bold text-sm tracking-tight flex items-center gap-2 text-text">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                      Digital Twin Replay
                    </h3>
                    
                    {/* Replay Controls */}
                    <ReplayControl
                      isPlaying={isPlaying}
                      speed={speed}
                      onPlay={play}
                      onPause={pause}
                      onReset={handleReset}
                      onSpeedChange={setSpeed}
                    />
                    
                    {/* Replay Slider */}
                    <ReplaySlider
                      currentMinute={currentMinute}
                      onMinuteChange={setMinute}
                      steps={timelineSteps}
                    />

                    {/* Replay Legend */}
                    <ReplayLegend />

                    {/* Summary Panel */}
                    <div className="card p-4 bg-surface-dark border-l-4 border-l-cyan-500 space-y-2">
                      <h4 className="font-display font-bold text-xs uppercase tracking-wider text-text-muted border-b border-border pb-1">
                        Replay Summary Panel
                      </h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-2xs">
                        <div>
                          <span className="text-text-subtle block">Current Stage:</span>
                          <span className="font-semibold text-text truncate block max-w-full" title={timelineData?.find(item => item.minute === currentMinute)?.title || 'Incident Start'}>
                            {timelineData?.find(item => item.minute === currentMinute)?.title || 'Incident Start'}
                          </span>
                        </div>
                        <div>
                          <span className="text-text-subtle block">Replay Time:</span>
                          <span className="font-semibold text-cyan-400 font-mono">{currentMinute} Min</span>
                        </div>
                        <div>
                          <span className="text-text-subtle block">Affected Corridors:</span>
                          <span className="font-semibold text-text">
                            {new Set(timelineData?.filter(item => item.minute <= currentMinute).map(item => item.corridor)).size}
                          </span>
                        </div>
                        <div>
                          <span className="text-text-subtle block">Max Impact:</span>
                          <span className="font-semibold text-danger font-mono">
                            {timelineData?.filter(item => item.minute <= currentMinute).length > 0
                              ? Math.max(...timelineData.filter(item => item.minute <= currentMinute).map(item => item.impact_pct))
                              : 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Incident Summary & Analytics Cards Grid Row */}
        {forecastData && inputParams && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
            {/* Card 1: Incident Summary */}
            <div className="card p-5 space-y-4">
              <h3 className="font-display font-bold text-sm text-white border-b border-border pb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Incident Summary
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between border-b border-border/30 pb-2">
                  <span className="text-text-subtle font-medium">Event:</span>
                  <span className="font-semibold text-text uppercase font-mono">{eventLabel(inputParams.event_type)}</span>
                </div>
                <div className="flex justify-between items-center border-b border-border/30 pb-2">
                  <span className="text-text-subtle font-medium">Risk level:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold font-mono ${
                    forecastData.risk === 'Critical' ? 'bg-danger-soft text-danger' :
                    forecastData.risk === 'High' ? 'bg-warning-soft text-warning' :
                    forecastData.risk === 'Medium' ? 'bg-warning-soft text-warning' :
                    'bg-success-soft text-success'
                  }`}>
                    {forecastData.risk}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border/30 pb-2">
                  <span className="text-text-subtle font-medium">Score:</span>
                  <span className="font-semibold text-text font-mono">{forecastData.score.toFixed(1)}</span>
                </div>
                <div className="flex justify-between border-b border-border/30 pb-2">
                  <span className="text-text-subtle font-medium">Duration:</span>
                  <span className="font-semibold text-text font-mono">{inputParams.duration_hours} Hours</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-subtle font-medium">Clearance:</span>
                  <span className="font-semibold text-text font-mono">{forecastData.traffic_clearance_min} Minutes</span>
                </div>
              </div>
            </div>

            {/* Card 2: KPI Cards */}
            <div className="card p-5 space-y-4">
              <h3 className="font-display font-bold text-sm text-white border-b border-border pb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                KPI Cards
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-surface-2 p-3 rounded-lg border border-border flex flex-col justify-between">
                  <div className="text-text-subtle font-medium text-[10px] uppercase tracking-wider">Affected</div>
                  <div className="text-xl font-bold mt-1 text-white font-mono">{forecastData.affected_corridors?.length || 0}</div>
                </div>
                <div className="bg-surface-2 p-3 rounded-lg border border-border flex flex-col justify-between">
                  <div className="text-text-subtle font-medium text-[10px] uppercase tracking-wider">Max Delay</div>
                  <div className="text-xl font-bold mt-1 text-white font-mono">
                    {forecastData.affected_corridors && forecastData.affected_corridors.length > 0 
                      ? `${Math.max(...forecastData.affected_corridors.map(c => c.delay_min))}m` 
                      : '0m'}
                  </div>
                </div>
                <div className="bg-surface-2 p-3 rounded-lg border border-border flex flex-col justify-between">
                  <div className="text-text-subtle font-medium text-[10px] uppercase tracking-wider">Officers</div>
                  <div className="text-xl font-bold mt-1 text-white font-mono">{forecastData.officers}</div>
                </div>
                <div className="bg-surface-2 p-3 rounded-lg border border-border flex flex-col justify-between">
                  <div className="text-text-subtle font-medium text-[10px] uppercase tracking-wider">Barricades</div>
                  <div className="text-xl font-bold mt-1 text-white font-mono">{forecastData.barricades}</div>
                </div>
              </div>
            </div>

            {/* Card 3: Risk Score */}
            <div className="card p-5 space-y-4">
              <h3 className="font-display font-bold text-sm text-white border-b border-border pb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                Risk Score
              </h3>
              <div className="space-y-4 pt-1">
                <div className="w-full bg-surface-2 rounded-full h-3 overflow-hidden border border-border">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      forecastData.score >= 80 ? 'bg-danger' :
                      forecastData.score >= 60 ? 'bg-warning' :
                      forecastData.score >= 30 ? 'bg-yellow-500' : 'bg-success'
                    }`}
                    style={{ width: `${forecastData.score}%` }}
                  />
                </div>
                <p className="text-sm font-bold text-center text-text font-mono">
                  Score: {forecastData.score.toFixed(1)} / 100
                </p>
              </div>
            </div>

            {/* Card 4: Diversion Recommendations */}
            <div className="card p-5 space-y-4">
              <h3 className="font-display font-bold text-sm text-white border-b border-border pb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Diversion Recommendations
              </h3>
              <div className="max-h-[160px] overflow-y-auto pr-1">
                {forecastData.diversion_routes && forecastData.diversion_routes.length > 0 ? (
                  <ul className="space-y-2 text-xs">
                    {forecastData.diversion_routes.map((route, idx) => (
                      <li key={idx} className="flex items-start gap-2 bg-surface-2 p-2.5 rounded border border-border">
                        <span className="w-4 h-4 rounded-full bg-primary-soft text-primary font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-mono">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-text-muted">{route.route_name}</div>
                          <div className="text-[10px] text-text-subtle font-medium mt-0.5">via {route.corridor}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-text-muted italic py-6 text-center">
                    No diversion plan required.
                  </div>
                )}
              </div>
            </div>

            {/* Card 5: Affected Corridors */}
            <div className="card p-5 space-y-4">
              <h3 className="font-display font-bold text-sm text-white border-b border-border pb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                Affected Corridors
              </h3>
              <div className="max-h-[160px] overflow-y-auto pr-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border text-[10px] uppercase tracking-wider text-text-subtle">
                      <th className="pb-1.5 font-bold">Corridor</th>
                      <th className="pb-1.5 font-bold text-right">Delay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecastData.affected_corridors && forecastData.affected_corridors.map((c, idx) => (
                      <tr key={idx} className="border-b border-border/30 last:border-b-0">
                        <td className="py-2.5 text-text font-medium">{c.corridor}</td>
                        <td className="py-2.5 text-text-muted text-right font-mono font-bold">{c.delay_min}m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Card 6: OpenRouteService */}
            <div className="card p-5 space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="font-display font-bold text-sm text-white border-b border-border pb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                  OpenRouteService
                </h3>
                <div className="mt-3 flex items-center gap-2 text-xs text-success font-semibold">
                  <span className="w-2 h-2 rounded-full bg-success animate-ping" />
                  Key Configuration Loaded
                </div>
                <p className="text-xs text-text-subtle mt-2 leading-relaxed">
                  Dynamic routing API keys are initialized. Secondary routing and alternate path calculations are active.
                </p>
              </div>
              <div className="text-[10px] text-text-subtle bg-surface-2 p-2 rounded border border-border text-center font-mono">
                API Key: {import.meta.env.VITE_ORS_API_KEY ? '••••••••' + import.meta.env.VITE_ORS_API_KEY.slice(-4) : 'DEFAULT'}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 2. Forecast Summary */}
      <section>
        <SectionTitle eyebrow="Step 1" title="Forecast summary" description="Unified predictive metrics and resource planning for the simulated configuration." />
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-5"
        >
          <div className="lg:col-span-1">
            <RiskScoreCard score={forecastData.score} risk={forecastData.risk} />
          </div>
          <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-5">
            <KpiCard 
              label="Risk tier" 
              value={forecastData.risk} 
              sublabel={forecastData.confidence !== null ? `${forecastData.confidence}% confidence` : "Digital twin estimate"} 
              icon={FiShield} 
              tone={tierTone} 
            />
            <KpiCard 
              label="Expected delay" 
              value={`${forecastData.delay} min`} 
              sublabel="Per transit segment" 
              icon={FiClock} 
            />
            <KpiCard 
              label="Closure probability" 
              value={`${forecastData.ml_closure_probability}%`} 
              sublabel="Ensemble model" 
              icon={FiAlertTriangle} 
              tone="danger"
            />
            <KpiCard 
              label="Officers required" 
              value={forecastData.officers} 
              sublabel="Recommended deployment" 
              icon={FiUsers} 
              tone="primary" 
            />
            <KpiCard 
              label="Barricades required" 
              value={forecastData.barricades} 
              sublabel="Recommended units" 
              icon={FiMapPin} 
              tone="warning" 
            />
          </div>
        </motion.div>
      </section>

      {/* 4. Insights & resources */}
      <section>
        <SectionTitle eyebrow="Step 2" title="Operational insights & resource planning" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2"><InsightCards forecast={forecastData} inputData={inputParams} /></div>
          <ResourceChart officers={forecastData.officers} barricades={forecastData.barricades} />
        </div>
      </section>

      {/* 5. Corridor impact & diversion plan */}
      <section>
        <SectionTitle eyebrow="Step 3" title="Corridor impact & diversion plan" description="Predicted secondary corridor delays and optimal rerouting pathways." />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Affected Corridors */}
          <div className="lg:col-span-2 card p-5">
            <h3 className="font-semibold text-[15px] text-white">Predicted Corridor Impact</h3>
            <p className="text-xs text-text-subtle mt-0.5">Estimated delays cascading to surrounding corridors.</p>
            <div className="mt-4 space-y-4">
              {forecastData.affected_corridors && forecastData.affected_corridors.map((c, idx) => {
                const level = c.risk_level || 'Low';
                const labelStyle =
                  level === 'Critical' ? 'bg-danger-soft text-danger' :
                    level === 'High' ? 'bg-warning-soft text-warning' :
                      level === 'Medium' ? 'bg-warning-soft text-warning' :
                        'bg-success-soft text-success';

                const barStyle =
                  level === 'Critical' ? 'bg-[var(--color-danger)]' :
                    level === 'High' ? 'bg-[var(--color-warning)]' :
                      level === 'Medium' ? 'bg-[var(--color-warning)]' :
                        'bg-[var(--color-success)]';

                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-text-muted">{c.corridor}</span>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${labelStyle}`}>
                          {level}
                        </span>
                        <span className="font-bold text-text-muted">{c.delay_min} min delay</span>
                      </div>
                    </div>
                    <div className="w-full bg-surface-2 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barStyle}`}
                        style={{ width: `${c.impact_pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Diversion Routes */}
          <div className="card p-5">
            <h3 className="font-semibold text-[15px] text-white">Traffic Diversion Routes</h3>
            <p className="text-xs text-text-subtle mt-0.5">Alternative pathways to bypass primary congestion.</p>
            <div className="mt-4 space-y-2.5">
              {forecastData.diversion_routes && forecastData.diversion_routes.length > 0 ? (
                forecastData.diversion_routes.map((route, idx) => {
                  return (
                    <div key={idx} className="border border-border rounded-lg p-3 bg-surface-2 flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded bg-primary-soft text-primary font-semibold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-text-muted">{route.route_name}</div>
                        <div className="text-sm font-medium mt-0.5">via {route.corridor}</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-text-muted italic py-4 text-center">
                  No diversion plan required for low-risk scenarios.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 6. Scenario comparison */}
      <section>
        <SectionTitle eyebrow="Step 4" title="Scenario analysis" description="Compare outcomes with and without road closure to support the decision." />
        <ScenarioComparison scenarioA={scenarioA} scenarioB={scenarioB} />
      </section>

      {/* 8. History */}
      <section>
        <SectionTitle eyebrow="Step 5" title="Forecast history" description="Recent simulations are stored on this device. Latest 20 entries kept." />
        <ForecastHistory entries={history} onClear={clearHistory} />
      </section>

      {/* Floating chatbot assistant integration */}
      <div className="fixed bottom-6 right-6 z-50">
        <ChatButton onClick={() => setChatOpen(!chatOpen)} isOpen={chatOpen} />
        {chatOpen && <ChatWindow onClose={() => setChatOpen(false)} />}
      </div>
    </div>
  );
};

export default DashboardPage;
