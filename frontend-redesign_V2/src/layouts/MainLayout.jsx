import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { FiMoon, FiSun } from 'react-icons/fi';
import { checkBackendStatus } from '../services/api';
import { useTheme } from '../context/ThemeContext';

const MainLayout = () => {
  const { theme, toggleTheme } = useTheme();
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    let mounted = true;
    const ping = async () => {
      const status = await checkBackendStatus();
      if (mounted) setIsOnline(status);
    };
    ping();
    const id = setInterval(ping, 30000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const nav = [
    { name: 'Overview', to: '/' },
    { name: 'Forecast', to: '/forecast' },
    { name: 'Analytics', to: '/analytics' },
    { name: 'Map', to: '/map' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-text">
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 grid grid-cols-[minmax(0,1fr)_auto] sm:flex sm:items-center sm:justify-between items-center gap-4">
          <Link to="/" className="flex min-w-0 items-center gap-2.5 shrink-0">
            <img src="/logo.jpg" alt="Traffic-AI Logo" className="w-8 h-8 rounded-md object-cover shrink-0" />
            <span className="font-display font-bold text-[15px] tracking-tight truncate">
              Urban Traffic Digital Twin
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive
                    ? 'text-primary bg-primary-soft'
                    : 'text-text-muted hover:text-text hover:bg-surface-2'
                  }`
                }
              >
                {item.name}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${isOnline
                  ? 'border-success/30 text-success bg-success-soft'
                  : 'border-danger/30 text-danger bg-danger-soft'
                }`}
              title={isOnline ? 'Backend API reachable' : 'Backend unreachable'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-success' : 'bg-danger'}`} />
              {isOnline ? 'Backend Connected' : 'Backend Disconnected'}
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="w-9 h-9 inline-flex items-center justify-center rounded-md border border-border text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
            >
              {theme === 'dark' ? <FiSun className="w-4 h-4" /> : <FiMoon className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="md:hidden border-t border-border px-3 py-2 flex items-center gap-1 overflow-x-auto">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap ${isActive ? 'text-primary bg-primary-soft' : 'text-text-muted'
                }`
              }
            >
              {item.name}
            </NavLink>
          ))}
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border py-5 text-center text-xs text-text-subtle px-4">
        Urban Traffic Digital Twin · Operational decision support for urban mobility
      </footer>
    </div>
  );
};

export default MainLayout;
