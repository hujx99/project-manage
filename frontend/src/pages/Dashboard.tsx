import { useEffect, useMemo, useState } from 'react';
import { Card, Col, Empty, List, Progress, Row, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ProjectOutlined,
  FileTextOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { Pie } from '@ant-design/charts';
import { useNavigate } from 'react-router-dom';

import {
  fetchDashboardSummary,
  fetchPendingPayments,
  fetchProjectOverview,
  type DashboardSummary,
  type PaymentOverview,
  type PendingPayment,
  type ProjectOverview,
} from '../services/dashboard';

const { Title, Text } = Typography;

function formatMoney(value: number): string {
  return `¥${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const statusColorMap: Record<string, string> = {
  '执行中': 'blue',
  '已完成': 'green',
  '已终止': 'red',
  '草稿': 'default',
  '审批中': 'orange',
};

const paymentStatusColorMap: Record<string, string> = {
  '已付款': 'green',
  '未付款': 'default',
  '已提交': 'orange',
  '审批中': 'blue',
  '已拒绝': 'red',
};

const columnStyle: React.CSSProperties = {
  height: 420,
  overflowY: 'auto',
  borderRight: '1px solid #f0f0f0',
};

const listItemStyle = (selected: boolean): React.CSSProperties => ({
  padding: '10px 12px',
  cursor: 'pointer',
  backgroundColor: selected ? '#e6f4ff' : undefined,
  borderLeft: selected ? '3px solid #1890ff' : '3px solid transparent',
  transition: 'all 0.2s',
});

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [projectOverview, setProjectOverview] = useState<ProjectOverview[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        const [summaryRes, pendingRes, overviewRes] = await Promise.all([
          fetchDashboardSummary(),
          fetchPendingPayments(),
          fetchProjectOverview(),
        ]);
        setSummary(summaryRes);
        setPendingPayments(pendingRes);
        setProjectOverview(overviewRes);
        // Auto-select first project
        if (overviewRes.length > 0) {
          setSelectedProjectId(overviewRes[0].id);
          if (overviewRes[0].contracts.length > 0) {
            setSelectedContractId(overviewRes[0].contracts[0].id);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    void loadDashboardData();
  }, []);

  const selectedProject = useMemo(
    () => projectOverview.find((p) => p.id === selectedProjectId) ?? null,
    [projectOverview, selectedProjectId],
  );

  const selectedContract = useMemo(
    () => selectedProject?.contracts.find((c) => c.id === selectedContractId) ?? null,
    [selectedProject, selectedContractId],
  );

  const handleSelectProject = (projectId: number) => {
    setSelectedProjectId(projectId);
    const project = projectOverview.find((p) => p.id === projectId);
    if (project && project.contracts.length > 0) {
      setSelectedContractId(project.contracts[0].id);
    } else {
      setSelectedContractId(null);
    }
  };

  const pendingColumns: ColumnsType<PendingPayment> = useMemo(
    () => [
      {
        title: '项目名称',
        dataIndex: 'project_name',
        key: 'project_name',
      },
      {
        title: '合同名称',
        dataIndex: 'contract_name',
        key: 'contract_name',
      },
      {
        title: '金额',
        dataIndex: 'amount',
        key: 'amount',
        render: (value: number) => formatMoney(value),
      },
      {
        title: '计划日期',
        dataIndex: 'planned_date',
        key: 'planned_date',
        sorter: (a, b) => new Date(a.planned_date).getTime() - new Date(b.planned_date).getTime(),
        defaultSortOrder: 'ascend',
        render: (value: string) => {
          const remainingDays = Math.ceil((new Date(value).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          const isUrgent = remainingDays <= 7;
          return <span style={{ color: isUrgent ? '#ff4d4f' : undefined }}>{value}</span>;
        },
      },
    ],
    [],
  );

  // --- Miller Columns rendering ---

  const renderProjectColumn = () => (
    <div style={columnStyle}>
      <div style={{ padding: '8px 12px', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
        <Text strong>项目列表</Text>
        <Text type="secondary" style={{ float: 'right' }}>{projectOverview.length} 个</Text>
      </div>
      {projectOverview.length === 0 ? (
        <Empty description="暂无项目" style={{ marginTop: 60 }} />
      ) : (
        <List
          dataSource={projectOverview}
          renderItem={(project) => (
            <div
              style={listItemStyle(project.id === selectedProjectId)}
              onClick={() => handleSelectProject(project.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong ellipsis style={{ maxWidth: '70%' }}>{project.project_name}</Text>
                <RightOutlined style={{ color: '#bfbfbf', fontSize: 10 }} />
              </div>
              <div style={{ marginTop: 4 }}>
                <Tag color={statusColorMap[project.status] || 'default'} style={{ marginRight: 4 }}>{project.status}</Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>合同 {project.contract_count} 个</Text>
              </div>
              <div style={{ marginTop: 4, fontSize: 12 }}>
                <span>预算: {formatMoney(project.budget)}</span>
                {project.total_pending_amount > 0 && (
                  <span style={{ color: '#cf1322', marginLeft: 8 }}>
                    待付: {formatMoney(project.total_pending_amount)}
                  </span>
                )}
              </div>
              <a
                onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project.id}`); }}
                style={{ fontSize: 12 }}
              >
                查看详情
              </a>
            </div>
          )}
        />
      )}
    </div>
  );

  const renderContractColumn = () => {
    const contracts = selectedProject?.contracts ?? [];
    return (
      <div style={columnStyle}>
        <div style={{ padding: '8px 12px', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
          <Text strong>合同列表</Text>
          <Text type="secondary" style={{ float: 'right' }}>{contracts.length} 个</Text>
        </div>
        {selectedProject && contracts.length > 0 && (
          <div style={{ padding: '6px 12px', background: '#f6ffed', borderBottom: '1px solid #f0f0f0', fontSize: 12 }}>
            <span>合同总额: {formatMoney(selectedProject.total_contract_amount)}</span>
            <span style={{ marginLeft: 8 }}>待付: <span style={{ color: '#cf1322' }}>{formatMoney(selectedProject.total_pending_amount)}</span></span>
          </div>
        )}
        {!selectedProject ? (
          <Empty description="请选择项目" style={{ marginTop: 60 }} />
        ) : contracts.length === 0 ? (
          <Empty description="暂无合同" style={{ marginTop: 60 }} />
        ) : (
          <List
            dataSource={contracts}
            renderItem={(contract) => {
              const total = Number(contract.paid_amount) + Number(contract.pending_amount);
              const percent = total > 0 ? Math.round((Number(contract.paid_amount) / total) * 100) : 0;
              return (
                <div
                  style={listItemStyle(contract.id === selectedContractId)}
                  onClick={() => setSelectedContractId(contract.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong ellipsis style={{ maxWidth: '70%' }}>{contract.contract_name}</Text>
                    <RightOutlined style={{ color: '#bfbfbf', fontSize: 10 }} />
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12 }}>
                    <Tag color={statusColorMap[contract.status] || 'default'} style={{ marginRight: 4 }}>{contract.status}</Tag>
                    <Text type="secondary">{contract.vendor}</Text>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12 }}>
                    <span>金额: {formatMoney(contract.amount)}</span>
                    <span style={{ marginLeft: 8 }}>已付: {formatMoney(contract.paid_amount)}</span>
                  </div>
                  <Progress percent={percent} size="small" style={{ marginTop: 4, marginBottom: 0 }} />
                  <a
                    onClick={(e) => { e.stopPropagation(); navigate(`/contracts/${contract.id}`); }}
                    style={{ fontSize: 12 }}
                  >
                    查看详情
                  </a>
                </div>
              );
            }}
          />
        )}
      </div>
    );
  };

  const renderPaymentColumn = () => {
    const payments = selectedContract?.payments ?? [];
    const contractAmount = selectedContract?.amount ?? 0;
    const paidAmount = selectedContract?.paid_amount ?? 0;
    const progressPercent = contractAmount > 0 ? Math.round((paidAmount / contractAmount) * 100) : 0;

    return (
      <div style={{ ...columnStyle, borderRight: 'none' }}>
        <div style={{ padding: '8px 12px', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
          <Text strong>付款明细</Text>
          <Text type="secondary" style={{ float: 'right' }}>{payments.length} 笔</Text>
        </div>
        {selectedContract && payments.length > 0 && (
          <div style={{ padding: '6px 12px', background: '#fff7e6', borderBottom: '1px solid #f0f0f0', fontSize: 12 }}>
            <span>合同额: {formatMoney(contractAmount)}</span>
            <span style={{ marginLeft: 8 }}>已付: {formatMoney(paidAmount)}</span>
            <span style={{ marginLeft: 8 }}>进度: {progressPercent}%</span>
          </div>
        )}
        {!selectedContract ? (
          <Empty description="请选择合同" style={{ marginTop: 60 }} />
        ) : payments.length === 0 ? (
          <Empty description="暂无付款记录" style={{ marginTop: 60 }} />
        ) : (
          <List
            dataSource={payments}
            renderItem={(payment: PaymentOverview) => (
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong>{payment.phase || `第${payment.seq ?? '-'}期`}</Text>
                  <Tag color={paymentStatusColorMap[payment.payment_status] || 'default'}>
                    {payment.payment_status}
                  </Tag>
                </div>
                <div style={{ marginTop: 4, fontSize: 12 }}>
                  <span>计划: {formatMoney(payment.planned_amount)}</span>
                  <span style={{ marginLeft: 8 }}>实付: {formatMoney(payment.actual_amount)}</span>
                </div>
                {payment.pending_amount > 0 && (
                  <div style={{ fontSize: 12, color: '#cf1322', marginTop: 2 }}>
                    待付: {formatMoney(payment.pending_amount)}
                  </div>
                )}
                {payment.planned_date && (
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                    计划日期: {payment.planned_date}
                  </div>
                )}
              </div>
            )}
          />
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>仪表盘</Title>

      {/* 顶部汇总卡片 */}
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="项目总数"
              value={summary?.project_count ?? 0}
              loading={loading}
              prefix={<ProjectOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="合同总数"
              value={summary?.contract_count ?? 0}
              loading={loading}
              prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总合同额"
              value={summary?.total_contract_amount ?? 0}
              formatter={(value) => formatMoney(Number(value))}
              loading={loading}
              prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总待付款"
              value={summary?.total_pending_amount ?? 0}
              formatter={(value) => formatMoney(Number(value))}
              loading={loading}
              prefix={<ClockCircleOutlined style={{ color: '#cf1322' }} />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 中部：饼图 + 三栏级联面板 */}
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={6}>
          <Card title="项目状态分布" loading={loading} style={{ height: '100%' }}>
            <Pie
              data={summary?.project_status_distribution ?? []}
              angleField="count"
              colorField="status"
              label={{ text: 'status', position: 'outside' }}
              legend={{ color: { title: false, position: 'right' } }}
              height={320}
            />
          </Card>
        </Col>
        <Col span={18}>
          <Card
            title="项目-合同-付款 三级钻取"
            loading={loading}
            bodyStyle={{ padding: 0 }}
          >
            <Row>
              <Col span={8}>{renderProjectColumn()}</Col>
              <Col span={8}>{renderContractColumn()}</Col>
              <Col span={8}>{renderPaymentColumn()}</Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 底部：30天待付款提醒 */}
      <Card title="未来 30 天待付款提醒" style={{ marginTop: 16 }}>
        <Table
          rowKey={(row) => `${row.project_name}-${row.contract_name}-${row.planned_date}`}
          columns={pendingColumns}
          dataSource={pendingPayments}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}
