import client from '../api/client';
import type {
  Contract,
  ContractCreate,
  ContractItem,
  ContractItemCreate,
  ContractChange,
  ContractChangeCreate,
} from '../types';

export async function fetchContracts(): Promise<Contract[]> {
  const res = await client.get('/contracts');
  return res.data;
}

export async function fetchContract(id: number): Promise<Contract> {
  const res = await client.get(`/contracts/${id}`);
  return res.data;
}

export async function createContract(data: ContractCreate): Promise<Contract> {
  const res = await client.post('/contracts', data);
  return res.data;
}

export async function updateContract(id: number, data: Partial<ContractCreate>): Promise<Contract> {
  const res = await client.put(`/contracts/${id}`, data);
  return res.data;
}

export async function deleteContract(id: number): Promise<void> {
  await client.delete(`/contracts/${id}`);
}

// Contract Items
export async function createContractItem(contractId: number, data: ContractItemCreate): Promise<ContractItem> {
  const res = await client.post(`/contracts/${contractId}/items`, data);
  return res.data;
}

export async function updateContractItem(
  contractId: number,
  itemId: number,
  data: Partial<ContractItemCreate>,
): Promise<ContractItem> {
  const res = await client.put(`/contracts/${contractId}/items/${itemId}`, data);
  return res.data;
}

export async function deleteContractItem(contractId: number, itemId: number): Promise<void> {
  await client.delete(`/contracts/${contractId}/items/${itemId}`);
}

// Contract Changes
export async function createContractChange(contractId: number, data: ContractChangeCreate): Promise<ContractChange> {
  const res = await client.post(`/contracts/${contractId}/changes`, data);
  return res.data;
}

export async function updateContractChange(
  contractId: number,
  changeId: number,
  data: Partial<ContractChangeCreate>,
): Promise<ContractChange> {
  const res = await client.put(`/contracts/${contractId}/changes/${changeId}`, data);
  return res.data;
}

export async function deleteContractChange(contractId: number, changeId: number): Promise<void> {
  await client.delete(`/contracts/${contractId}/changes/${changeId}`);
}
