import { useState, useEffect, useRef } from 'react';

export default function useReplayEngine(steps = [0, 15, 30, 45, 60]) {
  const [currentMinute, setCurrentMinute] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // 1, 2, 4
  const intervalRef = useRef(null);

  // Sync current minute if steps change and it goes out of range
  const maxMinute = steps[steps.length - 1] || 60;
  useEffect(() => {
    if (currentMinute > maxMinute) {
      setCurrentMinute(0);
    }
  }, [steps, currentMinute, maxMinute]);

  const play = () => {
    if (currentMinute >= maxMinute) {
      setCurrentMinute(0);
    }
    setIsPlaying(true);
  };

  const pause = () => {
    setIsPlaying(false);
  };

  const reset = () => {
    setIsPlaying(false);
    setCurrentMinute(0);
  };

  const setMinute = (min) => {
    setCurrentMinute(min);
  };

  useEffect(() => {
    if (isPlaying) {
      const duration = 1000 / speed; // 1x = 1s, 2x = 0.5s, 4x = 0.25s per step
      intervalRef.current = setInterval(() => {
        setCurrentMinute((prev) => {
          const nextIdx = steps.indexOf(prev) + 1;
          if (nextIdx < steps.length) {
            return steps[nextIdx];
          } else {
            setIsPlaying(false);
            return prev;
          }
        });
      }, duration);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, speed, steps]);

  return {
    currentMinute,
    isPlaying,
    speed,
    play,
    pause,
    reset,
    setSpeed,
    setMinute
  };
}
