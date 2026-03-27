import {
  AppstoreOutlined,
  DashboardOutlined,
  DollarCircleOutlined,
  FileTextOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { Button, Layout, Menu, Space, Typography } from 'antd';
import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: <Link to="/">仪表盘</Link> },
  { key: '/projects', icon: <AppstoreOutlined />, label: <Link to="/projects">项目管理</Link> },
  { key: '/contracts', icon: <FileTextOutlined />, label: <Link to="/contracts">合同管理</Link> },
  { key: '/payments', icon: <DollarCircleOutlined />, label: <Link to="/payments">付款管理</Link> },
  { key: '/imports', icon: <UploadOutlined />, label: <Link to="/imports">数据导入</Link> },
];

function getSelectedKey(pathname: string) {
  const matched = menuItems.find((item) => item.key !== '/' && pathname.startsWith(item.key));
  return matched?.key ?? '/';
}

const MainLayout = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Layout className="shell-layout">
      <Sider
        collapsible
        trigger={null}
        collapsed={collapsed}
        width={240}
        className="shell-sider"
      >
        <div className="shell-brand">
          <Typography.Title level={4} className="shell-brand-title">
            {collapsed ? '管' : '项目合同管理'}
          </Typography.Title>
          {!collapsed && <Typography.Text className="shell-brand-subtitle">本地业务台账</Typography.Text>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey(location.pathname)]}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header className="shell-header">
          <Space size="middle">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((value) => !value)}
            />
            <div>
              <Typography.Title level={4} className="shell-header-title">
                项目 / 合同 / 付款管理
              </Typography.Title>
              <Typography.Text type="secondary">面向本地业务录入与跟踪</Typography.Text>
            </div>
          </Space>
        </Header>
        <Content className="shell-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
