import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Payment, Project, Contract } from '../types';
import { fetchPayments, createPayment } from '../services/payments';
import { fetchProjects } from '../services/projects';
import { fetchContracts } from '../services/contracts';

const PAYMENT_STATUSES = ['未付', '已提交', '已付款'];

interface PaymentWithNames extends Payment {
  project_name?: string;
  contract_name?: string;
}

const PaymentsPage = () => {
  const [payments, setPayments] = useState<PaymentWithNames[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const selectedProjectId = Form.useWatch('_projectId', form);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [paymentRes, projectRes, contractRes] = await Promise.all([
        fetchPayments(),
        fetchProjects({ page_size: 100 }),
        fetchContracts(),
      ]);
      const projectMap = new Map(projectRes.items.map((p) => [p.id, p.project_name]));
      const contractMap = new Map(contractRes.map((c) => [c.id, { name: c.contract_name, projectId: c.project_id }]));

      const enriched: PaymentWithNames[] = paymentRes.map((p) => {
        const contractInfo = contractMap.get(p.contract_id);
        return {
          ...p,
          contract_name: contractInfo?.name || '-',
          project_name: contractInfo ? (projectMap.get(contractInfo.projectId) || '-') : '-',
        };
      });
      setPayments(enriched);
      setProjects(projectRes.items);
      setContracts(contractRes);
    } catch (e: unknown) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const contractOptions = useMemo(
    () =>
      selectedProjectId
        ? contracts.filter((c) => c.project_id === selectedProjectId)
        : contracts,
    [contracts, selectedProjectId],
  );

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      await createPayment({
        contract_id: values.contract_id,
        phase: values.phase,
        planned_date: values.planned_date ? values.planned_date.format('YYYY-MM-DD') : undefined,
        planned_amount: values.planned_amount,
        actual_date: values.actual_date ? values.actual_date.format('YYYY-MM-DD') : undefined,
        actual_amount: values.actual_amount,
        payment_status: values.payment_status,
        description: values.description,
        remark: values.remark,
      });
      message.success('创建成功');
      setOpen(false);
      form.resetFields();
      void loadData();
    } catch (e: unknown) {
      message.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<PaymentWithNames> = [
    { title: '项目名称', dataIndex: 'project_name', width: 200 },
    { title: '合同名称', dataIndex: 'contract_name', width: 200 },
    { title: '付款阶段', dataIndex: 'phase', width: 120 },
    {
      title: '计划金额',
      dataIndex: 'planned_amount',
      width: 120,
      render: (v: number | null) => (v != null ? `¥${Number(v).toLocaleString()}` : '-'),
    },
    {
      title: '实际金额',
      dataIndex: 'actual_amount',
      width: 120,
      render: (v: number | null) => (v != null ? `¥${Number(v).toLocaleString()}` : '-'),
    },
    {
      title: '待付金额',
      dataIndex: 'pending_amount',
      width: 120,
      render: (v: number | null) => (v != null ? `¥${Number(v).toLocaleString()}` : '-'),
    },
    {
      title: '状态',
      dataIndex: 'payment_status',
      width: 90,
      render: (v: string) => {
        const color = v === '已付款' ? 'success' : v === '已提交' ? 'processing' : 'default';
        return <Tag color={color}>{v}</Tag>;
      },
    },
    { title: '计划日期', dataIndex: 'planned_date', width: 120 },
    { title: '备注', dataIndex: 'remark' },
  ];

  return (
    <>
      <div className="action-bar">
        <Space className="action-left" />
        <Space>
          <Button onClick={() => window.open('/api/export/payments?format=xlsx', '_blank')}>导出</Button>
          <Button
            type="primary"
            onClick={() => {
              form.resetFields();
              setOpen(true);
            }}
          >
            新建付款
          </Button>
        </Space>
      </div>
      <Table rowKey="id" dataSource={payments} columns={columns} loading={loading} />

      <Modal
        title="新建付款"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form layout="vertical" form={form}>
          <Form.Item label="项目" name="_projectId">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={projects.map((p) => ({ label: p.project_name, value: p.id }))}
              placeholder="先选项目可筛选合同"
              onChange={() => form.setFieldValue('contract_id', undefined)}
            />
          </Form.Item>
          <Form.Item label="合同" name="contract_id" rules={[{ required: true, message: '请选择合同' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={contractOptions.map((c) => ({ label: c.contract_name, value: c.id }))}
              placeholder="请选择合同"
            />
          </Form.Item>
          <Form.Item label="付款阶段" name="phase">
            <Input placeholder="如：第一期、质保金" />
          </Form.Item>
          <Form.Item label="计划日期" name="planned_date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="计划金额" name="planned_amount">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item label="实际日期" name="actual_date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="实际金额" name="actual_amount">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item label="付款状态" name="payment_status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={PAYMENT_STATUSES.map((s) => ({ label: s, value: s }))} />
          </Form.Item>
          <Form.Item label="说明" name="description">
            <Input />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default PaymentsPage;
