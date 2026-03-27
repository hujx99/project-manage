import client from '../api/client';
import type { Project, ProjectCreate, ProjectListResponse } from '../types';

export async function fetchProjects(params?: {
  status?: string;
  exclude_statuses?: string;
  search?: string;
  sort_field?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}): Promise<ProjectListResponse> {
  const res = await client.get('/projects', { params });
  return res.data;
}

export async function fetchProject(id: number): Promise<Project> {
  const res = await client.get(`/projects/${id}`);
  return res.data;
}

export async function createProject(data: ProjectCreate): Promise<Project> {
  const res = await client.post('/projects', data);
  return res.data;
}

export async function updateProject(id: number, data: Partial<ProjectCreate>): Promise<Project> {
  const res = await client.put(`/projects/${id}`, data);
  return res.data;
}

export async function deleteProject(id: number): Promise<void> {
  await client.delete(`/projects/${id}`);
}
