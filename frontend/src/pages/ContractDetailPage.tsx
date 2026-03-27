import { Alert, Button, Card, Descriptions, Input, InputNumber, Progress, Select, Skeleton, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  createContractChange,
  createContractItem,
  deleteContractChange,
  deleteContractItem,
  fetchContract,
  updateContractChange,
  updateContractItem,
} from '../services/contracts';
import { createPayment, deletePayment, updatePayment } from '../services/payments';
import type { Contract, ContractChange, ContractItem, Payment } from '../types';

const PAYMENT_STATUSES = ['未付', '已提交', '已付款'];

type EditableItemDraft = Partial<ContractItem> & Pick<ContractItem, 'seq' | 'item_name' | 'quantity' | 'amount'>;
type EditablePaymentDraft = Partial<Payment> & Pick<Payment, 'payment_status'>;
type EditableChangeDraft = Partial<ContractChange> & Pick<ContractChange, 'seq' | 'change_date'>;

function formatMoney(value: number | null | undefined) {
  return `¥${Number(value ?? 0).toLocaleString()}`;
}

function computePendingAmount(plannedAmount?: number | null, actualAmount?: number | null) {
  return Number(plannedAmount ?? 0) - Number(actualAmount ?? 0);
}

const ContractDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const contractId = Number(id);
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [itemDraft, setItemDraft] = useState<EditableItemDraft | null>(null);
  const [creatingItem, setCreatingItem] = useState(false);

  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);
  const [paymentDraft, setPaymentDraft] = useState<EditablePaymentDraft | null>(null);
  const [creatingPayment, setCreatingPayment] = useState(false);

  const [editingChangeId, setEditingChangeId] = useState<number | null>(null);
  const [changeDraft, setChangeDraft] = useState<EditableChangeDraft | null>(null);
  const [creatingChange, setCreatingChange] = useState(false);

  const loadContract = async () => {
    if (!contractId) return;
    setLoading(true);
    try {
      const detail = await fetchContract(contractId);
      setContract(detail);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadContract();
  }, [contractId]);

  const itemTotal = useMemo(
    () => (contract?.items ?? []).reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
    [contract?.items],
  );

  const plannedTotal = useMemo(
    () => (contract?.payments ?? []).reduce((sum, item) => sum + Number(item.planned_amount ?? 0), 0),
    [contract?.payments],
  );

  const paidTotal = useMemo(
    () => (contract?.payments ?? []).reduce((sum, item) => sum + Number(item.actual_amount ?? 0), 0),
    [contract?.payments],
  );

  const pendingTotal = useMemo(
    () => (contract?.payments ?? []).reduce((sum, item) => sum + Number(item.pending_amount ?? 0), 0),
    [contract?.payments],
  );

  const progressPercent = useMemo(() => {
    const amount = Number(contract?.amount ?? 0);
    return amount ? Math.min(100, Math.round((paidTotal / amount) * 100)) : 0;
  }, [contract?.amount, paidTotal]);

  const resetItemEditor = () => {
    setEditingItemId(null);
    setItemDraft(null);
    setCreatingItem(false);
  };

  const resetPaymentEditor = () => {
    setEditingPaymentId(null);
    setPaymentDraft(null);
    setCreatingPayment(false);
  };

  const resetChangeEditor = () => {
    setEditingChangeId(null);
    setChangeDraft(null);
    setCreatingChange(false);
  };

  const startCreateItem = () => {
    resetItemEditor();
    setCreatingItem(true);
    setItemDraft({
      seq: (contract?.items.length ?? 0) + 1,
      item_name: '',
      quantity: 1,
      unit: '',
      unit_price: 0,
      amount: 0,
    });
  };

  const startEditItem = (record: ContractItem) => {
    resetItemEditor();
    setEditingItemId(record.id);
    setItemDraft({ ...record });
  };

  const saveItem = async () => {
    if (!itemDraft) return;
    if (!itemDraft.item_name) {
      message.warning('请输入标的名称');
      return;
    }
    setSaving(true);
    try {
      if (creatingItem) {
        await createContractItem(contractId, {
          seq: Number(itemDraft.seq),
          item_name: itemDraft.item_name,
          quantity: Number(itemDraft.quantity),
          unit: itemDraft.unit || undefined,
          unit_price: itemDraft.unit_price != null ? Number(itemDraft.unit_price) : undefined,
          amount: Number(itemDraft.amount),
        });
        message.success('标的已新增');
      } else if (editingItemId) {
        await updateContractItem(contractId, editingItemId, {
          seq: Number(itemDraft.seq),
          item_name: itemDraft.item_name,
          quantity: Number(itemDraft.quantity),
          unit: itemDraft.unit || undefined,
          unit_price: itemDraft.unit_price != null ? Number(itemDraft.unit_price) : undefined,
          amount: Number(itemDraft.amount),
        });
        message.success('标的已更新');
      }
      resetItemEditor();
      void loadContract();
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const startCreatePayment = () => {
    resetPaymentEditor();
    setCreatingPayment(true);
    setPaymentDraft({
      seq: (contract?.payments.length ?? 0) + 1,
      phase: '',
      planned_date: '',
      planned_amount: 0,
      actual_date: '',
      actual_amount: 0,
      payment_status: '未付',
      description: '',
      remark: '',
    });
  };

  const startEditPayment = (record: Payment) => {
    resetPaymentEditor();
    setEditingPaymentId(record.id);
    setPaymentDraft({ ...record });
  };

  const savePayment = async () => {
    if (!paymentDraft) return;
    setSaving(true);
    try {
      const payload = {
        seq: paymentDraft.seq != null ? Number(paymentDraft.seq) : undefined,
        phase: paymentDraft.phase || undefined,
        planned_date: paymentDraft.planned_date || undefined,
        planned_amount: paymentDraft.planned_amount != null ? Number(paymentDraft.planned_amount) : undefined,
        actual_date: paymentDraft.actual_date || undefined,
        actual_amount: paymentDraft.actual_amount != null ? Number(paymentDraft.actual_amount) : undefined,
        payment_status: paymentDraft.payment_status,
        description: paymentDraft.description || undefined,
        remark: paymentDraft.remark || undefined,
      };

      if (creatingPayment) {
        await createPayment({ contract_id: contractId, ...payload });
        message.success('付款计划已新增');
      } else if (editingPaymentId) {
        await updatePayment(editingPaymentId, payload);
        message.success('付款计划已更新');
      }
      resetPaymentEditor();
      void loadContract();
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const startCreateChange = () => {
    resetChangeEditor();
    setCreatingChange(true);
    setChangeDraft({
      seq: (contract?.changes.length ?? 0) + 1,
      change_date: '',
      change_info: '',
      before_content: '',
      after_content: '',
      change_description: '',
    });
  };

  const startEditChange = (record: ContractChange) => {
    resetChangeEditor();
    setEditingChangeId(record.id);
    setChangeDraft({ ...record });
  };

  const saveChange = async () => {
    if (!changeDraft?.change_date) {
      message.warning('请输入变更日期');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        seq: Number(changeDraft.seq),
        change_date: changeDraft.change_date,
        change_info: changeDraft.change_info || undefined,
        before_content: changeDraft.before_content || undefined,
        after_content: changeDraft.after_content || undefined,
        change_description: changeDraft.change_description || undefined,
      };

      if (creatingChange) {
        await createContractChange(contractId, payload);
        message.success('变更记录已新增');
      } else if (editingChangeId) {
        await updateContractChange(contractId, editingChangeId, payload);
        message.success('变更记录已更新');
      }
      resetChangeEditor();
      void loadContract();
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const renderItemEditor = () =>
    itemDraft && (
      <Card size="small" style={{ marginBottom: 12 }}>
        <div className="inline-editor">
          <InputNumber
            placeholder="序号"
            min={1}
            value={Number(itemDraft.seq)}
            onChange={(value) => setItemDraft((current) => (current ? { ...current, seq: Number(value ?? 1) } : current))}
          />
          <Input
            placeholder="标的名称"
            value={itemDraft.item_name}
            onChange={(event) => setItemDraft((current) => (current ? { ...current, item_name: event.target.value } : current))}
          />
          <InputNumber
            placeholder="数量"
            min={0}
            value={Number(itemDraft.quantity)}
            onChange={(value) => setItemDraft((current) => (current ? { ...current, quantity: Number(value ?? 0) } : current))}
          />
          <Input
            placeholder="单位"
            value={itemDraft.unit ?? ''}
            onChange={(event) => setItemDraft((current) => (current ? { ...current, unit: event.target.value } : current))}
          />
          <InputNumber
            placeholder="单价"
            min={0}
            value={Number(itemDraft.unit_price ?? 0)}
            onChange={(value) => {
              const nextUnitPrice = Number(value ?? 0);
              setItemDraft((current) =>
                current
                  ? {
                      ...current,
                      unit_price: nextUnitPrice,
                      amount: Number(current.quantity ?? 0) * nextUnitPrice,
                    }
                  : current,
              );
            }}
          />
          <InputNumber
            placeholder="金额"
            min={0}
            value={Number(itemDraft.amount)}
            onChange={(value) => setItemDraft((current) => (current ? { ...current, amount: Number(value ?? 0) } : current))}
          />
        </div>
        <Space style={{ marginTop: 12 }}>
          <Button type="primary" loading={saving} onClick={() => void saveItem()}>
            保存
          </Button>
          <Button onClick={resetItemEditor}>取消</Button>
        </Space>
      </Card>
    );

  const renderPaymentEditor = () =>
    paymentDraft && (
      <Card size="small" style={{ marginBottom: 12 }}>
        <div className="inline-editor">
          <InputNumber
            placeholder="期次"
            min={1}
            value={Number(paymentDraft.seq ?? 1)}
            onChange={(value) => setPaymentDraft((current) => (current ? { ...current, seq: Number(value ?? 1) } : current))}
          />
          <Input
            placeholder="付款阶段"
            value={paymentDraft.phase ?? ''}
            onChange={(event) => setPaymentDraft((current) => (current ? { ...current, phase: event.target.value } : current))}
          />
          <Input
            placeholder="计划日期 YYYY-MM-DD"
            value={paymentDraft.planned_date ?? ''}
            onChange={(event) => setPaymentDraft((current) => (current ? { ...current, planned_date: event.target.value } : current))}
          />
          <InputNumber
            placeholder="计划金额"
            min={0}
            value={Number(paymentDraft.planned_amount ?? 0)}
            onChange={(value) => setPaymentDraft((current) => (current ? { ...current, planned_amount: Number(value ?? 0) } : current))}
          />
          <Input
            placeholder="实际日期 YYYY-MM-DD"
            value={paymentDraft.actual_date ?? ''}
            onChange={(event) => setPaymentDraft((current) => (current ? { ...current, actual_date: event.target.value } : current))}
          />
          <InputNumber
            placeholder="实际金额"
            min={0}
            value={Number(paymentDraft.actual_amount ?? 0)}
            onChange={(value) => setPaymentDraft((current) => (current ? { ...current, actual_amount: Number(value ?? 0) } : current))}
          />
          <Select
            value={paymentDraft.payment_status}
            options={PAYMENT_STATUSES.map((item) => ({ label: item, value: item }))}
            onChange={(value) => setPaymentDraft((current) => (current ? { ...current, payment_status: value } : current))}
          />
          <Input
            placeholder="支付说明"
            value={paymentDraft.description ?? ''}
            onChange={(event) => setPaymentDraft((current) => (current ? { ...current, description: event.target.value } : current))}
          />
        </div>
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
          待付款自动计算：{formatMoney(computePendingAmount(paymentDraft.planned_amount, paymentDraft.actual_amount))}
        </Typography.Text>
        <Space style={{ marginTop: 12 }}>
          <Button type="primary" loading={saving} onClick={() => void savePayment()}>
            保存
          </Button>
          <Button onClick={resetPaymentEditor}>取消</Button>
        </Space>
      </Card>
    );

  const renderChangeEditor = () =>
    changeDraft && (
      <Card size="small" style={{ marginBottom: 12 }}>
        <div className="inline-editor">
          <InputNumber
            placeholder="序号"
            min={1}
            value={Number(changeDraft.seq)}
            onChange={(value) => setChangeDraft((current) => (current ? { ...current, seq: Number(value ?? 1) } : current))}
          />
          <Input
            placeholder="变更日期 YYYY-MM-DD"
            value={changeDraft.change_date}
            onChange={(event) => setChangeDraft((current) => (current ? { ...current, change_date: event.target.value } : current))}
          />
          <Input
            placeholder="变更信息"
            value={changeDraft.change_info ?? ''}
            onChange={(event) => setChangeDraft((current) => (current ? { ...current, change_info: event.target.value } : current))}
          />
          <Input
            placeholder="变更前内容"
            value={changeDraft.before_content ?? ''}
            onChange={(event) => setChangeDraft((current) => (current ? { ...current, before_content: event.target.value } : current))}
          />
          <Input
            placeholder="变更后内容"
            value={changeDraft.after_content ?? ''}
            onChange={(event) => setChangeDraft((current) => (current ? { ...current, after_content: event.target.value } : current))}
          />
          <Input
            placeholder="变更说明"
            value={changeDraft.change_description ?? ''}
            onChange={(event) => setChangeDraft((current) => (current ? { ...current, change_description: event.target.value } : current))}
          />
        </div>
        <Space style={{ marginTop: 12 }}>
          <Button type="primary" loading={saving} onClick={() => void saveChange()}>
            保存
          </Button>
          <Button onClick={resetChangeEditor}>取消</Button>
        </Space>
      </Card>
    );

  const itemColumns: ColumnsType<ContractItem> = [
    { title: '序号', dataIndex: 'seq', width: 80 },
    { title: '标的名称', dataIndex: 'item_name' },
    { title: '数量', dataIndex: 'quantity', width: 100 },
    { title: '单位', dataIndex: 'unit', width: 100, render: (value) => value || '-' },
    { title: '单价', dataIndex: 'unit_price', width: 120, render: (value) => formatMoney(value) },
    { title: '金额', dataIndex: 'amount', width: 120, render: (value) => formatMoney(value) },
    {
      title: '操作',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => startEditItem(record)}>
            编辑
          </Button>
          <Button type="link" danger onClick={() => void deleteContractItem(contractId, record.id).then(() => { message.success('标的已删除'); void loadContract(); }).catch((error: Error) => message.error(error.message))}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const paymentColumns: ColumnsType<Payment> = [
    { title: '期次', dataIndex: 'seq', width: 80, render: (value) => value ?? '-' },
    { title: '付款阶段', dataIndex: 'phase', width: 140, render: (value) => value || '-' },
    { title: '计划日期', dataIndex: 'planned_date', width: 130, render: (value) => value || '-' },
    { title: '计划金额', dataIndex: 'planned_amount', width: 130, render: (value) => formatMoney(value) },
    { title: '实际日期', dataIndex: 'actual_date', width: 130, render: (value) => value || '-' },
    { title: '实际金额', dataIndex: 'actual_amount', width: 130, render: (value) => formatMoney(value) },
    { title: '待付款', dataIndex: 'pending_amount', width: 130, render: (value) => formatMoney(value) },
    {
      title: '状态',
      dataIndex: 'payment_status',
      width: 110,
      render: (value: string) => <Tag color={value === '已付款' ? 'success' : value === '已提交' ? 'processing' : 'default'}>{value}</Tag>,
    },
    {
      title: '操作',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => startEditPayment(record)}>
            编辑
          </Button>
          <Button type="link" danger onClick={() => void deletePayment(record.id).then(() => { message.success('付款计划已删除'); void loadContract(); }).catch((error: Error) => message.error(error.message))}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const changeColumns: ColumnsType<ContractChange> = [
    { title: '序号', dataIndex: 'seq', width: 80 },
    { title: '变更日期', dataIndex: 'change_date', width: 130 },
    { title: '变更信息', dataIndex: 'change_info', render: (value) => value || '-' },
    { title: '变更前内容', dataIndex: 'before_content', render: (value) => value || '-' },
    { title: '变更后内容', dataIndex: 'after_content', render: (value) => value || '-' },
    { title: '变更说明', dataIndex: 'change_description', render: (value) => value || '-' },
    {
      title: '操作',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => startEditChange(record)}>
            编辑
          </Button>
          <Button type="link" danger onClick={() => void deleteContractChange(contractId, record.id).then(() => { message.success('变更记录已删除'); void loadContract(); }).catch((error: Error) => message.error(error.message))}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  if (loading) {
    return <Skeleton active paragraph={{ rows: 10 }} className="page-panel" />;
  }

  if (!contract) {
    return <Typography.Text>合同不存在</Typography.Text>;
  }

  return (
    <div className="detail-stack">
      <Card className="page-panel" title={`合同详情：${contract.contract_name}`}>
        <Descriptions column={3}>
          <Descriptions.Item label="合同编号">{contract.contract_code}</Descriptions.Item>
          <Descriptions.Item label="供应商">{contract.vendor || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={contract.status === '归档' ? 'success' : 'processing'}>{contract.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="所属项目 ID">{contract.project_id}</Descriptions.Item>
          <Descriptions.Item label="合同金额">{formatMoney(contract.amount)}</Descriptions.Item>
          <Descriptions.Item label="收支方向">{contract.payment_direction || '-'}</Descriptions.Item>
          <Descriptions.Item label="采购类型">{contract.procurement_type || '-'}</Descriptions.Item>
          <Descriptions.Item label="费用归属责任中心">{contract.cost_department || '-'}</Descriptions.Item>
          <Descriptions.Item label="签订日期">{contract.sign_date || '-'}</Descriptions.Item>
          <Descriptions.Item label="备案日期">{contract.filing_date || '-'}</Descriptions.Item>
          <Descriptions.Item label="开始执行日期">{contract.start_date || '-'}</Descriptions.Item>
          <Descriptions.Item label="结束执行日期">{contract.end_date || '-'}</Descriptions.Item>
          <Descriptions.Item label="备案文件" span={2}>
            {contract.filing_reference || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="备注" span={3}>
            {contract.remark || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {Math.abs(itemTotal - Number(contract.amount ?? 0)) > 0.01 && contract.items.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`标的清单合计为 ${formatMoney(itemTotal)}，与合同金额 ${formatMoney(contract.amount)} 不一致。`}
        />
      )}

      {!!contract.warnings?.length && contract.warnings.map((warning) => (
        <Alert key={warning} type="warning" showIcon message={warning} />
      ))}

      <Card className="page-panel" title="付款进度">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Progress percent={progressPercent} strokeColor="#0f766e" />
          <Space size="large">
            <Typography.Text>计划合计：{formatMoney(plannedTotal)}</Typography.Text>
            <Typography.Text>已付合计：{formatMoney(paidTotal)}</Typography.Text>
            <Typography.Text>待付合计：{formatMoney(pendingTotal)}</Typography.Text>
          </Space>
        </Space>
      </Card>

      <Card className="page-panel">
        <Tabs
          items={[
            {
              key: 'items',
              label: `标的清单 (${contract.items.length})`,
              children: (
                <>
                  <div className="action-bar">
                    <div className="action-left" />
                    <Button type="primary" onClick={startCreateItem}>
                      新增行
                    </Button>
                  </div>
                  {renderItemEditor()}
                  <Table rowKey="id" dataSource={contract.items} columns={itemColumns} pagination={false} />
                </>
              ),
            },
            {
              key: 'payments',
              label: `付款计划 (${contract.payments.length})`,
              children: (
                <>
                  <div className="action-bar">
                    <div className="action-left" />
                    <Button type="primary" onClick={startCreatePayment}>
                      新增行
                    </Button>
                  </div>
                  {renderPaymentEditor()}
                  <Table rowKey="id" dataSource={contract.payments} columns={paymentColumns} pagination={false} />
                </>
              ),
            },
            {
              key: 'changes',
              label: `变更记录 (${contract.changes.length})`,
              children: (
                <>
                  <div className="action-bar">
                    <div className="action-left" />
                    <Button type="primary" onClick={startCreateChange}>
                      新增行
                    </Button>
                  </div>
                  {renderChangeEditor()}
                  <Table rowKey="id" dataSource={contract.changes} columns={changeColumns} pagination={false} />
                </>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default ContractDetailPage;
