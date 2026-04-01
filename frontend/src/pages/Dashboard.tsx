import { Alert, Card, Progress, Skeleton, Tag, Typography, message } from 'antd';
import { Bar, Column, Pie } from '@ant-design/charts';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PROJECT_STATUS_COLORS, getPaymentStatusColor, normalizePaymentStatus } from '../constants/business';
import useIsMobile from '../hooks/useIsMobile';
import { fetchDashboardAnalysis, type DashboardAnalysis } from '../services/dashboard';

const REFRESH_INTERVAL = 60_000;

function formatMoney(value: number) {
  return `¥${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMoneyCompact(value: number) {
  const amount = Number(value || 0);
  const absAmount = Math.abs(amount);

  if (absAmount >= 100000000) {
    return `¥${(amount / 100000000).toFixed(2)}亿`;
  }

  if (absAmount >= 10000) {
    return `¥${(amount / 10000).toFixed(2)}万`;
  }

  return formatMoney(amount);
}

function formatPercent(value: number) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatRefreshTime(value: Date | null) {
  if (!value) {
    return '尚未刷新';
  }

  return value.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function shortenText(value: string, limit = 12) {
  if (!value) {
    return '未填写';
  }

  return value.length > limit ? `${value.slice(0, limit)}...` : value;
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
  if (diffDays <= 30) {
    return { label: '30天内', color: 'gold' };
  }
  return { label: '后续计划', color: 'blue' };
}

function getHealthTone(score: number) {
  if (score >= 75) {
    return { label: '整体稳健', color: '#16a34a' };
  }
  if (score >= 50) {
    return { label: '中等承压', color: '#d97706' };
  }
  return { label: '需要干预', color: '#dc2626' };
}

const Dashboard = () => {
  const isMobile = useIsMobile();
  const [analysis, setAnalysis] = useState<DashboardAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadData = async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const result = await fetchDashboardAnalysis();
        if (!mounted) {
          return;
        }

        setAnalysis(result);
        setLastUpdated(new Date());
      } catch (error) {
        if (mounted) {
          message.error((error as Error).message);
        }
      } finally {
        if (!mounted) {
          return;
        }

        setLoading(false);
        setRefreshing(false);
      }
    };

    void loadData();
    const timer = window.setInterval(() => {
      void loadData(true);
    }, REFRESH_INTERVAL);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const financialHealth = analysis?.financial_health;
  const coverage = analysis?.coverage;
  const funnel = analysis?.funnel;
  const paymentRisk = analysis?.payment_risk;

  const healthScore = useMemo(() => {
    if (!analysis) {
      return 0;
    }

    const score =
      analysis.coverage.project_contract_link_rate * 0.25 +
      analysis.coverage.contract_payment_plan_rate * 0.2 +
      Math.max(0, 100 - analysis.coverage.payment_overdue_rate) * 0.35 +
      analysis.financial_health.payment_execution_rate * 0.2;

    return Math.round(score);
  }, [analysis]);

  const topVendorShare = useMemo(() => {
    if (!analysis || !analysis.vendor_concentration.length || !analysis.financial_health.total_contract_amount) {
      return 0;
    }

    const topThree = analysis.vendor_concentration.slice(0, 3).reduce((sum, item) => sum + item.amount_total, 0);
    return Math.round((topThree / analysis.financial_health.total_contract_amount) * 100);
  }, [analysis]);

  const healthTone = getHealthTone(healthScore);
  const closedProjectCount = (funnel?.project_total ?? 0) - (funnel?.active_project_count ?? 0);

  const headlineCards = [
    {
      label: '执行健康度',
      value: `${healthScore}`,
      suffix: '分',
      accent: healthTone.color,
      description: `${healthTone.label}，综合考虑合同覆盖、付款计划、逾期率和付款执行率。`,
    },
    {
      label: '合同覆盖率',
      value: formatPercent(coverage?.project_contract_link_rate ?? 0),
      accent: '#2563eb',
      description: `${funnel?.projects_with_contracts ?? 0} / ${funnel?.project_total ?? 0} 个项目已经进入合同执行。`,
    },
    {
      label: '付款逾期率',
      value: formatPercent(coverage?.payment_overdue_rate ?? 0),
      accent: '#dc2626',
      description: `${paymentRisk?.overdue_count ?? 0} 笔已逾期，当前待付金额 ${formatMoney(paymentRisk?.overdue_amount ?? 0)}。`,
    },
    {
      label: '供应商集中度',
      value: `${topVendorShare}%`,
      accent: '#7c3aed',
      description: `合同金额前三供应商占总合同额 ${topVendorShare}% 。`,
    },
  ];

  const healthCards = [
    {
      title: '预算转合同',
      percent: financialHealth?.budget_usage_rate ?? 0,
      rateLabel: '转化率',
      strokeColor: '#2563eb',
      primary: formatMoneyCompact(financialHealth?.total_contract_amount ?? 0),
      secondary: `合同 ${formatMoney(financialHealth?.total_contract_amount ?? 0)} / 预算 ${formatMoney(financialHealth?.total_budget ?? 0)}`,
    },
    {
      title: '合同转已付',
      percent: financialHealth?.payment_execution_rate ?? 0,
      rateLabel: '转化率',
      strokeColor: '#16a34a',
      primary: formatMoneyCompact(financialHealth?.total_paid_amount ?? 0),
      secondary: `已付 ${formatMoney(financialHealth?.total_paid_amount ?? 0)} / 合同 ${formatMoney(financialHealth?.total_contract_amount ?? 0)}`,
    },
    {
      title: '待付压力',
      percent: financialHealth?.pending_pressure_rate ?? 0,
      rateLabel: '压力率',
      strokeColor: '#d97706',
      primary: formatMoneyCompact(financialHealth?.total_pending_amount ?? 0),
      secondary: `待付 ${formatMoney(financialHealth?.total_pending_amount ?? 0)} / 逾期 ${formatMoney(paymentRisk?.overdue_amount ?? 0)}`,
    },
    {
      title: '项目结项率',
      percent: coverage?.closed_project_rate ?? 0,
      rateLabel: '覆盖率',
      strokeColor: '#7c3aed',
      primary: `${closedProjectCount}`,
      secondary: `项目总数 ${funnel?.project_total ?? 0}`,
    },
  ];

  const funnelCards = [
    {
      title: '项目进入合同',
      value: coverage?.project_contract_link_rate ?? 0,
      countLabel: `${funnel?.projects_with_contracts ?? 0} / ${funnel?.project_total ?? 0}`,
      description: `${funnel?.projects_without_contracts ?? 0} 个项目已建账但还没落到合同。`,
      link: '/projects',
      linkLabel: '查看项目链路',
    },
    {
      title: '合同拆到付款',
      value: coverage?.contract_payment_plan_rate ?? 0,
      countLabel: `${funnel?.contracts_with_payment_plans ?? 0} / ${funnel?.contract_total ?? 0}`,
      description: `${funnel?.contracts_without_payment_plans ?? 0} 份合同还没有付款计划。`,
      link: '/contracts',
      linkLabel: '查看合同执行',
    },
    {
      title: '付款形成闭环',
      value: funnel?.payment_total ? Math.round(((funnel?.paid_payment_count ?? 0) / funnel.payment_total) * 1000) / 10 : 0,
      countLabel: `${funnel?.paid_payment_count ?? 0} / ${funnel?.payment_total ?? 0}`,
      description: `${funnel?.unpaid_payment_count ?? 0} 笔仍在待办池，${paymentRisk?.overdue_count ?? 0} 笔已转成逾期。`,
      link: '/payments',
      linkLabel: '查看付款跟踪',
    },
  ];

  const managerChartData = useMemo(
    () =>
      (analysis?.manager_load ?? []).map((item) => ({
        manager: shortenText(item.manager, 8),
        fullName: item.manager,
        budget_total: Number(item.budget_total ?? 0),
        pending_total: Number(item.pending_total ?? 0),
        active_project_count: item.active_project_count,
        unlinked_project_count: item.unlinked_project_count,
      })),
    [analysis?.manager_load],
  );

  const vendorChartData = useMemo(
    () =>
      (analysis?.vendor_concentration ?? []).map((item) => ({
        vendor: shortenText(item.vendor, 10),
        fullName: item.vendor,
        amount_total: item.amount_total,
        contract_count: item.contract_count,
        pending_total: item.pending_total,
      })),
    [analysis?.vendor_concentration],
  );

  return (
    <div className="detail-stack dashboard-stack">
      <div>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          业务总览
        </Typography.Title>
        <Typography.Text type="secondary">
          最近刷新：{formatRefreshTime(lastUpdated)}{refreshing ? '　正在同步...' : ''}
        </Typography.Text>
      </div>

      <div className="page-panel dashboard-command">
        <div className="dashboard-command-grid">
          {headlineCards.map((item) => (
            <div key={item.label} className="dashboard-command-card">
              {loading && !analysis ? (
                <Skeleton active paragraph={{ rows: 2 }} />
              ) : (
                <>
                  <span>{item.label}</span>
                  <strong style={{ color: item.accent }}>
                    {item.value}
                    {item.suffix ? <em>{item.suffix}</em> : null}
                  </strong>
                  <p>{item.description}</p>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {(paymentRisk?.overdue_count ?? 0) > 0 && (
        <Alert
          type="error"
          showIcon
          message={`当前有 ${paymentRisk?.overdue_count ?? 0} 笔付款已经逾期，逾期待付金额 ${formatMoney(paymentRisk?.overdue_amount ?? 0)}，请尽快处理。`}
        />
      )}

      <div className="dashboard-health-grid">
        {healthCards.map((item) => (
          <Card key={item.title} className="page-panel dashboard-health-card">
            {loading && !analysis ? (
              <Skeleton active paragraph={{ rows: 3 }} />
            ) : (
              <>
                <div className="dashboard-health-head">
                  <div>
                    <span className="dashboard-health-label">{item.title}</span>
                    <strong className="dashboard-health-value">{item.primary}</strong>
                    <div className="dashboard-health-subtitle">{item.secondary}</div>
                  </div>
                  <div className="dashboard-health-percent">
                    <small>{item.rateLabel}</small>
                    {formatPercent(item.percent)}
                  </div>
                </div>
                <Progress percent={item.percent} strokeColor={item.strokeColor} trailColor="rgba(148, 163, 184, 0.2)" showInfo={false} />
              </>
            )}
          </Card>
        ))}
      </div>

      <div className="dashboard-funnel-grid">
        {funnelCards.map((item) => (
          <Card key={item.title} className="page-panel dashboard-funnel-card">
            {loading && !analysis ? (
              <Skeleton active paragraph={{ rows: 3 }} />
            ) : (
              <>
                <div className="dashboard-funnel-head">
                  <strong>{item.title}</strong>
                  <span>{formatPercent(item.value)}</span>
                </div>
                <Progress percent={item.value} strokeColor="#2563eb" trailColor="rgba(148, 163, 184, 0.2)" showInfo={false} />
                <div className="dashboard-funnel-count">{item.countLabel}</div>
                <div className="dashboard-funnel-desc">{item.description}</div>
                <Link to={item.link} className="dashboard-flow-link">
                  {item.linkLabel}
                </Link>
              </>
            )}
          </Card>
        ))}
      </div>

      <div className="dashboard-chart-grid dashboard-chart-grid-primary">
        <Card className="page-panel" title="付款风险分层">
          {loading && !analysis ? (
            <Skeleton active paragraph={{ rows: 8 }} />
          ) : (
            <>
              <Column
                data={analysis?.payment_due_buckets ?? []}
                xField="label"
                yField="amount"
                color={({ key }: { key: string }) => {
                  if (key === 'overdue') {
                    return '#dc2626';
                  }
                  if (key === 'today' || key === 'within_7_days') {
                    return '#f59e0b';
                  }
                  if (key === 'within_30_days') {
                    return '#3b82f6';
                  }
                  return '#94a3b8';
                }}
                label={{
                  text: (data: { amount: number }) => (data.amount ? `${Math.round(data.amount / 10000)}万` : ''),
                  style: { fill: '#475569', fontSize: 12 },
                }}
                axis={{ y: { labelFormatter: (value: string) => `${Math.round(Number(value) / 10000)}万` } }}
                tooltip={{
                  items: [
                    (datum: { label: string; amount: number; count: number }) => ({
                      name: datum.label,
                      value: `${formatMoney(datum.amount)} / ${datum.count} 笔`,
                    }),
                  ],
                }}
                height={isMobile ? 260 : 320}
              />
            </>
          )}
        </Card>

        <Card className="page-panel" title="项目状态结构">
          {loading && !analysis ? (
            <Skeleton active paragraph={{ rows: 8 }} />
          ) : (
            <Pie
              data={analysis?.project_status_distribution ?? []}
              angleField="count"
              colorField="status"
              radius={0.82}
              innerRadius={0.48}
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

        <Card className="page-panel" title="合同状态结构">
          {loading && !analysis ? (
            <Skeleton active paragraph={{ rows: 8 }} />
          ) : (
            <Pie
              data={analysis?.contract_status_distribution ?? []}
              angleField="count"
              colorField="status"
              radius={0.82}
              innerRadius={0.48}
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
      </div>

      <div className="dashboard-chart-grid dashboard-chart-grid-secondary">
        <Card className="page-panel" title="责任人负载">
          {loading && !analysis ? (
            <Skeleton active paragraph={{ rows: 8 }} />
          ) : (
            <>
              <Bar
                data={managerChartData}
                xField="budget_total"
                yField="manager"
                legend={false}
                color="#2563eb"
                axis={{ x: { labelFormatter: (value: string) => `${Math.round(Number(value) / 10000)}万` } }}
                tooltip={{
                  items: [
                    (datum: { fullName: string; budget_total: number; pending_total: number; active_project_count: number; unlinked_project_count: number }) => ({
                      name: datum.fullName,
                      value: `预算 ${formatMoney(datum.budget_total)} / 待付 ${formatMoney(datum.pending_total)} / 活跃项目 ${datum.active_project_count}`,
                    }),
                  ],
                }}
                height={isMobile ? 280 : 340}
              />
            </>
          )}
        </Card>

        <Card className="page-panel" title="供应商集中度">
          {loading && !analysis ? (
            <Skeleton active paragraph={{ rows: 8 }} />
          ) : (
            <>
              <Bar
                data={vendorChartData}
                xField="amount_total"
                yField="vendor"
                legend={false}
                color="#7c3aed"
                axis={{ x: { labelFormatter: (value: string) => `${Math.round(Number(value) / 10000)}万` } }}
                tooltip={{
                  items: [
                    (datum: { fullName: string; amount_total: number; contract_count: number; pending_total: number }) => ({
                      name: datum.fullName,
                      value: `${formatMoney(datum.amount_total)} / ${datum.contract_count} 份合同 / 待付 ${formatMoney(datum.pending_total)}`,
                    }),
                  ],
                }}
                height={isMobile ? 280 : 340}
              />
            </>
          )}
        </Card>
      </div>

      <div className="dashboard-insight-grid">
        <Card className="page-panel" title="高风险项目清单">
          {loading && !analysis ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : (
            <div className="dashboard-insight-list">
              {(analysis?.top_risk_projects ?? []).length ? (
                analysis?.top_risk_projects.map((item) => (
                  <Link key={item.project_id} to={`/projects/${item.project_id}`} className="dashboard-insight-item">
                    <div className="dashboard-insight-copy">
                      <div className="dashboard-insight-title">{item.project_name}</div>
                      <div className="dashboard-insight-meta">
                        负责人：{item.manager} · 合同 {item.contract_count} 份 · 风险分 {item.risk_score}
                      </div>
                    </div>
                    <div className="dashboard-insight-side">
                      <Tag color={PROJECT_STATUS_COLORS[item.status] ?? 'default'}>{item.status}</Tag>
                      <span className="dashboard-insight-money">{formatMoney(item.pending_total)}</span>
                      <div className="dashboard-insight-mini">
                        逾期 {item.overdue_count} · 临期 {item.due_soon_count}
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="dashboard-empty">当前没有识别出明显的高风险项目。</div>
              )}
            </div>
          )}
        </Card>

        <Card className="page-panel" title="优先付款事项">
          {loading && !analysis ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : (
            <div className="dashboard-insight-list">
              {(analysis?.priority_payments ?? []).length ? (
                analysis?.priority_payments.map((item) => {
                  const dueMeta = getDueMeta(item.diff_days);
                  return (
                    <div key={item.id} className="dashboard-insight-item">
                      <div className="dashboard-insight-copy">
                        <div className="dashboard-insight-title">{item.project_name}</div>
                        <div className="dashboard-insight-meta">{item.contract_name || '未关联合同'}</div>
                        <div className="dashboard-insight-meta">
                          负责人：{item.manager} · 计划日期：{item.planned_date || '-'}
                        </div>
                      </div>
                      <div className="dashboard-insight-side">
                        <Tag color={dueMeta.color}>{dueMeta.label}</Tag>
                        <Tag color={getPaymentStatusColor(item.payment_status)}>{normalizePaymentStatus(item.payment_status)}</Tag>
                        <span className="dashboard-insight-money">{formatMoney(item.amount)}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="dashboard-empty">当前没有需要优先跟进的付款事项。</div>
              )}
            </div>
          )}
        </Card>
      </div>

    </div>
  );
};

export default Dashboard;
