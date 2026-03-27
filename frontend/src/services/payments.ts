import client from '../api/client';
import type { Payment, PaymentCreate } from '../types';

export async function fetchPayments(contractId?: number): Promise<Payment[]> {
  const params = contractId ? { contract_id: contractId } : undefined;
  const res = await client.get('/payments', { params });
  return res.data;
}

export async function fetchPayment(id: number): Promise<Payment> {
  const res = await client.get(`/payments/${id}`);
  return res.data;
}

export async function createPayment(data: PaymentCreate): Promise<Payment> {
  const res = await client.post('/payments', data);
  return res.data;
}

export async function updatePayment(id: number, data: Partial<PaymentCreate>): Promise<Payment> {
  const res = await client.put(`/payments/${id}`, data);
  return res.data;
}

export async function deletePayment(id: number): Promise<void> {
  await client.delete(`/payments/${id}`);
}
