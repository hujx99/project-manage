import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createProject, deleteProject, fetchProjects, updateProject } from '../services/projects';
import type { Project } from '../types';

const PROJECT_TYPES = ['研发项目', '工程项目', '服务项目'];
const PROJECT_STATUSES = ['立项', '执行中', '验收', '结项'];

const statusColorMap: Record<string, string> = {
  立项: 'default',
  执行中: 'processing',
  验收: 'warning',
  结项: 'success',
};

const ProjectsPage = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState<string>();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const loadProjects = async (nextPage = page, nextPageSize = pageSize, nextStatus = status, nextSearch = search) => {
    setLoading(true);
    try {
      const result = await fetchProjects({
        page: nextPage,
        page_size: nextPageSize,
        status: nextStatus,
        search: nextSearch || undefined,
      });
      setProjects(result.items);
      setTotal(result.total);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, []);

  const openCreateModal = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEditModal = (record: Project) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      start_date: record.start_date ? dayjs(record.start_date) : undefined,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload = {
      ...values,
      start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : undefined,
    };

    setSubmitting(true);
    try {
      if (editing) {
        await updateProject(editing.id, payload);
        message.success('项目已更新');
      } else {
        await createProject(payload);
        message.success('项目已创建');
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      void loadProjects(1, pageSize, status, search);
      setPage(1);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (record: Project) => {
    try {
      await deleteProject(record.id);
      message.success('项目已删除');
      void loadProjects();
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const columns: ColumnsType<Project> = [
    { title: '项目编号', dataIndex: 'project_code', width: 180 },
    {
      title: '项目名称',
      dataIndex: 'project_name',
      render: (_, record) => <Link to={`/projects/${record.id}`}>{record.project_name}</Link>,
    },
    { title: '属性', dataIndex: 'project_type', render: (value) => value || '-' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value: string) => <Tag color={statusColorMap[value] ?? 'default'}>{value}</Tag>,
    },
    {
      title: '金额',
      dataIndex: 'budget',
      width: 140,
      render: (value) => (value != null ? `¥${Number(value).toLocaleString()}` : '-'),
    },
    { title: '负责人', dataIndex: 'manager', width: 120, render: (value) => value || '-' },
    {
      title: '操作',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => openEditModal(record)}>
            编辑
          </Button>
          <Button type="link" danger onClick={() => void handleDelete(record)}>
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
          项目管理
        </Typography.Title>
        <Typography.Text type="secondary">按状态和关键字筛选项目，支持弹窗方式新建和编辑。</Typography.Text>
      </div>

      <div className="page-panel" style={{ padding: 20 }}>
        <div className="action-bar">
          <div className="action-left">
            <Input.Search
              placeholder="搜索项目编号或项目名称"
              allowClear
              style={{ width: 260 }}
              onSearch={(value) => {
                setSearch(value);
                setPage(1);
                void loadProjects(1, pageSize, status, value);
              }}
            />
            <Select
              placeholder="按状态筛选"
              allowClear
              style={{ width: 180 }}
              options={PROJECT_STATUSES.map((item) => ({ label: item, value: item }))}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
                void loadProjects(1, pageSize, value, search);
              }}
            />
          </div>
          <Button type="primary" onClick={openCreateModal}>
            新建项目
          </Button>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={projects}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (value) => `共 ${value} 条`,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
              void loadProjects(nextPage, nextPageSize, status, search);
            },
          }}
        />
      </div>

      <Modal
        title={editing ? '编辑项目' : '新建项目'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onOk={() => void handleSubmit()}
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
            <Select allowClear options={PROJECT_TYPES.map((item) => ({ label: item, value: item }))} />
          </Form.Item>
          <Form.Item label="立项日期" name="start_date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择项目状态' }]}>
            <Select options={PROJECT_STATUSES.map((item) => ({ label: item, value: item }))} />
          </Form.Item>
          <Form.Item label="金额" name="budget">
            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="负责人" name="manager">
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

export default ProjectsPage;
