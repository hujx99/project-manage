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

export interface DashboardAnalysis {
  financial_health: {
    total_budget: number;
    total_contract_amount: number;
    total_paid_amount: number;
    total_pending_amount: number;
    budget_usage_rate: number;
    payment_execution_rate: number;
    pending_pressure_rate: number;
    uncontracted_budget: number;
  };
  coverage: {
    project_contract_link_rate: number;
    contract_payment_plan_rate: number;
    payment_overdue_rate: number;
    closed_project_rate: number;
  };
  funnel: {
    project_total: number;
    active_project_count: number;
    projects_with_contracts: number;
    projects_without_contracts: number;
    contract_total: number;
    active_contract_count: number;
    contracts_with_payment_plans: number;
    contracts_without_payment_plans: number;
    payment_total: number;
    paid_payment_count: number;
    submitted_payment_count: number;
    unpaid_payment_count: number;
  };
  project_status_distribution: Array<{ status: string; count: number }>;
  contract_status_distribution: Array<{ status: string; count: number }>;
  payment_due_buckets: Array<{ key: string; label: string; count: number; amount: number }>;
  payment_risk: {
    overdue_count: number;
    overdue_amount: number;
    due_soon_count: number;
    due_soon_amount: number;
  };
  manager_load: Array<{
    manager: string;
    project_count: number;
    active_project_count: number;
    unlinked_project_count: number;
    budget_total: number;
    contract_total: number;
    pending_total: number;
  }>;
  vendor_concentration: Array<{
    vendor: string;
    contract_count: number;
    active_contract_count: number;
    amount_total: number;
    pending_total: number;
  }>;
  top_risk_projects: Array<{
    project_id: number;
    project_name: string;
    manager: string;
    status: string;
    contract_count: number;
    contract_total: number;
    pending_total: number;
    overdue_count: number;
    due_soon_count: number;
    risk_score: number;
  }>;
  priority_payments: Array<{
    id: number;
    project_name: string;
    contract_name: string;
    manager: string;
    amount: number;
    planned_date: string | null;
    payment_status: string;
    diff_days: number;
  }>;
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

export async function fetchDashboardAnalysis(): Promise<DashboardAnalysis> {
  const response = await client.get('/dashboard/analysis');
  return response.data;
}
