import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Default base URL. We fall back to the live Render backend URL so the app works immediately out-of-the-box!
// For local emulator backend, use http://10.0.2.2:8000 (Android) or http://localhost:8000 (iOS Simulator).
export const DEFAULT_BASE_URL = 'https://traffic-intelligence-system.onrender.com';

const API_URL_KEY = 'traffic-ai-api-base-url';

export const getApiBaseUrl = async () => {
  try {
    const stored = await AsyncStorage.getItem(API_URL_KEY);
    return stored || DEFAULT_BASE_URL;
  } catch {
    return DEFAULT_BASE_URL;
  }
};

export const setApiBaseUrl = async (url) => {
  try {
    await AsyncStorage.setItem(API_URL_KEY, url);
    // Reconfigure axios instance baseURL
    api.defaults.baseURL = url;
    return true;
  } catch {
    return false;
  }
};

const api = axios.create({
  baseURL: DEFAULT_BASE_URL,
  timeout: 60000, // 60 seconds for slow Render cold-starts and ML models
});

// Initialize baseURL from storage asynchronously
getApiBaseUrl().then((url) => {
  api.defaults.baseURL = url;
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
    const baseUrl = await getApiBaseUrl();
    await axios.get(baseUrl, { timeout: 3000 });
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

export default api;
