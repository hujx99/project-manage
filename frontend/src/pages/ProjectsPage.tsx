import {
  Button,
  Checkbox,
  DatePicker,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { AppstoreOutlined, BarsOutlined, SettingOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api/client';
import { PROJECT_STATUSES, PROJECT_STATUS_COLORS } from '../constants/business';
import useIsMobile from '../hooks/useIsMobile';
import { createProject, deleteProject, fetchAllProjects, fetchProjects, updateProject } from '../services/projects';
import type { Project } from '../types';

const T = {
  pageTitle: '\u9879\u76ee\u7acb\u9879',
  pageDesc:
    '\u7b2c\u4e00\u6b65\uff1a\u5efa\u7acb\u9879\u76ee\u53f0\u8d26\uff0c\u660e\u786e\u9884\u7b97\u3001\u8d1f\u8d23\u4eba\u548c\u5f53\u524d\u9636\u6bb5\uff0c\u5408\u540c\u548c\u4ed8\u6b3e\u90fd\u4ece\u8fd9\u91cc\u5f00\u59cb\u3002',
  typeDev: '\u7814\u53d1\u9879\u76ee',
  typeEngineering: '\u5de5\u7a0b\u9879\u76ee',
  typeService: '\u670d\u52a1\u9879\u76ee',
  colCode: '\u9879\u76ee\u7f16\u53f7',
  colName: '\u9879\u76ee\u540d\u79f0',
  colStartDate: '\u7acb\u9879\u65e5\u671f',
  colStatus: '\u9879\u76ee\u72b6\u6001',
  colBudget: '\u9879\u76ee\u91d1\u989d',
  colManager: '\u8d1f\u8d23\u4eba',
  colRemark: '\u5907\u6ce8',
  colContracts: '\u5173\u8054\u5408\u540c',
  colCreatedAt: '\u521b\u5efa\u65f6\u95f4',
  colUpdatedAt: '\u66f4\u65b0\u65f6\u95f4',
  colActions: '\u64cd\u4f5c',
  searchPlaceholder: '\u641c\u7d22\u9879\u76ee\u7f16\u53f7\u6216\u9879\u76ee\u540d\u79f0',
  statusPlaceholder: '\u6309\u9636\u6bb5\u7b5b\u9009',
  settingsButton: '\u663e\u793a\u8bbe\u7f6e',
  exportButton: '\u5bfc\u51fa',
  createButton: '\u65b0\u5efa\u9879\u76ee',
  editButton: '\u7f16\u8f91',
  deleteButton: '\u5220\u9664',
  settingsTitle: '\u9879\u76ee\u5217\u8868\u663e\u793a\u8bbe\u7f6e',
  resetButton: '\u6062\u590d\u9ed8\u8ba4',
  saveButton: '\u4fdd\u5b58',
  sectionColumns: '\u663e\u793a\u5217',
  sectionSort: '\u9ed8\u8ba4\u6392\u5e8f',
  sectionHiddenStatus: '\u9690\u85cf\u9636\u6bb5',
  sortAsc: '\u5347\u5e8f',
  sortDesc: '\u964d\u5e8f',
  hiddenStatusPlaceholder: '\u9009\u62e9\u4e0d\u663e\u793a\u7684\u9636\u6bb5',
  editTitle: '\u7f16\u8f91\u9879\u76ee',
  createTitle: '\u65b0\u5efa\u9879\u76ee',
  formCode: '\u9879\u76ee\u7f16\u53f7',
  formName: '\u9879\u76ee\u540d\u79f0',
  formType: '\u9879\u76ee\u5c5e\u6027',
  formDate: '\u7acb\u9879\u65f6\u95f4',
  formStatus: '\u72b6\u6001',
  formBudget: '\u91d1\u989d',
  formManager: '\u8d1f\u8d23\u4eba',
  formRemark: '\u5907\u6ce8',
  updatedSuccess: '\u9879\u76ee\u5df2\u66f4\u65b0',
  createdSuccess: '\u9879\u76ee\u5df2\u521b\u5efa',
  deletedSuccess: '\u9879\u76ee\u5df2\u5220\u9664',
  keepOneColumn: '\u81f3\u5c11\u4fdd\u7559\u4e00\u5217\u663e\u793a',
  total: '\u5171',
  items: '\u6761',
  sortSummaryPrefix: '\u5f53\u524d\u9ed8\u8ba4\u6392\u5e8f\uff1a',
  hiddenSummaryPrefix: '\uff0c\u5f53\u524d\u9690\u85cf\u72b6\u6001\uff1a',
  none: '\u65e0',
  ascendText: '\u5347\u5e8f',
  descendText: '\u964d\u5e8f',
  validateCode: '\u8bf7\u8f93\u5165\u9879\u76ee\u7f16\u53f7',
  validateName: '\u8bf7\u8f93\u5165\u9879\u76ee\u540d\u79f0',
  validateStatus: '\u8bf7\u9009\u62e9\u9879\u76ee\u72b6\u6001',
};

const PROJECT_TYPES = [T.typeDev, T.typeEngineering, T.typeService];
const PROJECT_LIST_SETTINGS_KEY = 'project-list-settings-v1';

type ProjectColumnKey =
  | 'project_code'
  | 'project_name'
  | 'start_date'
  | 'status'
  | 'budget'
  | 'manager'
  | 'remark'
  | 'contracts';

type ProjectSortField = Exclude<ProjectColumnKey, 'remark' | 'contracts'> | 'created_at' | 'updated_at';

interface ProjectListSettings {
  visibleColumns: ProjectColumnKey[];
  sortField: ProjectSortField;
  sortOrder: 'ascend' | 'descend';
  hiddenStatuses: string[];
}

const DEFAULT_PROJECT_LIST_SETTINGS: ProjectListSettings = {
  visibleColumns: ['project_code', 'project_name', 'start_date', 'status', 'budget', 'manager', 'remark', 'contracts'],
  sortField: 'start_date',
  sortOrder: 'descend',
  hiddenStatuses: ['结项'],
};

const COLUMN_OPTIONS: Array<{ label: string; value: ProjectColumnKey }> = [
  { label: T.colCode, value: 'project_code' },
  { label: T.colName, value: 'project_name' },
  { label: T.colStartDate, value: 'start_date' },
  { label: T.colStatus, value: 'status' },
  { label: T.colBudget, value: 'budget' },
  { label: T.colManager, value: 'manager' },
  { label: T.colRemark, value: 'remark' },
  { label: T.colContracts, value: 'contracts' },
];

const SORT_OPTIONS: Array<{ label: string; value: ProjectSortField }> = [
  { label: T.colCode, value: 'project_code' },
  { label: T.colName, value: 'project_name' },
  { label: T.colStartDate, value: 'start_date' },
  { label: T.colStatus, value: 'status' },
  { label: T.colBudget, value: 'budget' },
  { label: T.colManager, value: 'manager' },
  { label: T.colCreatedAt, value: 'created_at' },
  { label: T.colUpdatedAt, value: 'updated_at' },
];

function readProjectListSettings(): ProjectListSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_PROJECT_LIST_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(PROJECT_LIST_SETTINGS_KEY);
    if (!raw) {
      return DEFAULT_PROJECT_LIST_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<ProjectListSettings>;
    const visibleColumns = COLUMN_OPTIONS.map((item) => item.value).filter((value) =>
      parsed.visibleColumns?.includes(value),
    );
    const hiddenStatuses = PROJECT_STATUSES.filter((value) => parsed.hiddenStatuses?.includes(value));
    const sortField = SORT_OPTIONS.some((item) => item.value === parsed.sortField)
      ? (parsed.sortField as ProjectSortField)
      : DEFAULT_PROJECT_LIST_SETTINGS.sortField;
    const sortOrder = parsed.sortOrder === 'ascend' ? 'ascend' : 'descend';

    return {
      visibleColumns: visibleColumns.length ? visibleColumns : DEFAULT_PROJECT_LIST_SETTINGS.visibleColumns,
      sortField,
      sortOrder,
      hiddenStatuses,
    };
  } catch {
    return DEFAULT_PROJECT_LIST_SETTINGS;
  }
}

function writeProjectListSettings(settings: ProjectListSettings) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(PROJECT_LIST_SETTINGS_KEY, JSON.stringify(settings));
}

const ProjectsPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState<string>();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [kanbanProjects, setKanbanProjects] = useState<Project[]>([]);
  const [kanbanLoading, setKanbanLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState<ProjectListSettings>(readProjectListSettings);
  const [draftSettings, setDraftSettings] = useState<ProjectListSettings>(readProjectListSettings);
  const [form] = Form.useForm();

  const loadProjects = async () => {
    setLoading(true);
    try {
      const result = await fetchProjects({
        page,
        page_size: pageSize,
        status,
        search: search || undefined,
        exclude_statuses: settings.hiddenStatuses.length ? settings.hiddenStatuses.join(',') : undefined,
        sort_field: settings.sortField,
        sort_order: settings.sortOrder === 'ascend' ? 'asc' : 'desc',
      });
      setProjects(result.items);
      setTotal(result.total);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadKanbanProjects = async () => {
    setKanbanLoading(true);
    try {
      const result = await fetchAllProjects({ search: search || undefined });
      setKanbanProjects(result);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setKanbanLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, [page, pageSize, status, search, settings]);

  useEffect(() => {
    if (viewMode === 'kanban') void loadKanbanProjects();
  }, [viewMode, search]);

  const persistSettings = (nextSettings: ProjectListSettings) => {
    setSettings(nextSettings);
    writeProjectListSettings(nextSettings);
  };

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
        message.success(T.updatedSuccess);
      } else {
        await createProject(payload);
        message.success(T.createdSuccess);
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      setPage(1);
      void loadProjects();
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (record: Project) => {
    try {
      await deleteProject(record.id);
      message.success(T.deletedSuccess);
      void loadProjects();
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const handleTableChange = (_pagination: unknown, _filters: unknown, sorter: unknown) => {
    if (!sorter || Array.isArray(sorter)) {
      return;
    }

    const nextSorter = sorter as { field?: string; order?: 'ascend' | 'descend' };
    if (!nextSorter.field || !nextSorter.order) {
      return;
    }

    const matchedSortField = SORT_OPTIONS.find((item) => item.value === nextSorter.field);
    if (!matchedSortField) {
      return;
    }

    persistSettings({
      ...settings,
      sortField: matchedSortField.value,
      sortOrder: nextSorter.order,
    });
    setPage(1);
  };

  const allColumns: Array<ColumnsType<Project>[number] & { key: ProjectColumnKey }> = useMemo(
    () => [
      {
        title: T.colCode,
        dataIndex: 'project_code',
        key: 'project_code',
        width: 180,
        responsive: ['md'],
        sorter: true,
        sortOrder: settings.sortField === 'project_code' ? settings.sortOrder : undefined,
      },
      {
        title: T.colName,
        dataIndex: 'project_name',
        key: 'project_name',
        width: 300,
        ellipsis: true,
        sorter: true,
        sortOrder: settings.sortField === 'project_name' ? settings.sortOrder : undefined,
        render: (_value: unknown, record: Project) => (
          <div className="table-cell-stack">
            <Link to={`/projects/${record.id}`} className="table-link-ellipsis table-cell-title" title={record.project_name}>
              {record.project_name}
            </Link>
            {isMobile && (
              <>
                <span className="table-cell-subtitle">{record.project_code}</span>
                <span className="table-cell-meta">{record.manager || '未设置负责人'}</span>
              </>
            )}
          </div>
        ),
      },
      {
        title: T.colStartDate,
        dataIndex: 'start_date',
        key: 'start_date',
        width: 120,
        responsive: ['lg'],
        sorter: true,
        sortOrder: settings.sortField === 'start_date' ? settings.sortOrder : undefined,
        render: (value: string | null) => value || '-',
      },
      {
        title: T.colStatus,
        dataIndex: 'status',
        key: 'status',
        width: 110,
        sorter: true,
        sortOrder: settings.sortField === 'status' ? settings.sortOrder : undefined,
        render: (value: string) => <Tag color={PROJECT_STATUS_COLORS[value] ?? 'default'}>{value}</Tag>,
      },
      {
        title: T.colBudget,
        dataIndex: 'budget',
        key: 'budget',
        width: 140,
        responsive: ['sm'],
        sorter: true,
        sortOrder: settings.sortField === 'budget' ? settings.sortOrder : undefined,
        render: (value: number | null) => (value != null ? `\u00a5${Number(value).toLocaleString()}` : '-'),
      },
      {
        title: T.colManager,
        dataIndex: 'manager',
        key: 'manager',
        width: 100,
        responsive: ['xl'],
        sorter: true,
        sortOrder: settings.sortField === 'manager' ? settings.sortOrder : undefined,
        render: (value: string | null) => value || '-',
      },
      {
        title: T.colRemark,
        dataIndex: 'remark',
        key: 'remark',
        width: 180,
        responsive: ['xl'],
        ellipsis: true,
        render: (value: string | null) => value || '-',
      },
      {
        title: T.colContracts,
        key: 'contracts',
        width: 120,
        responsive: ['md'],
        render: (_value: unknown, record: Project) => (
          <Link to={`/projects/${record.id}`}>
            {record.contract_count != null ? `${record.contract_count} \u4e2a\u5408\u540c` : '\u67e5\u770b'}
          </Link>
        ),
      },
    ],
    [isMobile, settings.sortField, settings.sortOrder],
  );

  const visibleColumns = allColumns.filter((column) => settings.visibleColumns.includes(column.key));
  const columns: ColumnsType<Project> = [
    ...visibleColumns,
    {
      title: T.colActions,
      key: 'actions',
      width: 150,
      fixed: isMobile ? undefined : 'right',
      render: (_value: unknown, record: Project) => (
        <Space wrap direction={isMobile ? 'vertical' : 'horizontal'} className="table-actions">
          <Button type="link" onClick={() => openEditModal(record)}>
            {T.editButton}
          </Button>
          <Button type="link" danger onClick={() => void handleDelete(record)}>
            {T.deleteButton}
          </Button>
        </Space>
      ),
    },
  ];

  const sortLabel = useMemo(
    () => SORT_OPTIONS.find((item) => item.value === settings.sortField)?.label ?? T.colStartDate,
    [settings.sortField],
  );
  const hiddenStatusLabel = settings.hiddenStatuses.length ? settings.hiddenStatuses.join('\u3001') : T.none;

  return (
    <div className="detail-stack">
      <div>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          {T.pageTitle}
        </Typography.Title>
        <Typography.Text type="secondary">
          {T.pageDesc}
          {T.sortSummaryPrefix}
          {sortLabel}
          {settings.sortOrder === 'ascend' ? T.ascendText : T.descendText}
          {T.hiddenSummaryPrefix}
          {hiddenStatusLabel}
          {'\u3002'}
        </Typography.Text>
      </div>

      <div className="page-panel" style={{ padding: isMobile ? 16 : 20 }}>
        <div className="action-bar">
          <div className="action-left">
            <Input.Search
              placeholder={T.searchPlaceholder}
              allowClear
              style={{ width: isMobile ? '100%' : 260 }}
              onSearch={(value) => {
                setSearch(value.trim());
                setPage(1);
              }}
            />
            <Select
              placeholder={T.statusPlaceholder}
              allowClear
              style={{ width: isMobile ? '100%' : 180 }}
              options={PROJECT_STATUSES.map((item) => ({ label: item, value: item }))}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            />
          </div>
          <Space wrap className="action-right">
            <Tooltip title={viewMode === 'table' ? '\u770b\u677f\u89c6\u56fe' : '\u5217\u8868\u89c6\u56fe'}>
              <Button
                icon={viewMode === 'table' ? <AppstoreOutlined /> : <BarsOutlined />}
                onClick={() => setViewMode((m) => (m === 'table' ? 'kanban' : 'table'))}
              />
            </Tooltip>
            {viewMode === 'table' && (
              <Button
                icon={<SettingOutlined />}
                onClick={() => {
                  setDraftSettings(settings);
                  setSettingsOpen(true);
                }}
              >
                {T.settingsButton}
              </Button>
            )}
            <Button
              onClick={() => {
                const params = new URLSearchParams({ format: 'xlsx' });
                if (search) params.set('search', search);
                if (status) params.set('status', status);
                if (settings.hiddenStatuses.length) {
                  params.set('exclude_statuses', settings.hiddenStatuses.join(','));
                }
                params.set('sort_field', settings.sortField);
                params.set('sort_order', settings.sortOrder === 'ascend' ? 'asc' : 'desc');
                window.open(`${API_BASE_URL}/export/projects?${params.toString()}`, '_blank');
              }}
            >
              {T.exportButton}
            </Button>
            <Button type="primary" onClick={openCreateModal}>
              {T.createButton}
            </Button>
          </Space>
        </div>

        {viewMode === 'kanban' ? (
          <Spin spinning={kanbanLoading}>
            <div className="kanban-board">
              {PROJECT_STATUSES.map((colStatus) => {
                const colProjects = kanbanProjects.filter((p) => p.status === colStatus);
                return (
                  <div key={colStatus} className="kanban-col">
                    <div className="kanban-col-header">
                      <Typography.Text strong>{colStatus}</Typography.Text>
                      <Tag>{colProjects.length}</Tag>
                    </div>
                    {colProjects.map((project) => (
                      <div
                        key={project.id}
                        className="kanban-card"
                        onClick={() => navigate(`/projects/${project.id}`)}
                      >
                        <div className="kanban-card-name" title={project.project_name}>
                          {project.project_name}
                        </div>
                        <div className="kanban-card-code">{project.project_code}</div>
                        <div className="kanban-card-meta">
                          <span>{project.manager || '\u65e0\u8d1f\u8d23\u4eba'}</span>
                          <span>
                            {project.budget != null ? `\u00a5${Number(project.budget).toLocaleString()}` : '-'}
                          </span>
                        </div>
                        <div className="kanban-card-meta" style={{ marginTop: 6 }}>
                          <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
                            {project.contract_count ?? 0} \u4e2a\u5408\u540c
                          </Tag>
                          {project.start_date && (
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>{project.start_date}</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {colProjects.length === 0 && (
                      <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                        \u6682\u65e0\u9879\u76ee
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Spin>
        ) : (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={projects}
            loading={loading}
            size={isMobile ? 'small' : 'middle'}
            scroll={{ x: isMobile ? 720 : 1200 }}
            onChange={handleTableChange}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: (value: number) => `${T.total} ${value} ${T.items}`,
              onChange: (nextPage, nextPageSize) => {
                setPage(nextPage);
                setPageSize(nextPageSize);
              },
            }}
          />
        )}
      </div>

      <Drawer
        title={T.settingsTitle}
        open={settingsOpen}
        width={isMobile ? '100%' : 420}
        onClose={() => setSettingsOpen(false)}
        extra={
          <Space wrap className="card-extra-actions">
            <Button onClick={() => setDraftSettings(DEFAULT_PROJECT_LIST_SETTINGS)}>{T.resetButton}</Button>
            <Button
              type="primary"
              onClick={() => {
                if (!draftSettings.visibleColumns.length) {
                  message.warning(T.keepOneColumn);
                  return;
                }
                persistSettings(draftSettings);
                setPage(1);
                setSettingsOpen(false);
              }}
            >
              {T.saveButton}
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" size={20} style={{ width: '100%' }} className="settings-stack">
          <div>
            <Typography.Text strong>{T.sectionColumns}</Typography.Text>
            <Divider style={{ margin: '10px 0 14px' }} />
            <Checkbox.Group
              style={{ display: 'grid', gap: 10 }}
              value={draftSettings.visibleColumns}
              options={COLUMN_OPTIONS}
              onChange={(checkedValue) => {
                setDraftSettings((current) => ({
                  ...current,
                  visibleColumns: checkedValue as ProjectColumnKey[],
                }));
              }}
            />
          </div>

          <div>
            <Typography.Text strong>{T.sectionSort}</Typography.Text>
            <Divider style={{ margin: '10px 0 14px' }} />
            <Space direction="vertical" style={{ width: '100%' }} className="settings-form-stack">
              <Select
                style={{ width: '100%' }}
                value={draftSettings.sortField}
                options={SORT_OPTIONS}
                onChange={(value: ProjectSortField) => {
                  setDraftSettings((current) => ({
                    ...current,
                    sortField: value,
                  }));
                }}
              />
              <Select
                style={{ width: '100%' }}
                value={draftSettings.sortOrder}
                options={[
                  { label: T.sortAsc, value: 'ascend' },
                  { label: T.sortDesc, value: 'descend' },
                ]}
                onChange={(value: 'ascend' | 'descend') => {
                  setDraftSettings((current) => ({
                    ...current,
                    sortOrder: value,
                  }));
                }}
              />
            </Space>
          </div>

          <div>
            <Typography.Text strong>{T.sectionHiddenStatus}</Typography.Text>
            <Divider style={{ margin: '10px 0 14px' }} />
            <Select
              mode="multiple"
              allowClear
              style={{ width: '100%' }}
              placeholder={T.hiddenStatusPlaceholder}
              value={draftSettings.hiddenStatuses}
              options={PROJECT_STATUSES.map((item) => ({ label: item, value: item }))}
              onChange={(value: string[]) => {
                setDraftSettings((current) => ({
                  ...current,
                  hiddenStatuses: value,
                }));
              }}
            />
          </div>
        </Space>
      </Drawer>

      <Modal
        title={editing ? T.editTitle : T.createTitle}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        width={isMobile ? 'calc(100vw - 24px)' : undefined}
        destroyOnClose
      >
        <Form layout="vertical" form={form}>
          <Form.Item label={T.formCode} name="project_code" rules={[{ required: true, message: T.validateCode }]}>
            <Input />
          </Form.Item>
          <Form.Item label={T.formName} name="project_name" rules={[{ required: true, message: T.validateName }]}>
            <Input />
          </Form.Item>
          <Form.Item label={T.formType} name="project_type">
            <Select allowClear options={PROJECT_TYPES.map((item) => ({ label: item, value: item }))} />
          </Form.Item>
          <Form.Item label={T.formDate} name="start_date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={T.formStatus} name="status" rules={[{ required: true, message: T.validateStatus }]}>
            <Select options={PROJECT_STATUSES.map((item) => ({ label: item, value: item }))} />
          </Form.Item>
          <Form.Item label={T.formBudget} name="budget">
            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={T.formManager} name="manager">
            <Input />
          </Form.Item>
          <Form.Item label={T.formRemark} name="remark">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectsPage;
