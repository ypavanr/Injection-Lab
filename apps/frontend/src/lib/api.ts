import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:3000/api', // Pointing to the API Gateway
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach token (if any)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
