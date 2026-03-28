import { Alert, Card, Progress, Skeleton, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Pie } from '@ant-design/charts';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPaymentStatusColor, normalizePaymentStatus } from '../constants/business';
import useIsMobile from '../hooks/useIsMobile';
import {
  fetchDashboardSummary,
  fetchDashboardWorkflow,
  fetchPendingPayments,
  type DashboardSummary,
  type DashboardWorkflowSummary,
  type PendingPayment,
} from '../services/dashboard';

function formatMoney(value: number) {
  return `¥${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getDiffDays(dateString: string | null) {
  if (!dateString) {
    return Number.POSITIVE_INFINITY;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(`${dateString}T00:00:00`);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getDueMeta(diffDays: number) {
  if (diffDays < 0) {
    return { label: '已逾期', color: 'red' };
  }
  if (diffDays === 0) {
    return { label: '今日到期', color: 'volcano' };
  }
  if (diffDays <= 7) {
    return { label: '7天内', color: 'orange' };
  }
  return { label: '待处理', color: 'blue' };
}

const Dashboard = () => {
  const isMobile = useIsMobile();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [workflow, setWorkflow] = useState<DashboardWorkflowSummary | null>(null);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [summaryResult, pendingResult, workflowResult] = await Promise.all([
          fetchDashboardSummary(),
          fetchPendingPayments(),
          fetchDashboardWorkflow(),
        ]);
        setSummary(summaryResult);
        setPendingPayments(pendingResult);
        setWorkflow(workflowResult);
      } catch (error) {
        message.error((error as Error).message);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const prioritizedPayments = useMemo(() => {
    return pendingPayments
      .map((item) => ({ ...item, diffDays: getDiffDays(item.planned_date) }))
      .sort((a, b) => a.diffDays - b.diffDays || b.amount - a.amount);
  }, [pendingPayments]);

  const urgentIds = useMemo(
    () => new Set(prioritizedPayments.filter((item) => item.diffDays <= 7).map((item) => item.id)),
    [prioritizedPayments],
  );

  const overdueCount = prioritizedPayments.filter((item) => item.diffDays < 0).length;
  const focusPayments = prioritizedPayments.slice(0, 5);
  const topStatus = useMemo(() => {
    return (summary?.project_status_distribution ?? []).reduce(
      (current, item) => (item.count > current.count ? item : current),
      { status: '暂无主状态', count: 0 },
    );
  }, [summary?.project_status_distribution]);

  const paymentExecutionRate =
    summary?.total_contract_amount && Number(summary.total_contract_amount) > 0
      ? Math.round((Number(summary.total_paid_amount) / Number(summary.total_contract_amount)) * 100)
      : 0;
  const pendingShare =
    summary?.total_contract_amount && Number(summary.total_contract_amount) > 0
      ? Math.round((Number(summary.total_pending_amount) / Number(summary.total_contract_amount)) * 100)
      : 0;

  const flowCards = useMemo(
    () => [
      {
        step: '01',
        title: '项目立项',
        description: '项目是最上游主台账，先定预算、负责人和当前阶段，再进入合同。',
        href: '/projects',
        action: '去项目台账',
        metrics: [
          { label: '项目总数', value: workflow?.project_stage.total ?? 0 },
          { label: '进行中', value: workflow?.project_stage.active_count ?? 0 },
          { label: '未落合同', value: workflow?.project_stage.unlinked_count ?? 0 },
        ],
      },
      {
        step: '02',
        title: '合同执行',
        description: '合同挂在项目下，是执行主体，金额、标的、变更和付款计划都在这里维护。',
        href: '/contracts',
        action: '去合同执行',
        metrics: [
          { label: '合同总数', value: workflow?.contract_stage.total ?? 0 },
          { label: '执行中', value: workflow?.contract_stage.active_count ?? 0 },
          { label: '未设付款计划', value: workflow?.contract_stage.without_payment_count ?? 0 },
        ],
      },
      {
        step: '03',
        title: '付款跟踪',
        description: '付款不能脱离合同存在，付款列表是跨项目的统一催办和执行跟踪视图。',
        href: '/payments',
        action: '去付款跟踪',
        metrics: [
          { label: '付款总数', value: workflow?.payment_stage.total ?? 0 },
          { label: '待提报/待支付', value: workflow?.payment_stage.unpaid_count ?? 0 },
          { label: '逾期/临期', value: (workflow?.payment_stage.overdue_count ?? 0) + (workflow?.payment_stage.due_soon_count ?? 0) },
        ],
      },
    ],
    [workflow],
  );

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
      render: (value: string) => <Tag color={getPaymentStatusColor(value)}>{normalizePaymentStatus(value)}</Tag>,
    },
  ];

  return (
    <div className="detail-stack">
      <div>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          业务总览
        </Typography.Title>
        <Typography.Text type="secondary">
          先把业务链路看清楚：项目先建台账，合同承接执行，付款负责落地跟踪。
        </Typography.Text>
      </div>

      <div className="page-panel dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="dashboard-hero-kicker">业务流程</span>
          <Typography.Title level={2} className="dashboard-hero-title">
            这套系统不是三个并列表，
            <br />
            而是一条从项目到付款的执行链路。
          </Typography.Title>
          <Typography.Paragraph className="dashboard-hero-desc">
            项目负责立项和阶段管理，合同负责承接执行，付款负责结果跟踪。首页优先展示当前卡点，而不是只堆统计数字。
          </Typography.Paragraph>
          <div className="dashboard-highlight-grid">
            <div className="dashboard-highlight-card">
              <span>未落合同项目</span>
              <strong>{workflow?.project_stage.unlinked_count ?? 0}</strong>
              <em>说明项目已建账，但还没进入合同执行</em>
            </div>
            <div className="dashboard-highlight-card">
              <span>未设付款计划合同</span>
              <strong>{workflow?.contract_stage.without_payment_count ?? 0}</strong>
              <em>合同已建立，但还没拆解成付款动作</em>
            </div>
            <div className="dashboard-highlight-card">
              <span>逾期 / 临期待付</span>
              <strong>{(workflow?.payment_stage.overdue_count ?? 0) + (workflow?.payment_stage.due_soon_count ?? 0)}</strong>
              <em>说明执行已经到付款阶段，需要跟催</em>
            </div>
          </div>
        </div>

        <div className="dashboard-hero-side">
          <div className="dashboard-progress-card">
            <strong>付款执行率</strong>
            <Progress percent={paymentExecutionRate} strokeColor="#22c55e" trailColor="rgba(148, 163, 184, 0.25)" />
            <div className="dashboard-progress-meta">
              <span>已付：{formatMoney(summary?.total_paid_amount ?? 0)}</span>
              <span>合同额：{formatMoney(summary?.total_contract_amount ?? 0)}</span>
            </div>
          </div>
          <div className="dashboard-progress-card">
            <strong>待付压力</strong>
            <Progress percent={pendingShare} strokeColor="#f59e0b" trailColor="rgba(148, 163, 184, 0.25)" />
            <div className="dashboard-progress-meta">
              <span>待付：{formatMoney(summary?.total_pending_amount ?? 0)}</span>
              <span>近30天提醒：{pendingPayments.length} 笔</span>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-flow-grid">
        {flowCards.map((item) => (
          <Card key={item.step} className="page-panel dashboard-flow-card">
            {loading ? (
              <Skeleton active paragraph={{ rows: 5 }} />
            ) : (
              <>
                <div className="dashboard-flow-step">{item.step}</div>
                <div className="dashboard-flow-title">{item.title}</div>
                <div className="dashboard-flow-desc">{item.description}</div>
                <div className="dashboard-flow-metrics">
                  {item.metrics.map((metric) => (
                    <div key={metric.label} className="dashboard-flow-metric">
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                    </div>
                  ))}
                </div>
                <Link to={item.href} className="dashboard-flow-link">
                  {item.action}
                </Link>
              </>
            )}
          </Card>
        ))}
      </div>

      <Card className="page-panel" title="系统规则">
        <div className="dashboard-rule-grid">
          <div className="dashboard-rule-card">
            <strong>项目是上游主台账</strong>
            <span>先确定预算、负责人和阶段。已有合同的项目不能直接删除。</span>
          </div>
          <div className="dashboard-rule-card">
            <strong>合同是执行主体</strong>
            <span>合同必须挂项目，标的清单、变更记录和付款计划都在合同详情里维护。</span>
          </div>
          <div className="dashboard-rule-card">
            <strong>付款是结果跟踪</strong>
            <span>付款不能脱离合同存在，待付款自动按计划金额减实付金额计算。</span>
          </div>
        </div>
      </Card>

      <div className="dashboard-metrics-grid">
        <Card className="page-panel dashboard-metric-card">
          <Statistic title="项目数" value={summary?.project_count ?? 0} loading={loading} />
        </Card>
        <Card className="page-panel dashboard-metric-card">
          <Statistic title="合同数" value={summary?.contract_count ?? 0} loading={loading} />
        </Card>
        <Card className="page-panel dashboard-metric-card">
          <Statistic title="付款笔数" value={summary?.payment_count ?? 0} loading={loading} />
        </Card>
        <Card className="page-panel dashboard-metric-card">
          <Statistic title="项目总预算" value={summary?.total_budget ?? 0} prefix="¥" precision={2} loading={loading} />
        </Card>
        <Card className="page-panel dashboard-metric-card">
          <Statistic
            title="合同总额"
            value={summary?.total_contract_amount ?? 0}
            prefix="¥"
            precision={2}
            loading={loading}
          />
        </Card>
        <Card className="page-panel dashboard-metric-card">
          <Statistic
            title="已付总额"
            value={summary?.total_paid_amount ?? 0}
            prefix="¥"
            precision={2}
            loading={loading}
          />
        </Card>
      </div>

      <div className="dashboard-secondary-grid">
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

        <Card className="page-panel" title="当前最值得先处理的事">
          {overdueCount > 0 && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 14 }}
              message={`当前有 ${overdueCount} 笔付款已逾期，建议优先处理。`}
            />
          )}
          <div className="dashboard-priority-list">
            {focusPayments.length ? (
              focusPayments.map((item) => {
                const dueMeta = getDueMeta(item.diffDays);
                return (
                  <div key={item.id} className="dashboard-priority-item">
                    <div className="dashboard-priority-copy">
                      <div className="dashboard-priority-title">{item.project_name}</div>
                      <div className="dashboard-priority-meta">{item.contract_name || '未关联合同'}</div>
                      <div className="dashboard-priority-meta">计划日期：{item.planned_date || '-'}</div>
                    </div>
                    <div className="dashboard-priority-side">
                      <Tag color={dueMeta.color}>{dueMeta.label}</Tag>
                      <span className="dashboard-priority-amount">{formatMoney(item.amount)}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="dashboard-empty">近 30 天内没有需要重点盯办的付款。</div>
            )}
          </div>
        </Card>
      </div>

      <Card className="page-panel" title="待付款提醒">
        {urgentIds.size > 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={`当前主项目阶段是 ${topStatus.status}，红色日期表示 7 天内临近到期，请优先处理。`}
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
