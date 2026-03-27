import { Card, Descriptions, Spin, Statistic, Table, Tag, Typography, message, Row, Col } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Project, Contract } from '../types';
import { fetchProject } from '../services/projects';
import { fetchContracts } from '../services/contracts';

const ProjectDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const [proj, allContracts] = await Promise.all([
          fetchProject(Number(id)),
          fetchContracts(),
        ]);
        setProject(proj);
        setContracts(allContracts.filter((c) => c.project_id === Number(id)));
      } catch (e: unknown) {
        message.error((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  if (loading) return <Spin style={{ display: 'block', marginTop: 100 }} />;
  if (!project) return <Typography.Text>项目不存在</Typography.Text>;

  const totalContractAmount = contracts.reduce((sum, c) => sum + Number(c.amount), 0);
  const totalPaid = contracts.reduce(
    (sum, c) => sum + c.payments.reduce((s, p) => s + Number(p.actual_amount || 0), 0),
    0,
  );
  const totalPending = contracts.reduce(
    (sum, c) => sum + c.payments.reduce((s, p) => s + Number(p.pending_amount || 0), 0),
    0,
  );

  const contractColumns: ColumnsType<Contract> = [
    {
      title: '合同编号',
      dataIndex: 'contract_code',
      render: (_, record) => <Link to={`/contracts/${record.id}`}>{record.contract_code}</Link>,
    },
    { title: '合同名称', dataIndex: 'contract_name' },
    { title: '供应商', dataIndex: 'vendor' },
    {
      title: '金额',
      dataIndex: 'amount',
      render: (v: number) => `¥${Number(v).toLocaleString()}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: string) => <Tag>{v}</Tag>,
    },
  ];

  return (
    <>
      <Card title={`项目详情：${project.project_name}`} style={{ marginBottom: 16 }}>
        <Descriptions column={3}>
          <Descriptions.Item label="项目编号">{project.project_code}</Descriptions.Item>
          <Descriptions.Item label="项目属性">{project.project_type || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag>{project.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="预算金额">
            {project.budget != null ? `¥${Number(project.budget).toLocaleString()}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="负责人">{project.manager || '-'}</Descriptions.Item>
          <Descriptions.Item label="立项日期">{project.start_date || '-'}</Descriptions.Item>
        </Descriptions>
        {project.remark && (
          <Descriptions>
            <Descriptions.Item label="备注">{project.remark}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="合同总数" value={contracts.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="合同总金额" value={totalContractAmount} precision={2} prefix="¥" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已付总额" value={totalPaid} precision={2} prefix="¥" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="待付总额" value={totalPending} precision={2} prefix="¥" />
          </Card>
        </Col>
      </Row>

      <Card title="关联合同">
        <Table rowKey="id" dataSource={contracts} columns={contractColumns} pagination={false} />
      </Card>
    </>
  );
};

export default ProjectDetailPage;
