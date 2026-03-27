import {
  AppstoreOutlined,
  DashboardOutlined,
  DollarCircleOutlined,
  FileTextOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { Button, Layout, Menu, Typography } from 'antd';
import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

const TEXT = {
  dashboard: '\u4eea\u8868\u76d8',
  projects: '\u9879\u76ee\u7ba1\u7406',
  contracts: '\u5408\u540c\u7ba1\u7406',
  payments: '\u4ed8\u6b3e\u7ba1\u7406',
  imports: '\u6570\u636e\u5bfc\u5165',
  brandTitle: '\u9879\u76ee\u5408\u540c\u7ba1\u7406',
  brandSubtitle: '\u672c\u5730\u4e1a\u52a1\u53f0\u8d26',
  headerTitle: '\u9879\u76ee / \u5408\u540c / \u4ed8\u6b3e\u7ba1\u7406',
  headerSubtitle: '\u9762\u5411\u672c\u5730\u4e1a\u52a1\u5f55\u5165\u4e0e\u8ddf\u8e2a',
};

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: <Link to="/">{TEXT.dashboard}</Link> },
  { key: '/projects', icon: <AppstoreOutlined />, label: <Link to="/projects">{TEXT.projects}</Link> },
  { key: '/contracts', icon: <FileTextOutlined />, label: <Link to="/contracts">{TEXT.contracts}</Link> },
  { key: '/payments', icon: <DollarCircleOutlined />, label: <Link to="/payments">{TEXT.payments}</Link> },
  { key: '/imports', icon: <UploadOutlined />, label: <Link to="/imports">{TEXT.imports}</Link> },
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
        collapsedWidth={88}
        className="shell-sider"
      >
        <div className={`shell-brand ${collapsed ? 'is-collapsed' : ''}`}>
          <div className="shell-brand-badge">PM</div>
          {!collapsed && (
            <div className="shell-brand-copy">
              <Typography.Title level={4} className="shell-brand-title">
                {TEXT.brandTitle}
              </Typography.Title>
              <Typography.Text className="shell-brand-subtitle">{TEXT.brandSubtitle}</Typography.Text>
            </div>
          )}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[getSelectedKey(location.pathname)]}
          items={menuItems}
        />
      </Sider>

      <Layout>
        <Header className="shell-header">
          <div className="shell-header-inner">
            <Button
              type="text"
              className="shell-header-trigger"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((value) => !value)}
            />
            <div className="shell-header-copy">
              <Typography.Title level={4} className="shell-header-title">
                {TEXT.headerTitle}
              </Typography.Title>
              <Typography.Text type="secondary" className="shell-header-subtitle">
                {TEXT.headerSubtitle}
              </Typography.Text>
            </div>
          </div>
        </Header>
        <Content className="shell-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
