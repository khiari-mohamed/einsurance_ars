import axios from 'axios';

const AUTH_STORAGE_KEY = 'ars-auth';

function getPersistedToken() {
  try {
    const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!storedAuth) return null;

    const parsedAuth = JSON.parse(storedAuth);
    return parsedAuth?.state?.token || null;
  } catch {
    return null;
  }
}

function clearPersistedAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getPersistedToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearPersistedAuth();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
