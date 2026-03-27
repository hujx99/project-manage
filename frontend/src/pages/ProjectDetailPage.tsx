import { Card, Descriptions, Progress, Skeleton, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchContracts } from '../services/contracts';
import { fetchProject } from '../services/projects';
import type { Contract, Project } from '../types';

function compareText(a?: string | null, b?: string | null) {
  return (a ?? '').localeCompare(b ?? '', 'zh-CN');
}

function compareNumber(a?: number | null, b?: number | null) {
  return Number(a ?? 0) - Number(b ?? 0);
}

const ProjectDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [projectDetail, contractList] = await Promise.all([fetchProject(Number(id)), fetchContracts()]);
        setProject(projectDetail);
        setContracts(contractList.filter((item) => item.project_id === Number(id)));
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

  const columns: ColumnsType<Contract> = [
    {
      title: '合同编号',
      dataIndex: 'contract_code',
      width: 220,
      sorter: (a, b) => compareText(a.contract_code, b.contract_code),
      render: (_, record) => <Link to={`/contracts/${record.id}`}>{record.contract_code}</Link>,
    },
    {
      title: '合同名称',
      dataIndex: 'contract_name',
      sorter: (a, b) => compareText(a.contract_name, b.contract_name),
    },
    {
      title: '供应商',
      dataIndex: 'vendor',
      width: 220,
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
      <Card className="page-panel" title={`项目详情：${project.project_name}`}>
        <Descriptions column={3}>
          <Descriptions.Item label="项目编号">{project.project_code}</Descriptions.Item>
          <Descriptions.Item label="项目属性">{project.project_type || '-'}</Descriptions.Item>
          <Descriptions.Item label="项目状态">
            <Tag>{project.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="项目金额">
            {project.budget != null ? `¥${Number(project.budget).toLocaleString()}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="负责人">{project.manager || '-'}</Descriptions.Item>
          <Descriptions.Item label="立项时间">{project.start_date || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{project.created_at ? project.created_at.slice(0, 10) : '-'}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{project.updated_at ? project.updated_at.slice(0, 10) : '-'}</Descriptions.Item>
          <Descriptions.Item label="备注" span={3}>
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
          pagination={false}
          scroll={{ x: 1000 }}
          locale={{ emptyText: '暂无合同' }}
        />
      </Card>
    </div>
  );
};

export default ProjectDetailPage;
