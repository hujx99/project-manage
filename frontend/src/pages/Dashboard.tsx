import { Alert, Card, Skeleton, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Pie } from '@ant-design/charts';
import { useEffect, useMemo, useState } from 'react';
import useIsMobile from '../hooks/useIsMobile';
import { fetchDashboardSummary, fetchPendingPayments, type DashboardSummary, type PendingPayment } from '../services/dashboard';

function formatMoney(value: number) {
  return `¥${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const Dashboard = () => {
  const isMobile = useIsMobile();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [summaryResult, pendingResult] = await Promise.all([
          fetchDashboardSummary(),
          fetchPendingPayments(),
        ]);
        setSummary(summaryResult);
        setPendingPayments(pendingResult);
      } catch (error) {
        message.error((error as Error).message);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const urgentIds = useMemo(() => {
    const today = new Date();
    return new Set(
      pendingPayments
        .filter((item) => {
          if (!item.planned_date) return false;
          const target = new Date(item.planned_date);
          const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays <= 7;
        })
        .map((item) => item.id),
    );
  }, [pendingPayments]);

  const columns: ColumnsType<PendingPayment> = [
    {
      title: '项目名称',
      dataIndex: 'project_name',
      render: (value: string, record) => (
        <div className="table-cell-stack">
          <span className="table-cell-title">{value}</span>
          {isMobile && <span className="table-cell-subtitle">{record.contract_name || '-'}</span>}
        </div>
      ),
    },
    { title: '合同名称', dataIndex: 'contract_name', responsive: ['md'] },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 160,
      render: (value: number) => formatMoney(value),
    },
    {
      title: '计划日期',
      dataIndex: 'planned_date',
      width: 140,
      render: (value: string | null, record) => (
        <span style={urgentIds.has(record.id) ? { color: '#cf1322', fontWeight: 600 } : undefined}>
          {value || '-'}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'payment_status',
      width: 120,
      responsive: ['sm'],
      render: (value: string) => <Tag color={value === '已提交' ? 'processing' : 'warning'}>{value}</Tag>,
    },
  ];

  return (
    <div className="detail-stack">
      <div>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          仪表盘
        </Typography.Title>
        <Typography.Text type="secondary">查看项目、合同和付款的整体汇总，以及近期待付款提醒。</Typography.Text>
      </div>

      <div className="summary-grid">
        <Card className="page-panel summary-card">
          <Statistic title="项目数" value={summary?.project_count ?? 0} loading={loading} />
        </Card>
        <Card className="page-panel summary-card">
          <Statistic title="合同数" value={summary?.contract_count ?? 0} loading={loading} />
        </Card>
        <Card className="page-panel summary-card">
          <Statistic
            title="总合同额"
            value={summary?.total_contract_amount ?? 0}
            prefix="¥"
            precision={2}
            loading={loading}
          />
        </Card>
        <Card className="page-panel summary-card">
          <Statistic
            title="总待付款"
            value={summary?.total_pending_amount ?? 0}
            prefix="¥"
            precision={2}
            loading={loading}
          />
        </Card>
      </div>

      <Card className="page-panel" title="项目状态分布">
        {loading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          <Pie
            data={summary?.project_status_distribution ?? []}
            angleField="count"
            colorField="status"
            radius={0.82}
            innerRadius={0.45}
            legend={{ color: { position: 'bottom', itemMarker: 'circle' } }}
            labels={[
              {
                text: (data: { status: string; count: number }) => `${data.status} ${data.count}`,
                position: 'outside',
                style: { fontSize: 12 },
              },
            ]}
            height={isMobile ? 260 : 320}
          />
        )}
      </Card>

      <Card className="page-panel" title="待付款提醒">
        {urgentIds.size > 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="红色日期表示 7 天内临近到期，请优先处理。"
          />
        )}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={pendingPayments}
          loading={loading}
          size={isMobile ? 'small' : 'middle'}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 640 }}
          locale={{ emptyText: '未来 30 天内暂无待付款记录' }}
        />
      </Card>
    </div>
  );
};

export default Dashboard;
