import axios from 'axios';

export const API_BASE_URL =
  window.location.hostname === 'localhost' && window.location.port === '5173'
    ? 'http://localhost:8000/api'
    : '/api';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error?.response?.data?.message ||
      error?.response?.data?.detail ||
      '请求失败，请稍后重试';
    return Promise.reject(new Error(message));
  },
);

export default client;
