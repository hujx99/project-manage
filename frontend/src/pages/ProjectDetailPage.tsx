import { Button, Card, Descriptions, Progress, Skeleton, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType, TableProps } from 'antd/es/table';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getPaymentStatusColor, normalizePaymentStatus, PROJECT_STATUS_COLORS } from '../constants/business';
import useIsMobile from '../hooks/useIsMobile';
import { fetchContracts } from '../services/contracts';
import { fetchAllProjects, fetchProject } from '../services/projects';
import type { Contract, Payment, Project } from '../types';

function compareText(a?: string | null, b?: string | null) {
  return (a ?? '').localeCompare(b ?? '', 'zh-CN');
}

function compareNumber(a?: number | null, b?: number | null) {
  return Number(a ?? 0) - Number(b ?? 0);
}

const ProjectDetailPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [prevId, setPrevId] = useState<number | null>(null);
  const [nextId, setNextId] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [projectDetail, contractList, allProjects] = await Promise.all([
          fetchProject(Number(id)),
          fetchContracts(),
          fetchAllProjects({ sort_field: 'start_date', sort_order: 'desc' }),
        ]);
        setProject(projectDetail);
        setContracts(contractList.filter((item) => item.project_id === Number(id)));
        const ids = allProjects.map((p) => p.id);
        const idx = ids.indexOf(Number(id));
        setPrevId(idx > 0 ? ids[idx - 1] : null);
        setNextId(idx < ids.length - 1 ? ids[idx + 1] : null);
      } catch (error) {
        message.error((error as Error).message);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [id]);

  const summary = useMemo(() => {
    const totalContractAmount = contracts.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const totalPaid = contracts.reduce(
      (sum, item) => sum + item.payments.reduce((paymentSum, payment) => paymentSum + Number(payment.actual_amount ?? 0), 0),
      0,
    );
    const totalPending = contracts.reduce(
      (sum, item) => sum + item.payments.reduce((paymentSum, payment) => paymentSum + Number(payment.pending_amount ?? 0), 0),
      0,
    );
    const progress = totalContractAmount ? Math.round((totalPaid / totalContractAmount) * 100) : 0;
    return { totalContractAmount, totalPaid, totalPending, progress };
  }, [contracts]);

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
      render: (v: string) => <Tag color={getPaymentStatusColor(v)}>{normalizePaymentStatus(v)}</Tag>,
    },
    { title: '备注', dataIndex: 'remark', ellipsis: true, responsive: ['lg'], render: (v) => v || '-' },
  ];

  const contractExpandable: TableProps<Contract>['expandable'] = {
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
      width: 220,
      responsive: ['md'],
      sorter: (a, b) => compareText(a.contract_code, b.contract_code),
      render: (_, record) => <Link to={`/contracts/${record.id}`}>{record.contract_code}</Link>,
    },
    {
      title: '合同名称',
      dataIndex: 'contract_name',
      sorter: (a, b) => compareText(a.contract_name, b.contract_name),
      render: (value: string, record) => (
        <div className="table-cell-stack">
          <Link to={`/contracts/${record.id}`} className="table-link-ellipsis table-cell-title" title={value}>
            {value}
          </Link>
          {isMobile && (
            <>
              <span className="table-cell-subtitle">{record.contract_code}</span>
              <span className="table-cell-meta">{record.vendor || '-'}</span>
            </>
          )}
        </div>
      ),
    },
    {
      title: '供应商',
      dataIndex: 'vendor',
      width: 220,
      responsive: ['lg'],
      sorter: (a, b) => compareText(a.vendor, b.vendor),
      render: (value) => value || '-',
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 140,
      sorter: (a, b) => compareNumber(a.amount, b.amount),
      render: (value) => `¥${Number(value).toLocaleString()}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      responsive: ['sm'],
      sorter: (a, b) => compareText(a.status, b.status),
      render: (value) => <Tag>{value}</Tag>,
    },
  ];

  if (loading) {
    return <Skeleton active paragraph={{ rows: 8 }} className="page-panel" />;
  }

  if (!project) {
    return <Typography.Text>项目不存在</Typography.Text>;
  }

  return (
    <div className="detail-stack">
      <Card
        className="page-panel"
        title={`项目详情：${project.project_name}`}
        extra={
          <Space wrap className="card-extra-actions">
            <Button
              icon={<LeftOutlined />}
              disabled={!prevId}
              onClick={() => prevId && navigate(`/projects/${prevId}`)}
            >
              上一个
            </Button>
            <Button
              icon={<RightOutlined />}
              disabled={!nextId}
              onClick={() => nextId && navigate(`/projects/${nextId}`)}
            >
              下一个
            </Button>
          </Space>
        }
      >
        <Descriptions className="detail-descriptions" column={{ xs: 1, sm: 1, md: 2, lg: 3 }}>
          <Descriptions.Item label="项目编号">{project.project_code}</Descriptions.Item>
          <Descriptions.Item label="项目属性">{project.project_type || '-'}</Descriptions.Item>
          <Descriptions.Item label="项目状态">
            <Tag color={PROJECT_STATUS_COLORS[project.status] ?? 'default'}>{project.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="项目金额">
            {project.budget != null ? `¥${Number(project.budget).toLocaleString()}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="负责人">{project.manager || '-'}</Descriptions.Item>
          <Descriptions.Item label="立项时间">{project.start_date || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{project.created_at ? project.created_at.slice(0, 10) : '-'}</Descriptions.Item>
          <Descriptions.Item label="更新时间" span={{ xs: 1, sm: 1, md: 1, lg: 2 }}>
            {project.updated_at ? project.updated_at.slice(0, 10) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="备注" span={{ xs: 1, sm: 1, md: 2, lg: 3 }}>
            {project.remark || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <div className="summary-grid">
        <Card className="page-panel summary-card">
          <Statistic title="合同总数" value={contracts.length} />
        </Card>
        <Card className="page-panel summary-card">
          <Statistic title="合同总金额" value={summary.totalContractAmount} precision={2} prefix="¥" />
        </Card>
        <Card className="page-panel summary-card">
          <Statistic title="已付总额" value={summary.totalPaid} precision={2} prefix="¥" />
        </Card>
        <Card className="page-panel summary-card">
          <Statistic title="待付总额" value={summary.totalPending} precision={2} prefix="¥" />
        </Card>
      </div>

      <Card className="page-panel" title="付款进度">
        <Progress percent={summary.progress} strokeColor="#0f766e" />
      </Card>

      <Card className="page-panel" title="该项目下的合同列表">
        <Table
          rowKey="id"
          dataSource={contracts}
          columns={columns}
          expandable={contractExpandable}
          pagination={false}
          size={isMobile ? 'small' : 'middle'}
          scroll={{ x: isMobile ? 760 : 1000 }}
          locale={{ emptyText: '暂无合同' }}
        />
      </Card>
    </div>
  );
};

export default ProjectDetailPage;
