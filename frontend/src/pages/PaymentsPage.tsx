import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../api/client';
import { createPayment, deletePayment, fetchPayments } from '../services/payments';
import { fetchContracts } from '../services/contracts';
import { fetchProjects } from '../services/projects';
import type { Contract, Payment, Project } from '../types';

interface PaymentRow extends Payment {
  project_name: string;
  contract_name: string;
}

const PAYMENT_STATUSES = ['未付', '已提交', '已付款'];

const PaymentsPage = () => {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const selectedProjectId = Form.useWatch('project_id', form);

  const loadData = async () => {
    setLoading(true);
    try {
      const [paymentList, projectResult, contractList] = await Promise.all([
        fetchPayments(),
        fetchProjects({ page: 1, page_size: 1000 }),
        fetchContracts(),
      ]);

      const projectNameMap = new Map(projectResult.items.map((item) => [item.id, item.project_name]));
      const contractMap = new Map(contractList.map((item) => [item.id, item]));

      setProjects(projectResult.items);
      setContracts(contractList);
      setPayments(
        paymentList.map((item) => {
          const contract = contractMap.get(item.contract_id);
          return {
            ...item,
            project_name: contract ? (projectNameMap.get(contract.project_id) ?? '-') : '-',
            contract_name: contract?.contract_name ?? '-',
          };
        }),
      );
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const contractOptions = useMemo(
    () => (selectedProjectId ? contracts.filter((item) => item.project_id === selectedProjectId) : contracts),
    [contracts, selectedProjectId],
  );

  const handleCreate = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      await createPayment({
        contract_id: values.contract_id,
        seq: values.seq,
        phase: values.phase,
        planned_date: values.planned_date ? values.planned_date.format('YYYY-MM-DD') : undefined,
        planned_amount: values.planned_amount,
        actual_date: values.actual_date ? values.actual_date.format('YYYY-MM-DD') : undefined,
        actual_amount: values.actual_amount,
        payment_status: values.payment_status,
        description: values.description,
        remark: values.remark,
      });
      message.success('付款记录已创建');
      setModalOpen(false);
      form.resetFields();
      void loadData();
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deletePayment(id);
      message.success('付款记录已删除');
      void loadData();
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const columns: ColumnsType<PaymentRow> = [
    { title: '项目名', dataIndex: 'project_name', width: 220 },
    { title: '合同名', dataIndex: 'contract_name', width: 220 },
    { title: '付款阶段', dataIndex: 'phase', width: 140, render: (value) => value || '-' },
    { title: '计划日期', dataIndex: 'planned_date', width: 130, render: (value) => value || '-' },
    { title: '计划金额', dataIndex: 'planned_amount', width: 130, render: (value) => `¥${Number(value ?? 0).toLocaleString()}` },
    { title: '实际金额', dataIndex: 'actual_amount', width: 130, render: (value) => `¥${Number(value ?? 0).toLocaleString()}` },
    { title: '待付款', dataIndex: 'pending_amount', width: 130, render: (value) => `¥${Number(value ?? 0).toLocaleString()}` },
    {
      title: '状态',
      dataIndex: 'payment_status',
      width: 110,
      render: (value: string) => <Tag color={value === '已付款' ? 'success' : value === '已提交' ? 'processing' : 'default'}>{value}</Tag>,
    },
    {
      title: '操作',
      width: 100,
      render: (_, record) => (
        <Button type="link" danger onClick={() => void handleDelete(record.id)}>
          删除
        </Button>
      ),
    },
  ];

  return (
    <div className="detail-stack">
      <div>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          付款管理
        </Typography.Title>
        <Typography.Text type="secondary">统一查看所有付款记录，新建时支持先选项目再联动筛选合同。</Typography.Text>
      </div>

      <div className="page-panel" style={{ padding: 20 }}>
        <div className="action-bar">
          <div className="action-left" />
          <Space>
            <Button onClick={() => window.open(`${API_BASE_URL}/export/payments?format=xlsx`, '_blank')}>
              导出
            </Button>
            <Button
              type="primary"
              onClick={() => {
                form.resetFields();
                setModalOpen(true);
              }}
            >
              新建付款
            </Button>
          </Space>
        </div>

        <Table rowKey="id" dataSource={payments} columns={columns} loading={loading} />
      </div>

      <Modal
        title="新建付款"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleCreate()}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form layout="vertical" form={form}>
          <Form.Item label="项目" name="project_id">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={projects.map((item) => ({ label: item.project_name, value: item.id }))}
              onChange={() => form.setFieldValue('contract_id', undefined)}
            />
          </Form.Item>
          <Form.Item label="合同" name="contract_id" rules={[{ required: true, message: '请选择合同' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={contractOptions.map((item) => ({ label: item.contract_name, value: item.id }))}
            />
          </Form.Item>
          <Form.Item label="期次" name="seq">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="付款阶段" name="phase">
            <Input />
          </Form.Item>
          <Form.Item label="计划日期" name="planned_date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="计划金额" name="planned_amount">
            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="实际日期" name="actual_date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="实际金额" name="actual_amount">
            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="付款状态" name="payment_status" rules={[{ required: true, message: '请选择付款状态' }]}>
            <Select options={PAYMENT_STATUSES.map((item) => ({ label: item, value: item }))} />
          </Form.Item>
          <Form.Item label="支付说明" name="description">
            <Input />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PaymentsPage;
