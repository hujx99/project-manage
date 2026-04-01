import axios from '../api/client';

export interface AISettings {
  provider: string;
  api_key: string;
  base_url: string;
  model: string;
}

export const fetchAISettings = () =>
  axios.get<AISettings>('/settings/ai').then((r) => r.data);

export const updateAISettings = (data: AISettings) =>
  axios.put<AISettings>('/settings/ai', data).then((r) => r.data);
