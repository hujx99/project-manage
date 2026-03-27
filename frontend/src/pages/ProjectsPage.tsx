import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Project } from '../types';
import { fetchProjects, createProject, updateProject, deleteProject } from '../services/projects';
import dayjs from 'dayjs';

const PROJECT_STATUSES = ['立项', '执行中', '验收', '结项'];

const statusColor: Record<string, string> = {
  立项: 'default',
  执行中: 'processing',
  验收: 'warning',
  结项: 'success',
};

const ProjectsPage = () => {
  const [data, setData] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchProjects({
        page,
        page_size: pageSize,
        search: keyword || undefined,
        status: statusFilter,
      });
      setData(res.items);
      setTotal(res.total);
    } catch (e: unknown) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload = {
      ...values,
      start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : undefined,
      budget: values.budget ?? undefined,
    };
    setSubmitting(true);
    try {
      if (editing) {
        await updateProject(editing.id, payload);
        message.success('更新成功');
      } else {
        await createProject(payload);
        message.success('创建成功');
      }
      setOpen(false);
      form.resetFields();
      setEditing(null);
      void loadData();
    } catch (e: unknown) {
      message.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteProject(id);
      message.success('删除成功');
      void loadData();
    } catch (e: unknown) {
      message.error((e as Error).message);
    }
  };

  const columns: ColumnsType<Project> = [
    { title: '项目编号', dataIndex: 'project_code', width: 180 },
    {
      title: '项目名称',
      dataIndex: 'project_name',
      render: (_, record) => <Link to={`/projects/${record.id}`}>{record.project_name}</Link>,
    },
    { title: '属性', dataIndex: 'project_type', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => <Tag color={statusColor[value] ?? 'default'}>{value}</Tag>,
    },
    {
      title: '预算金额',
      dataIndex: 'budget',
      width: 140,
      render: (value: number | null) => (value != null ? `¥${Number(value).toLocaleString()}` : '-'),
    },
    { title: '负责人', dataIndex: 'manager', width: 100 },
    {
      title: '操作',
      width: 140,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => {
              setEditing(record);
              form.setFieldsValue({
                ...record,
                start_date: record.start_date ? dayjs(record.start_date) : undefined,
              });
              setOpen(true);
            }}
          >
            编辑
          </Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div className="action-bar">
        <Space className="action-left">
          <Input.Search
            placeholder="搜索项目编号/项目名称"
            onSearch={(v) => {
              setKeyword(v);
              setPage(1);
            }}
            allowClear
            style={{ width: 240 }}
          />
          <Select
            placeholder="按状态筛选"
            allowClear
            style={{ width: 160 }}
            options={PROJECT_STATUSES.map((s) => ({ label: s, value: s }))}
            onChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          />
        </Space>
        <Space>
          <Button
            onClick={() => {
              const params = new URLSearchParams({ format: 'xlsx' });
              if (keyword) params.set('search', keyword);
              if (statusFilter) params.set('status', statusFilter);
              window.open(`/api/export/projects?${params.toString()}`, '_blank');
            }}
          >
            导出
          </Button>
          <Button
            type="primary"
            onClick={() => {
              setEditing(null);
              form.resetFields();
              setOpen(true);
            }}
          >
            新建项目
          </Button>
        </Space>
      </div>
      <Table
        rowKey="id"
        dataSource={data}
        columns={columns}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Modal
        title={editing ? '编辑项目' : '新建项目'}
        open={open}
        onCancel={() => {
          setOpen(false);
          setEditing(null);
        }}
        onOk={handleSubmit}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form layout="vertical" form={form}>
          <Form.Item label="项目编号" name="project_code" rules={[{ required: true, message: '请输入项目编号' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="项目名称" name="project_name" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="项目属性" name="project_type">
            <Select
              allowClear
              options={[
                { label: '研发项目', value: '研发项目' },
                { label: '工程项目', value: '工程项目' },
                { label: '服务项目', value: '服务项目' },
              ]}
            />
          </Form.Item>
          <Form.Item label="立项日期" name="start_date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={PROJECT_STATUSES.map((s) => ({ label: s, value: s }))} />
          </Form.Item>
          <Form.Item label="预算金额" name="budget">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item label="负责人" name="manager">
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

export default ProjectsPage;
