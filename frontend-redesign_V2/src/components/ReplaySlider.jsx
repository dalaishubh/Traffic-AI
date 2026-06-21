import React from 'react';

const ReplaySlider = ({ currentMinute, onMinuteChange, steps = [0, 15, 30, 45, 60] }) => {
  const maxMinute = steps[steps.length - 1];

  const handleSliderChange = (val) => {
    // Snap slider value to the closest step in steps array
    const closest = steps.reduce((prev, curr) =>
      Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev
    );
    onMinuteChange(closest);
  };

  return (
    <div className="space-y-3 bg-surface-2 p-4 rounded-xl border border-border">
      <div className="flex items-center justify-between text-2xs font-mono text-text-subtle font-semibold uppercase">
        <span>Timeline Range</span>
        <span className="text-primary font-bold">{String(currentMinute).padStart(2, '0')} min</span>
      </div>

      {/* Range Input slider */}
      <div className="relative pt-1">
        <input
          type="range"
          min="0"
          max={maxMinute}
          value={currentMinute}
          onChange={(e) => handleSliderChange(Number(e.target.value))}
          className="w-full h-1.5 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
        />

        {/* Labels / Tick points */}
        <div className="flex justify-between mt-2 px-1 text-2xs font-mono font-bold text-text-muted">
          {steps.map((step) => (
            <button
              key={step}
              onClick={() => onMinuteChange(step)}
              className={`transition-colors hover:text-text cursor-pointer ${
                currentMinute === step ? 'text-primary font-extrabold scale-110' : ''
              }`}
            >
              {String(step).padStart(2, '0')}m
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReplaySlider;
