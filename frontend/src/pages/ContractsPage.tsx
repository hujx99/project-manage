import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType, TableProps } from 'antd/es/table';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../api/client';
import {
  CONTRACT_STATUSES,
  CONTRACT_STATUS_COLORS,
  getPaymentStatusColor,
  normalizePaymentStatus,
} from '../constants/business';
import useIsMobile from '../hooks/useIsMobile';
import { createContract, fetchContracts } from '../services/contracts';
import { fetchProjects } from '../services/projects';
import type { Contract, Payment, Project } from '../types';

function compareText(a?: string | null, b?: string | null) {
  return (a ?? '').localeCompare(b ?? '', 'zh-CN');
}

function compareNumber(a?: number | null, b?: number | null) {
  return Number(a ?? 0) - Number(b ?? 0);
}

function compareDate(a?: string | null, b?: string | null) {
  return dayjs(a ?? undefined).valueOf() - dayjs(b ?? undefined).valueOf();
}

const ContractsPage = () => {
  const isMobile = useIsMobile();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectFilter, setProjectFilter] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [contractList, projectResult] = await Promise.all([
        fetchContracts(),
        fetchProjects({ page: 1, page_size: 100 }),
      ]);
      setContracts(contractList);
      setProjects(projectResult.items);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const projectNameMap = useMemo(() => new Map(projects.map((item) => [item.id, item.project_name])), [projects]);

  const dataSource = useMemo(
    () => (projectFilter ? contracts.filter((item) => item.project_id === projectFilter) : contracts),
    [contracts, projectFilter],
  );

  const handleCreate = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      await createContract({
        ...values,
        sign_date: values.sign_date ? values.sign_date.format('YYYY-MM-DD') : undefined,
        filing_date: values.filing_date ? values.filing_date.format('YYYY-MM-DD') : undefined,
        start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : undefined,
        end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : undefined,
        items: [],
        payments: [],
      });
      message.success('合同已创建');
      setModalOpen(false);
      form.resetFields();
      void loadData();
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const paymentColumns: ColumnsType<Payment> = [
    { title: '所属阶段', dataIndex: 'phase', width: 120, render: (v) => v || '-' },
    { title: '付款日期', dataIndex: 'planned_date', width: 110, render: (v) => v || '-' },
    {
      title: '合同付款金额',
      dataIndex: 'planned_amount',
      width: 130,
      render: (v) => `¥${Number(v ?? 0).toLocaleString()}`,
    },
    {
      title: '流程已提金额',
      dataIndex: 'actual_amount',
      width: 130,
      responsive: ['md'],
      render: (v) => `¥${Number(v ?? 0).toLocaleString()}`,
    },
    {
      title: '待付款金额',
      dataIndex: 'pending_amount',
      width: 120,
      render: (v) => `¥${Number(v ?? 0).toLocaleString()}`,
    },
    {
      title: '付款状态',
      dataIndex: 'payment_status',
      width: 100,
      render: (v: string) => (
        <Tag color={getPaymentStatusColor(v)}>{normalizePaymentStatus(v)}</Tag>
      ),
    },
    { title: '备注', dataIndex: 'remark', ellipsis: true, responsive: ['lg'], render: (v) => v || '-' },
  ];

  const expandable: TableProps<Contract>['expandable'] = {
    expandedRowRender: (record) => (
      <Table
        rowKey="id"
        size="small"
        dataSource={record.payments}
        columns={paymentColumns}
        pagination={false}
        scroll={{ x: 760 }}
        locale={{ emptyText: '暂无付款记录' }}
        style={{ margin: '0 0 4px' }}
      />
    ),
    rowExpandable: (record) => record.payments.length > 0,
  };

  const columns: ColumnsType<Contract> = [
    {
      title: '合同编号',
      dataIndex: 'contract_code',
      width: 260,
      responsive: ['md'],
      ellipsis: true,
      sorter: (a, b) => compareText(a.contract_code, b.contract_code),
      render: (_, record) => (
        <Link to={`/contracts/${record.id}`} className="table-link-ellipsis" title={record.contract_code}>
          {record.contract_code}
        </Link>
      ),
    },
    {
      title: '合同名称',
      dataIndex: 'contract_name',
      width: 360,
      ellipsis: true,
      sorter: (a, b) => compareText(a.contract_name, b.contract_name),
      render: (value: string, record) => (
        <div className="table-cell-stack">
          <Link to={`/contracts/${record.id}`} className="table-link-ellipsis table-cell-title" title={value}>
            {value}
          </Link>
          {isMobile && (
            <>
              <span className="table-cell-subtitle">{record.contract_code}</span>
              <span className="table-cell-meta">{projectNameMap.get(record.project_id) || '-'}</span>
            </>
          )}
        </div>
      ),
    },
    {
      title: '关联项目',
      dataIndex: 'project_id',
      width: 240,
      responsive: ['lg'],
      ellipsis: true,
      sorter: (a, b) => compareText(projectNameMap.get(a.project_id), projectNameMap.get(b.project_id)),
      render: (value: number) => (
        <span className="table-link-ellipsis" title={projectNameMap.get(value) || '-'}>
          {projectNameMap.get(value) || '-'}
        </span>
      ),
    },
    {
      title: '合同状态',
      dataIndex: 'status',
      width: 110,
      sorter: (a, b) => compareText(a.status, b.status),
      render: (value: string) => <Tag color={CONTRACT_STATUS_COLORS[value] ?? 'default'}>{value}</Tag>,
    },
    {
      title: '签订时间',
      dataIndex: 'sign_date',
      width: 120,
      responsive: ['md'],
      sorter: (a, b) => compareDate(a.sign_date, b.sign_date),
      render: (value) => value || '-',
    },
    {
      title: '合同金额',
      dataIndex: 'amount',
      width: 140,
      sorter: (a, b) => compareNumber(a.amount, b.amount),
      render: (value) => `¥${Number(value).toLocaleString()}`,
    },
    {
      title: '承建方',
      dataIndex: 'vendor',
      width: 180,
      responsive: ['xl'],
      ellipsis: true,
      sorter: (a, b) => compareText(a.vendor, b.vendor),
      render: (value) => value || '-',
    },
    {
      title: '备注',
      dataIndex: 'remark',
      width: 180,
      responsive: ['xl'],
      ellipsis: true,
      render: (value) => value || '-',
    },
  ];

  return (
    <div className="detail-stack">
      <div>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          合同执行
        </Typography.Title>
        <Typography.Text type="secondary">
          第二步：在项目下落合同，统一维护金额、供应商、标的清单、变更记录和付款计划。
        </Typography.Text>
      </div>

      <div className="page-panel" style={{ padding: isMobile ? 16 : 20 }}>
        <div className="action-bar">
          <div className="action-left">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="按项目筛选"
              style={{ width: isMobile ? '100%' : 280 }}
              options={projects.map((item) => ({ label: item.project_name, value: item.id }))}
              onChange={(value) => setProjectFilter(value)}
            />
          </div>
          <Space wrap className="action-right">
            <Button
              onClick={() => {
                const params = new URLSearchParams({ format: 'xlsx' });
                if (projectFilter) params.set('project_id', String(projectFilter));
                window.open(`${API_BASE_URL}/export/contracts?${params.toString()}`, '_blank');
              }}
            >
              导出
            </Button>
            <Button
              type="primary"
              onClick={() => {
                form.resetFields();
                setModalOpen(true);
              }}
            >
              新建合同
            </Button>
          </Space>
        </div>

        <Table
          rowKey="id"
          dataSource={dataSource}
          columns={columns}
          loading={loading}
          size={isMobile ? 'small' : 'middle'}
          tableLayout="fixed"
          scroll={{ x: isMobile ? 760 : 1380 }}
          expandable={expandable}
        />
      </div>

      <Modal
        title="新建合同"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleCreate()}
        confirmLoading={submitting}
        width={isMobile ? 'calc(100vw - 24px)' : 720}
        destroyOnClose
      >
        <Form layout="vertical" form={form}>
          <Form.Item label="所属项目" name="project_id" rules={[{ required: true, message: '请选择所属项目' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={projects.map((item) => ({ label: item.project_name, value: item.id }))}
            />
          </Form.Item>
          <Form.Item label="合同编号" name="contract_code" rules={[{ required: true, message: '请输入合同编号' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="合同名称" name="contract_name" rules={[{ required: true, message: '请输入合同名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="供应商" name="vendor">
            <Input />
          </Form.Item>
          <Form.Item label="合同金额" name="amount" rules={[{ required: true, message: '请输入合同金额' }]}>
            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="合同状态" name="status" rules={[{ required: true, message: '请选择合同状态' }]}>
            <Select options={CONTRACT_STATUSES.map((item) => ({ label: item, value: item }))} />
          </Form.Item>
          <Form.Item label="采购类型" name="procurement_type">
            <Input />
          </Form.Item>
          <Form.Item label="费用归属责任中心" name="cost_department">
            <Input />
          </Form.Item>
          <Form.Item label="收支方向" name="payment_direction">
            <Select
              allowClear
              options={[
                { label: '支出', value: '支出' },
                { label: '收入', value: '收入' },
              ]}
            />
          </Form.Item>
          <Form.Item label="签订日期" name="sign_date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="备案日期" name="filing_date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="开始执行日期" name="start_date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="结束执行日期" name="end_date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="备案文件" name="filing_reference">
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

export default ContractsPage;
