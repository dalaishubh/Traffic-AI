import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 5000,
});

// Fallback lists in case API fails
const FALLBACK_CORRIDORS = [
  "Airport New South Road",
  "Bannerghata Road",
  "Bellary Road 1",
  "Outer Ring Road",
  "Hosur Road",
  "Richmond Road",
  "Kanakapura Road",
  "Tumkur Road"
];

const FALLBACK_JUNCTIONS = [
  "ASC Junction",
  "Agara Junction",
  "Silk Board Junction",
  "Hebbal Junction",
  "Dairy Circle Junction",
  "Tin Factory Junction",
  "Richmond Circle",
  "Koramangala Water Tank Junction"
];

export const checkBackendStatus = async () => {
  try {
    // Health check against FastAPI root endpoint
    await api.get('/', { timeout: 3000 });
    return true;
  } catch (error) {
    console.warn("Backend health check failed — backend disconnected.");
    return false;
  }
};

export const getCorridors = async () => {
  try {
    const response = await api.get('/corridors');
    return response.data;
  } catch (error) {
    console.warn("Failed to fetch corridors from API. Using fallback dataset.", error);
    return FALLBACK_CORRIDORS;
  }
};

export const getJunctions = async () => {
  try {
    const response = await api.get('/junctions');
    return response.data;
  } catch (error) {
    console.warn("Failed to fetch junctions from API. Using fallback dataset.", error);
    return FALLBACK_JUNCTIONS;
  }
};

export const getForecast = async (payload) => {
  try {
    const response = await api.post('/forecast', payload);
    return response.data;
  } catch (error) {
  console.error("Forecast API failed:", error);
  throw error;
  }
};


export const getMapJunctions = async () => {
  try {
    const response = await api.get('/junctions/live');
    return response.data;
  } catch (error) {
    console.error("Map junction API failed:", error);
    throw error;
  }
};

export const getSimulation = async (payload) => {
  try {
    const response = await api.post('/simulate', payload);
    return response.data;
  } catch (error) {
    console.error("Simulation API failed:", error);
    throw error;
  }
};

export const getTimeline = async (corridor, riskScore, delayMinutes) => {
  try {
    const response = await api.get('/timeline', {
      params: {
        corridor,
        risk_score: riskScore,
        delay_minutes: delayMinutes
      }
    });
    return response.data;
  } catch (error) {
    console.error("Timeline API failed:", error);
    throw error;
  }
};