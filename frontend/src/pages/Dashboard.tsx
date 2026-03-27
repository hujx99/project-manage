import { Card, Empty, Progress, Skeleton, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import type { Contract, Payment, Project } from '../types';
import { fetchContracts } from '../services/contracts';
import { fetchPayments } from '../services/payments';
import { fetchProjects } from '../services/projects';

interface PendingPaymentRow extends Payment {
  project_name: string;
  contract_name: string;
}

const Dashboard = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [payments, setPayments] = useState<PendingPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [projectRes, contractRes, paymentRes] = await Promise.all([
          fetchProjects({ page: 1, page_size: 1000 }),
          fetchContracts(),
          fetchPayments(),
        ]);

        const projectNameMap = new Map(projectRes.items.map((item) => [item.id, item.project_name]));
        const contractMap = new Map(contractRes.map((item) => [item.id, item]));

        const enrichedPayments = paymentRes.map((item) => {
          const contract = contractMap.get(item.contract_id);
          return {
            ...item,
            contract_name: contract?.contract_name ?? '-',
            project_name: contract ? (projectNameMap.get(contract.project_id) ?? '-') : '-',
          };
        });

        setProjects(projectRes.items);
        setContracts(contractRes);
        setPayments(enrichedPayments);
      } catch (error) {
        message.error((error as Error).message);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const totals = useMemo(() => {
    const totalBudget = projects.reduce((sum, item) => sum + Number(item.budget ?? 0), 0);
    const totalContractAmount = contracts.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const totalPaid = payments.reduce((sum, item) => sum + Number(item.actual_amount ?? 0), 0);
    const totalPending = payments.reduce((sum, item) => sum + Number(item.pending_amount ?? 0), 0);
    return { totalBudget, totalContractAmount, totalPaid, totalPending };
  }, [contracts, payments, projects]);

  const projectStatusSummary = useMemo(() => {
    const counter = new Map<string, number>();
    projects.forEach((item) => {
      counter.set(item.status, (counter.get(item.status) ?? 0) + 1);
    });
    return Array.from(counter.entries()).map(([status, count]) => ({ status, count }));
  }, [projects]);

  const pendingRows = useMemo(
    () =>
      payments
        .filter((item) => Number(item.pending_amount ?? 0) > 0)
        .sort((a, b) => (a.planned_date ?? '').localeCompare(b.planned_date ?? ''))
        .slice(0, 10),
    [payments],
  );

  const pendingColumns: ColumnsType<PendingPaymentRow> = [
    { title: '项目名称', dataIndex: 'project_name' },
    { title: '合同名称', dataIndex: 'contract_name' },
    { title: '付款阶段', dataIndex: 'phase', render: (value) => value || '-' },
    { title: '计划日期', dataIndex: 'planned_date', render: (value) => value || '-' },
    {
      title: '待付款',
      dataIndex: 'pending_amount',
      render: (value) => `¥${Number(value ?? 0).toLocaleString()}`,
    },
    {
      title: '状态',
      dataIndex: 'payment_status',
      render: (value: string) => <Tag color={value === '已付款' ? 'success' : value === '已提交' ? 'processing' : 'default'}>{value}</Tag>,
    },
  ];

  return (
    <div className="detail-stack">
      <div>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          仪表盘
        </Typography.Title>
        <Typography.Text type="secondary">快速查看项目、合同与付款的整体情况。</Typography.Text>
      </div>

      <div className="summary-grid">
        <Card className="page-panel summary-card">
          <Statistic title="项目总数" value={projects.length} loading={loading} />
        </Card>
        <Card className="page-panel summary-card">
          <Statistic title="合同总数" value={contracts.length} loading={loading} />
        </Card>
        <Card className="page-panel summary-card">
          <Statistic title="付款总笔数" value={payments.length} loading={loading} />
        </Card>
        <Card className="page-panel summary-card">
          <Statistic title="付款进度" value={totals.totalContractAmount ? Math.round((totals.totalPaid / totals.totalContractAmount) * 100) : 0} suffix="%" loading={loading} />
        </Card>
      </div>

      <div className="summary-grid">
        <Card className="page-panel summary-card">
          <Statistic title="总预算" value={totals.totalBudget} precision={2} prefix="¥" loading={loading} />
        </Card>
        <Card className="page-panel summary-card">
          <Statistic title="总合同额" value={totals.totalContractAmount} precision={2} prefix="¥" loading={loading} />
        </Card>
        <Card className="page-panel summary-card">
          <Statistic title="总已付" value={totals.totalPaid} precision={2} prefix="¥" loading={loading} />
        </Card>
        <Card className="page-panel summary-card">
          <Statistic title="总待付" value={totals.totalPending} precision={2} prefix="¥" loading={loading} />
        </Card>
      </div>

      <div className="summary-grid" style={{ gridTemplateColumns: '1.15fr 1fr' }}>
        <Card className="page-panel" title="项目状态分布">
          {loading ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : projectStatusSummary.length ? (
            <Space direction="vertical" style={{ width: '100%' }} size={14}>
              {projectStatusSummary.map((item) => (
                <div key={item.status}>
                  <Space style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography.Text>{item.status}</Typography.Text>
                    <Typography.Text type="secondary">{item.count} 个</Typography.Text>
                  </Space>
                  <Progress percent={Math.round((item.count / projects.length) * 100)} showInfo={false} strokeColor="#0f766e" />
                </div>
              ))}
            </Space>
          ) : (
            <Empty description="暂无项目数据" />
          )}
        </Card>

        <Card className="page-panel" title="金额概览">
          {loading ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size={18}>
              <div>
                <Typography.Text>合同金额执行率</Typography.Text>
                <Progress
                  percent={totals.totalContractAmount ? Math.round((totals.totalPaid / totals.totalContractAmount) * 100) : 0}
                  strokeColor="#ea580c"
                />
              </div>
              <div>
                <Typography.Text>预算覆盖合同额</Typography.Text>
                <Progress
                  percent={totals.totalBudget ? Math.min(100, Math.round((totals.totalContractAmount / totals.totalBudget) * 100)) : 0}
                  strokeColor="#2563eb"
                />
              </div>
              <Typography.Text className="muted-text">
                待付款金额会随着付款记录的计划金额和实际金额自动变化。
              </Typography.Text>
            </Space>
          )}
        </Card>
      </div>

      <Card className="page-panel" title="待付款提醒">
        <Table
          rowKey="id"
          dataSource={pendingRows}
          columns={pendingColumns}
          loading={loading}
          pagination={false}
          locale={{ emptyText: '暂无待付款记录' }}
        />
      </Card>
    </div>
  );
};

export default Dashboard;
