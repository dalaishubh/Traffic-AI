import React from 'react';
import { FiPlay, FiPause, FiRotateCcw } from 'react-icons/fi';

const ReplayControl = ({ isPlaying, speed, onPlay, onPause, onReset, onSpeedChange }) => {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap bg-surface-2 p-3 rounded-xl border border-border">
      {/* Playbacks */}
      <div className="flex items-center gap-2">
        {isPlaying ? (
          <button
            onClick={onPause}
            className="w-10 h-10 rounded-lg bg-warning hover:bg-warning-hover text-white flex items-center justify-center shadow-lg transition-colors cursor-pointer"
            title="Pause"
          >
            <FiPause className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={onPlay}
            className="w-10 h-10 rounded-lg bg-primary hover:bg-primary-hover text-white flex items-center justify-center shadow-lg transition-colors cursor-pointer"
            title="Play"
          >
            <FiPlay className="w-5 h-5 ml-0.5" />
          </button>
        )}

        <button
          onClick={onReset}
          className="w-10 h-10 rounded-lg bg-surface-3 border border-border hover:bg-surface-4 text-text-muted hover:text-text flex items-center justify-center transition-all cursor-pointer"
          title="Reset View"
        >
          <FiRotateCcw className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* Speed Controls */}
      <div className="flex items-center gap-1.5 bg-surface-3 p-1 rounded-lg border border-border/60">
        {[1, 2, 4].map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`px-3 py-1.5 rounded text-2xs font-bold transition-all cursor-pointer ${
              speed === s
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-subtle hover:text-text hover:bg-surface-4'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
};

export default ReplayControl;
