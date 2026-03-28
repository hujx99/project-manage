export const PROJECT_STATUSES = ['立项', '合同', '初验', '终验', '质保', '结项'] as const;

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  立项: 'default',
  合同: 'processing',
  初验: 'cyan',
  终验: 'warning',
  质保: 'purple',
  结项: 'success',
};

export const CONTRACT_STATUSES = ['草拟', '签订', '执行', '归档'] as const;

export const CONTRACT_STATUS_COLORS: Record<string, string> = {
  草拟: 'default',
  签订: 'processing',
  执行: 'warning',
  服务中: 'cyan',
  执行中: 'warning',
  归档: 'success',
};

export const PAYMENT_STATUSES = ['未付', '已提报', '已付款'] as const;

export function normalizePaymentStatus(status?: string | null) {
  if (status === '已提交') {
    return '已提报';
  }

  return status || '未付';
}

export function getPaymentStatusColor(status?: string | null) {
  const normalizedStatus = normalizePaymentStatus(status);

  if (normalizedStatus === '已付款') {
    return 'success';
  }

  if (normalizedStatus === '已提报') {
    return 'processing';
  }

  return 'default';
}
