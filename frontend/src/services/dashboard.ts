import client from '../api/client';

export interface DashboardSummary {
  project_count: number;
  contract_count: number;
  payment_count: number;
  total_budget: number;
  total_contract_amount: number;
  total_paid_amount: number;
  total_pending_amount: number;
  project_status_distribution: Array<{ status: string; count: number }>;
}

export interface DashboardWorkflowSummary {
  project_stage: {
    total: number;
    active_count: number;
    closed_count: number;
    linked_count: number;
    unlinked_count: number;
  };
  contract_stage: {
    total: number;
    active_count: number;
    archived_count: number;
    without_payment_count: number;
    warning_count: number;
  };
  payment_stage: {
    total: number;
    unpaid_count: number;
    submitted_count: number;
    paid_count: number;
    overdue_count: number;
    due_soon_count: number;
  };
}

export interface PendingPayment {
  id: number;
  project_name: string;
  contract_name: string;
  amount: number;
  planned_date: string | null;
  payment_status: string;
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const response = await client.get('/dashboard/summary');
  return response.data;
}

export async function fetchDashboardWorkflow(): Promise<DashboardWorkflowSummary> {
  const response = await client.get('/dashboard/workflow');
  return response.data;
}

export async function fetchPendingPayments(): Promise<PendingPayment[]> {
  const response = await client.get('/dashboard/pending-payments');
  return response.data;
}
