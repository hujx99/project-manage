import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../api/client';
import { PAYMENT_STATUSES, getPaymentStatusColor, normalizePaymentStatus } from '../constants/business';
import useIsMobile from '../hooks/useIsMobile';
import { createPayment, deletePayment, fetchPayments, updatePayment } from '../services/payments';
import { fetchContracts } from '../services/contracts';
import { fetchProjects } from '../services/projects';
import type { Contract, Payment, Project } from '../types';

interface PaymentRow extends Payment {
  project_code: string;
  project_name: string;
  contract_name: string;
}

function compareText(a?: string | null, b?: string | null) {
  return (a ?? '').localeCompare(b ?? '', 'zh-CN');
}

function compareNumber(a?: number | null, b?: number | null) {
  return Number(a ?? 0) - Number(b ?? 0);
}

function compareDate(a?: string | null, b?: string | null) {
  return dayjs(a ?? undefined).valueOf() - dayjs(b ?? undefined).valueOf();
}

const PaymentsPage = () => {
  const isMobile = useIsMobile();
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
        fetchProjects({ page: 1, page_size: 100 }),
        fetchContracts(),
      ]);

      const projectMap = new Map(projectResult.items.map((item) => [item.id, item]));
      const contractMap = new Map(contractList.map((item) => [item.id, item]));

      setProjects(projectResult.items);
      setContracts(contractList);
      setPayments(
        paymentList.map((item) => {
          const contract = contractMap.get(item.contract_id);
          const project = contract ? projectMap.get(contract.project_id) : undefined;
          return {
            ...item,
            project_code: project?.project_code ?? '-',
            project_name: project?.project_name ?? '-',
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

  const handleMarkPaid = async (record: PaymentRow) => {
    try {
      await updatePayment(record.id, {
        payment_status: '已付款',
        actual_amount: record.actual_amount != null ? Number(record.actual_amount) : Number(record.planned_amount ?? 0),
        actual_date: record.actual_date || new Date().toISOString().slice(0, 10),
      });
      message.success('已标记为已付款');
      void loadData();
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const columns: ColumnsType<PaymentRow> = [
    {
      title: '项目编号',
      dataIndex: 'project_code',
      width: 160,
      responsive: ['xl'],
      sorter: (a, b) => compareText(a.project_code, b.project_code),
    },
    {
      title: '项目名称',
      dataIndex: 'project_name',
      width: 200,
      ellipsis: true,
      sorter: (a, b) => compareText(a.project_name, b.project_name),
      render: (value: string, record) => (
        <div className="table-cell-stack">
          <span className="table-cell-title">{value}</span>
          {isMobile && (
            <>
              <span className="table-cell-subtitle">{record.contract_name}</span>
              <span className="table-cell-meta">{record.project_code}</span>
            </>
          )}
        </div>
      ),
    },
    {
      title: '合同名称',
      dataIndex: 'contract_name',
      width: 200,
      responsive: ['md'],
      ellipsis: true,
      sorter: (a, b) => compareText(a.contract_name, b.contract_name),
    },
    {
      title: '所属阶段',
      dataIndex: 'phase',
      width: 120,
      responsive: ['sm'],
      sorter: (a, b) => compareText(a.phase, b.phase),
      render: (value) => value || '-',
    },
    {
      title: '付款日期',
      dataIndex: 'planned_date',
      width: 120,
      sorter: (a, b) => compareDate(a.planned_date, b.planned_date),
      render: (value) => value || '-',
    },
    {
      title: '合同付款金额',
      dataIndex: 'planned_amount',
      width: 140,
      sorter: (a, b) => compareNumber(a.planned_amount, b.planned_amount),
      render: (value) => `¥${Number(value ?? 0).toLocaleString()}`,
    },
    {
      title: '流程已提金额',
      dataIndex: 'actual_amount',
      width: 140,
      responsive: ['lg'],
      sorter: (a, b) => compareNumber(a.actual_amount, b.actual_amount),
      render: (value) => `¥${Number(value ?? 0).toLocaleString()}`,
    },
    {
      title: '待付款金额',
      dataIndex: 'pending_amount',
      width: 130,
      sorter: (a, b) => compareNumber(a.pending_amount, b.pending_amount),
      render: (value) => `¥${Number(value ?? 0).toLocaleString()}`,
    },
    {
      title: '付款状态',
      dataIndex: 'payment_status',
      width: 110,
      sorter: (a, b) => compareText(a.payment_status, b.payment_status),
      render: (value: string) => (
        <Tag color={getPaymentStatusColor(value)}>{normalizePaymentStatus(value)}</Tag>
      ),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      width: 160,
      responsive: ['xl'],
      ellipsis: true,
      render: (value) => value || '-',
    },
    {
      title: '操作',
      width: 160,
      fixed: isMobile ? undefined : 'right',
      render: (_, record) => (
        <Space wrap direction={isMobile ? 'vertical' : 'horizontal'} className="table-actions">
          {record.payment_status !== '已付款' && (
            <Button type="link" onClick={() => void handleMarkPaid(record)}>
              标记已付款
            </Button>
          )}
          <Button type="link" danger onClick={() => void handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="detail-stack">
      <div>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          付款跟踪
        </Typography.Title>
        <Typography.Text type="secondary">
          第三步：统一跟踪合同付款执行，集中处理未付、提报和已付款项。
        </Typography.Text>
      </div>

      <div className="page-panel" style={{ padding: isMobile ? 16 : 20 }}>
        <div className="action-bar">
          <div className="action-left" />
          <Space wrap className="action-right">
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

        <Table
          rowKey="id"
          dataSource={payments}
          columns={columns}
          loading={loading}
          size={isMobile ? 'small' : 'middle'}
          scroll={{ x: isMobile ? 860 : 1600 }}
        />
      </div>

      <Modal
        title="新建付款"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleCreate()}
        confirmLoading={submitting}
        width={isMobile ? 'calc(100vw - 24px)' : undefined}
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
