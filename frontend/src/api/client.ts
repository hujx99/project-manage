import axios from 'axios';

const host = window.location.hostname;
const port = window.location.port;
const protocol = window.location.protocol;
const isLocalHost = host === 'localhost' || host === '127.0.0.1';
const isLocalPreviewPort = port === '4173' || port === '5173';
const shouldUseDirectApi = isLocalHost || isLocalPreviewPort;

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || (shouldUseDirectApi ? `${protocol}//${host}:8000/api` : '/api');

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

client.interceptors.response.use(
  (response) => {
    const contentType = String(response.headers?.['content-type'] || '');
    if (typeof response.data === 'string' && contentType.includes('text/html')) {
      return Promise.reject(new Error('接口地址配置错误，或本地后端服务尚未启动'));
    }

    return response;
  },
  (error) => {
    const message =
      error?.response?.data?.message ||
      error?.response?.data?.detail ||
      '\u8bf7\u6c42\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5';
    return Promise.reject(new Error(message));
  },
);

export default client;
