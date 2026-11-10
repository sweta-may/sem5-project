const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, '')}/api`
  : '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok && response.status !== 207) {
    const error = new Error(data.error || `HTTP error ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Dashboard & Metrics
  getDashboardStats: () => request('/dashboard/stats'),
  getHealth: () => request('/health'),

  // Hosts
  getHosts: (params = {}) => {
    const query = new URLSearchParams();
    if (params.state) query.append('state', params.state);
    if (params.search) query.append('search', params.search);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/hosts${qs}`);
  },
  getHostDetails: (hostId) => request(`/hosts/${hostId}`),
  resetHost: (hostId) => request(`/hosts/${hostId}/reset`, { method: 'POST' }),
  getFsmTable: () => request('/hosts/fsm/table'),

  // Records
  getRecords: (params = {}) => {
    const query = new URLSearchParams();
    if (params.hostId) query.append('hostId', params.hostId);
    if (params.limit) query.append('limit', params.limit);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/records${qs}`);
  },
  getInvalidRecords: (limit = 50) => request(`/records/invalid?limit=${limit}`),
  submitRecord: (rawRecord) => request('/records', { method: 'POST', body: { rawRecord } }),
  submitBatchRecords: (records) => request('/records', { method: 'POST', body: { records } }),
  validateOnly: (payload) => request('/records/validate-only', { method: 'POST', body: payload }),

  // Alerts
  getAlerts: (params = {}) => {
    const query = new URLSearchParams();
    if (params.hostId) query.append('hostId', params.hostId);
    if (params.severity) query.append('severity', params.severity);
    if (params.acknowledged !== undefined) query.append('acknowledged', params.acknowledged);
    if (params.limit) query.append('limit', params.limit);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/alerts${qs}`);
  },
  ackAlert: (alertId) => request(`/alerts/${alertId}/ack`, { method: 'PATCH' }),

  // Simulation
  getSimulationStatus: () => request('/simulation/status'),
  startSimulation: (intervalMs, mode) => request('/simulation/start', { method: 'POST', body: { intervalMs, mode } }),
  stopSimulation: () => request('/simulation/stop', { method: 'POST' }),
  tickSimulation: (hostId, mode) => request('/simulation/tick', { method: 'POST', body: { hostId, mode } }),
  configSimulation: (intervalMs, mode) => request('/simulation/config', { method: 'POST', body: { intervalMs, mode } }),
  injectScenario: (scenario, count) => request('/simulation/inject', { method: 'POST', body: { scenario, count } }),
  getSimulatedHosts: () => request('/simulation/hosts'),
  addSimulatedHost: (host) => request('/simulation/hosts', { method: 'POST', body: host })
};
