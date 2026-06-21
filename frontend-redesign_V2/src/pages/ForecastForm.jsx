import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiPlay, FiAlertTriangle } from 'react-icons/fi';
import { getCorridors, getJunctions } from '../services/api';
import SearchableSelect from '../components/SearchableSelect';

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

const ForecastForm = () => {
  const navigate = useNavigate();
  const [corridors, setCorridors] = useState([]);
  const [junctions, setJunctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [eventType, setEventType] = useState('public_event');
  const [attendance, setAttendance] = useState(2500);
  const [duration, setDuration] = useState(3);
  const [selectedCorridor, setSelectedCorridor] = useState('');
  const [selectedJunction, setSelectedJunction] = useState('');
  const [roadClosure, setRoadClosure] = useState(false);
  const [startHour, setStartHour] = useState(18);

  useEffect(() => {
    (async () => {
      try {
        const [c, j] = await Promise.all([getCorridors(), getJunctions()]);
        setCorridors(c);
        setJunctions(j);
        if (c.length) setSelectedCorridor(c[0]);
        if (j.length) setSelectedJunction(j[0]);
        setLoading(false);
      } catch (err) {
        setError('Failed to load corridors and junctions from backend API.');
        setLoading(false);
      }
    })();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedCorridor || !selectedJunction) {
      setError('Select both a corridor and a junction to run a simulation.');
      return;
    }
    setError('');
    
    const formData = {
      event_type: eventType,
      attendance: Number(attendance),
      duration_hours: Number(duration),
      corridor: selectedCorridor,
      junction: selectedJunction,
      road_closure: roadClosure,
      start_hour: Number(startHour),
    };

    localStorage.setItem('forecast_form_data', JSON.stringify(formData));
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-background">
        <div className="text-sm text-text-muted">Loading simulator components...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-primary font-display">Forecast Desk</div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-1">Predictive Simulation</h1>
        <p className="text-sm text-text-muted mt-1">
          Configure an event and generate a risk-tiered traffic forecast for the selected corridor.
        </p>
      </div>

      {error && (
        <div className="card p-3 flex items-center gap-2 border-danger/30 bg-danger-soft text-danger text-sm">
          <FiAlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="kpi-label">Event type</label>
          <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="input-field mt-1.5">
            {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="kpi-label">Start hour</label>
          <select value={startHour} onChange={(e) => setStartHour(Number(e.target.value))} className="input-field mt-1.5">
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
            ))}
          </select>
        </div>
        <div>
          <label className="kpi-label">Expected attendance</label>
          <input type="number" min="0" value={attendance} onChange={(e) => setAttendance(e.target.value)} className="input-field mt-1.5" />
        </div>
        <div>
          <label className="kpi-label">Duration (hours)</label>
          <input type="number" min="1" max="24" value={duration} onChange={(e) => setDuration(e.target.value)} className="input-field mt-1.5" />
        </div>
        <div>
          <label className="kpi-label">Corridor</label>
          <div className="mt-1.5">
            <SearchableSelect options={corridors} value={selectedCorridor} onChange={setSelectedCorridor} placeholder="Select corridor" />
          </div>
        </div>
        <div>
          <label className="kpi-label">Junction</label>
          <div className="mt-1.5">
            <SearchableSelect options={junctions} value={selectedJunction} onChange={setSelectedJunction} placeholder="Select junction" />
          </div>
        </div>
        <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-border">
          <label className="inline-flex items-center gap-2.5 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={roadClosure}
              onChange={(e) => setRoadClosure(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-primary)]"
            />
            <span className="text-sm font-medium">Road closure in effect</span>
            <span className="text-xs text-text-subtle hidden sm:inline">— forces reroutes through alternates</span>
          </label>
          <button type="submit" className="btn-primary self-start sm:self-auto">
            <FiPlay className="w-4 h-4" />
            Run Forecast
          </button>
        </div>
      </form>
    </div>
  );
};

export default ForecastForm;
