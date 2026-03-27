import { Card, Empty, Space, Typography } from 'antd';

const ImportsPage = () => {
  return (
    <div className="detail-stack">
      <div>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          数据导入
        </Typography.Title>
        <Typography.Text type="secondary">
          当前版本先预留入口，后续再接入 Excel 导入和截图识别。
        </Typography.Text>
      </div>

      <Card className="page-panel">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            功能规划
          </Typography.Title>
          <Typography.Paragraph className="muted-text" style={{ marginBottom: 0 }}>
            后续这里会接入 Excel 导入、合同截图识别、导入结果校验与确认。
          </Typography.Paragraph>
          <Empty description="导入功能暂未开放" />
        </Space>
      </Card>
    </div>
  );
};

export default ImportsPage;
