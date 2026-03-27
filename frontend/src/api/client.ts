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
      '\u8bf7\u6c42\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5';
    return Promise.reject(new Error(message));
  },
);

export default client;
