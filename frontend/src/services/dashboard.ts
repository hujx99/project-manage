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

export interface PendingPayment {
  project_name: string;
  contract_name: string;
  amount: number;
  planned_date: string;
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await fetch('/api/dashboard/summary');
  if (!res.ok) {
    throw new Error('获取仪表盘汇总失败');
  }
  return res.json();
}

export interface PaymentOverview {
  id: number;
  seq: number | null;
  phase: string | null;
  planned_amount: number;
  actual_amount: number;
  pending_amount: number;
  payment_status: string;
  planned_date: string | null;
}

export interface ContractOverview {
  id: number;
  contract_code: string;
  contract_name: string;
  vendor: string;
  amount: number;
  status: string;
  payment_count: number;
  paid_amount: number;
  pending_amount: number;
  payments: PaymentOverview[];
}

export interface ProjectOverview {
  id: number;
  project_code: string;
  project_name: string;
  status: string;
  budget: number;
  contract_count: number;
  total_contract_amount: number;
  total_pending_amount: number;
  contracts: ContractOverview[];
}

export async function fetchProjectOverview(): Promise<ProjectOverview[]> {
  const res = await fetch('/api/dashboard/project-overview');
  if (!res.ok) {
    throw new Error('获取项目总览失败');
  }
  return res.json();
}

export async function fetchPendingPayments(): Promise<PendingPayment[]> {
  const res = await fetch('/api/dashboard/pending-payments');
  if (!res.ok) {
    throw new Error('获取待付款列表失败');
  }
  return res.json();
}
