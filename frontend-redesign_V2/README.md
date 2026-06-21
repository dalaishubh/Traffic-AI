# Traffic Intelligence Platform — Frontend (Redesigned)

A professional, light/dark themed React + Vite + JSX frontend for the
Traffic Intelligence Platform. Backend contract and Axios service layer
are unchanged from the original project.

## Stack

- React 18 (JSX only — no TypeScript)
- Vite 5
- Tailwind CSS v4 (CSS-first design tokens, `darkMode: 'class'`)
- React Router v6 (`react-router-dom`)
- Axios for API
- Recharts for charts
- Framer Motion for subtle motion
- jsPDF for the forecast PDF export

## Folder structure

```
src/
  components/        UI building blocks (KPI, risk score, charts, history…)
  context/           ThemeContext (light/dark, persisted in localStorage)
  layouts/           MainLayout (top nav, theme toggle, status pill)
  pages/             LandingPage, DashboardPage, AnalyticsPage
  services/api.js    Axios client — UNCHANGED (preserves backend contract)
  index.css          Design tokens (CSS variables) + base styles
  App.jsx, main.jsx
public/              static assets (favicon)
.env                 VITE_API_BASE_URL
```

## Backend contract (unchanged)

- `GET  /corridors`
- `GET  /junctions`
- `POST /forecast` with payload
  ```json
  {
    "event_type": "", "attendance": 0, "duration_hours": 0,
    "corridor": "", "junction": "",
    "road_closure": false, "start_hour": 0
  }
  ```
  returning
  ```json
  { "score": 0, "risk": "", "delay": "", "officers": 0, "barricades": 0 }
  ```

Base URL is read from `VITE_API_BASE_URL` exactly as before.

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build
npm run preview      # preview the production build
```

Configure the API base in `.env`:
```
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Theme system

- Light / dark via the toggle in the header.
- Preference persisted in `localStorage` (`tip-theme`).
- Applied pre-paint by an inline script in `index.html` (no flash).
- All colors are semantic tokens defined in `src/index.css` and wired
  to Tailwind utilities via `tailwind.config.js`. To re-skin the app,
  only `src/index.css` needs editing.

## Notable design changes vs. the original

- Removed neon/cyberpunk styling, glow shadows, animated grids,
  and uppercase-everywhere typography.
- Single top navigation bar (no sidebar) with theme toggle and live
  backend status pill.
- Dashboard reorganised into a 5-step workflow:
  Inputs → Summary → Insights & resources → Scenario analysis → History.
- Replaced the speedometer gauge with a numerical risk score card
  showing score / tier / trend-vs-baseline + concentric ring.
- Forecast summary surfaced as 5 KPI cards (Risk score, Risk tier,
  Expected delay, Officers, Barricades).
- Scenario comparison rebuilt as two equal cards (no closure vs. with
  closure) with a delta indicator and an automatic recommendation.
- New Forecast history table (localStorage, latest 20 entries).
- Export PDF report uses `jsPDF` and renders a clean, professional
  multi-section document.
- Analytics page redesigned as an executive dashboard
  (4 KPIs / full-width trend / risk distribution + corridor rankings / map).
- Map placeholder redrawn with corridor overlays and hotspot markers
  (no radar visuals).
- Responsive layouts use grid-then-flex patterns and `min-w-0` /
  `shrink-0` / `truncate` so headers don't break on mobile.

## File-by-file change summary

- `src/services/api.js`         — unchanged
- `src/index.css`               — full token system (light/dark)
- `tailwind.config.js`          — semantic color tokens + fonts
- `src/context/ThemeContext.jsx`— new
- `src/layouts/MainLayout.jsx`  — new (top bar, no sidebar)
- `src/pages/*.jsx`             — rewritten
- `src/components/*.jsx`        — rewritten / new
  (KpiCard, RiskScoreCard, ForecastHistory added; Gauge removed)
