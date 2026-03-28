import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const client = axios.create({ baseURL });

export async function fetchSources() {
  const { data } = await client.get('/api/sources');
  return data.sources;
}

export async function fetchMetrics(params) {
  const { data } = await client.get('/api/metrics', { params });
  return data.points;
}

export async function fetchStatus() {
  const { data } = await client.get('/api/status');
  return data;
}

export async function fetchSettings() {
  const { data } = await client.get('/api/settings');
  return data;
}
