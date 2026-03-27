export interface Project {
  id: number;
  project_code: string;
  project_name: string;
  project_type: string | null;
  start_date: string | null;
  status: string;
  budget: number | null;
  manager: string | null;
  remark: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  project_code: string;
  project_name: string;
  project_type?: string;
  start_date?: string;
  status: string;
  budget?: number;
  manager?: string;
  remark?: string;
}

export interface ProjectListResponse {
  total: number;
  page: number;
  page_size: number;
  items: Project[];
}

export interface ContractItem {
  id: number;
  contract_id: number;
  seq: number;
  item_name: string;
  quantity: number;
  unit: string | null;
  unit_price: number | null;
  amount: number;
}

export interface ContractItemCreate {
  seq: number;
  item_name: string;
  quantity: number;
  unit?: string;
  unit_price?: number;
  amount: number;
}

export interface Payment {
  id: number;
  contract_id: number;
  seq: number | null;
  phase: string | null;
  planned_date: string | null;
  planned_amount: number | null;
  actual_date: string | null;
  actual_amount: number | null;
  pending_amount: number | null;
  payment_status: string;
  description: string | null;
  remark: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentCreate {
  contract_id: number;
  seq?: number;
  phase?: string;
  planned_date?: string;
  planned_amount?: number;
  actual_date?: string;
  actual_amount?: number;
  payment_status: string;
  description?: string;
  remark?: string;
}

export interface ContractChange {
  id: number;
  contract_id: number;
  seq: number;
  change_date: string;
  change_info: string | null;
  before_content: string | null;
  after_content: string | null;
  change_description: string | null;
}

export interface ContractChangeCreate {
  seq: number;
  change_date: string;
  change_info?: string;
  before_content?: string;
  after_content?: string;
  change_description?: string;
}

export interface Contract {
  id: number;
  project_id: number;
  contract_code: string;
  contract_name: string;
  procurement_type: string | null;
  cost_department: string | null;
  vendor: string | null;
  amount: number;
  amount_before_change: number | null;
  sign_date: string | null;
  filing_date: string | null;
  start_date: string | null;
  end_date: string | null;
  parent_contract_code: string | null;
  renewal_type: string | null;
  payment_direction: string | null;
  status: string;
  filing_reference: string | null;
  remark: string | null;
  created_at: string;
  updated_at: string;
  items: ContractItem[];
  payments: Payment[];
  changes: ContractChange[];
  warnings?: string[];
}

export interface ContractCreate {
  project_id: number;
  contract_code: string;
  contract_name: string;
  procurement_type?: string;
  cost_department?: string;
  vendor?: string;
  amount: number;
  amount_before_change?: number;
  sign_date?: string;
  filing_date?: string;
  start_date?: string;
  end_date?: string;
  parent_contract_code?: string;
  renewal_type?: string;
  payment_direction?: string;
  status: string;
  filing_reference?: string;
  remark?: string;
  items?: ContractItemCreate[];
  payments?: PaymentCreate[];
}
