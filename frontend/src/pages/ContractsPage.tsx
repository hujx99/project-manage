import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Contract, Project } from '../types';
import { fetchContracts, createContract } from '../services/contracts';
import { fetchProjects } from '../services/projects';


const CONTRACT_STATUSES = ['草拟', '签订', '服务中', '执行中', '归档'];

const ContractsPage = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [projectFilter, setProjectFilter] = useState<number | undefined>();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [contractRes, projectRes] = await Promise.all([fetchContracts(), fetchProjects({ page_size: 100 })]);
      setContracts(contractRes);
      setProjects(projectRes.items);
    } catch (e: unknown) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredData = projectFilter
    ? contracts.filter((c) => c.project_id === projectFilter)
    : contracts;

  const projectNameMap = new Map(projects.map((p) => [p.id, p.project_name]));

  const handleCreate = async () => {
    const values = await form.validateFields();
    const payload = {
      ...values,
      sign_date: values.sign_date ? values.sign_date.format('YYYY-MM-DD') : undefined,
      start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : undefined,
      end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : undefined,
    };
    setSubmitting(true);
    try {
      await createContract(payload);
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

  const columns: ColumnsType<Contract> = [
    {
      title: '合同编号',
      dataIndex: 'contract_code',
      width: 220,
      render: (_, record) => <Link to={`/contracts/${record.id}`}>{record.contract_code}</Link>,
    },
    { title: '合同名称', dataIndex: 'contract_name' },
    {
      title: '所属项目',
      dataIndex: 'project_id',
      width: 200,
      render: (v: number) => projectNameMap.get(v) || '-',
    },
    { title: '供应商', dataIndex: 'vendor', width: 200 },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 140,
      render: (v: number) => `¥${Number(v).toLocaleString()}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => <Tag>{v}</Tag>,
    },
  ];

  return (
    <>
      <div className="action-bar">
        <Space className="action-left">
          <Select
            placeholder="按项目筛选"
            allowClear
            style={{ width: 260 }}
            showSearch
            optionFilterProp="label"
            options={projects.map((p) => ({ label: p.project_name, value: p.id }))}
            onChange={(value) => setProjectFilter(value)}
          />
        </Space>
        <Space>
          <Button
            onClick={() => {
              const params = new URLSearchParams({ format: 'xlsx' });
              if (projectFilter) params.set('project_id', String(projectFilter));
              window.open(`/api/export/contracts?${params.toString()}`, '_blank');
            }}
          >
            导出
          </Button>
          <Button
            type="primary"
            onClick={() => {
              form.resetFields();
              setOpen(true);
            }}
          >
            新建合同
          </Button>
        </Space>
      </div>
      <Table rowKey="id" dataSource={filteredData} columns={columns} loading={loading} />

      <Modal
        title="新建合同"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
        destroyOnClose
        width={640}
      >
        <Form layout="vertical" form={form}>
          <Form.Item label="所属项目" name="project_id" rules={[{ required: true, message: '请选择所属项目' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={projects.map((p) => ({ label: p.project_name, value: p.id }))}
              placeholder="请选择项目"
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
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={CONTRACT_STATUSES.map((s) => ({ label: s, value: s }))} />
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
          <Form.Item label="开始执行日期" name="start_date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="结束执行日期" name="end_date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ContractsPage;
