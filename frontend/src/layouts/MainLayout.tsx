import { Layout, Menu, Typography } from 'antd';
import {
  BarChartOutlined,
  DollarOutlined,
  FileTextOutlined,
  ProjectOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { Link, Outlet, useLocation } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <BarChartOutlined />, label: <Link to="/">仪表盘</Link> },
  { key: '/projects', icon: <ProjectOutlined />, label: <Link to="/projects">项目管理</Link> },
  { key: '/contracts', icon: <FileTextOutlined />, label: <Link to="/contracts">合同管理</Link> },
  { key: '/payments', icon: <DollarOutlined />, label: <Link to="/payments">付款管理</Link> },
  { key: '/imports', icon: <UploadOutlined />, label: <Link to="/imports">数据导入</Link> },
];

const MainLayout = () => {
  const location = useLocation();
  const selectedKey = menuItems.find((item) => location.pathname.startsWith(item.key) && item.key !== '/')
    ? menuItems.find((item) => location.pathname.startsWith(item.key) && item.key !== '/')?.key
    : '/';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider>
        <Typography.Title level={4} style={{ color: '#fff', margin: '16px', textAlign: 'center' }}>
          管理系统
        </Typography.Title>
        <Menu theme="dark" selectedKeys={[selectedKey || '/']} mode="inline" items={menuItems} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 16px' }}>
          <Typography.Text strong>项目-合同-付款管理平台</Typography.Text>
        </Header>
        <Content style={{ margin: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
