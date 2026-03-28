import client from '../api/client';
import type { Project, ProjectCreate, ProjectListResponse } from '../types';

const PROJECT_PAGE_SIZE_LIMIT = 100;

export interface FetchProjectsParams {
  status?: string;
  exclude_statuses?: string;
  search?: string;
  sort_field?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

export async function fetchProjects(params?: FetchProjectsParams): Promise<ProjectListResponse> {
  const res = await client.get('/projects', { params });
  return res.data;
}

export async function fetchAllProjects(params?: Omit<FetchProjectsParams, 'page' | 'page_size'>): Promise<Project[]> {
  const items: Project[] = [];
  let page = 1;
  let total = 0;

  do {
    const result = await fetchProjects({
      ...params,
      page,
      page_size: PROJECT_PAGE_SIZE_LIMIT,
    });

    items.push(...result.items);
    total = result.total;
    page += 1;
  } while (items.length < total);

  return items;
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
