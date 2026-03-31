import {
  AppstoreOutlined,
  DashboardOutlined,
  DollarCircleOutlined,
  FileTextOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { Button, Drawer, Layout, Menu, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import useIsMobile from '../hooks/useIsMobile';

const { Header, Sider, Content } = Layout;

const TEXT = {
  dashboard: '\u4e1a\u52a1\u603b\u89c8',
  projects: '\u9879\u76ee\u7acb\u9879',
  contracts: '\u5408\u540c\u6267\u884c',
  payments: '\u4ed8\u6b3e\u8ddf\u8e2a',
  imports: '\u6279\u91cf\u5bfc\u5165',
  settings: '\u7cfb\u7edf\u8bbe\u7f6e',
  brandTitle: '\u9879\u76ee\u4e1a\u52a1\u53f0\u8d26',
  brandSubtitle: '\u6309\u6d41\u7a0b\u7ba1\u9879\u76ee\u3001\u5408\u540c\u548c\u4ed8\u6b3e',
  headerTitle: '\u9879\u76ee\u7acb\u9879 / \u5408\u540c\u6267\u884c / \u4ed8\u6b3e\u8ddf\u8e2a',
  headerSubtitle: '\u5148\u5efa\u9879\u76ee\u53f0\u8d26\uff0c\u518d\u843d\u5408\u540c\uff0c\u6700\u540e\u76ef\u4ed8\u6b3e\u6267\u884c',
};

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: <Link to="/">{TEXT.dashboard}</Link> },
  { key: '/projects', icon: <AppstoreOutlined />, label: <Link to="/projects">{TEXT.projects}</Link> },
  { key: '/contracts', icon: <FileTextOutlined />, label: <Link to="/contracts">{TEXT.contracts}</Link> },
  { key: '/payments', icon: <DollarCircleOutlined />, label: <Link to="/payments">{TEXT.payments}</Link> },
  { key: '/imports', icon: <UploadOutlined />, label: <Link to="/imports">{TEXT.imports}</Link> },
  { key: '/settings', icon: <SettingOutlined />, label: <Link to="/settings">{TEXT.settings}</Link> },
];

function getSelectedKey(pathname: string) {
  const matched = menuItems.find((item) => item.key !== '/' && pathname.startsWith(item.key));
  return matched?.key ?? '/';
}

const MainLayout = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [isMobile, location.pathname]);

  const selectedKey = getSelectedKey(location.pathname);
  const navMenu = (
    <Menu
      theme="dark"
      mode="inline"
      inlineCollapsed={!isMobile && collapsed}
      selectedKeys={[selectedKey]}
      items={menuItems}
      onClick={() => {
        if (isMobile) {
          setMobileNavOpen(false);
        }
      }}
    />
  );

  return (
    <Layout className="shell-layout">
      {!isMobile && (
        <Sider
          collapsible
          trigger={null}
          collapsed={collapsed}
          width={240}
          collapsedWidth={88}
          className={`shell-sider ${collapsed ? 'is-collapsed' : ''}`}
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

          {navMenu}
        </Sider>
      )}

      <Layout className="shell-main">
        <Header className="shell-header">
          <div className="shell-header-inner">
            <Button
              type="text"
              className="shell-header-trigger"
              icon={isMobile || collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => {
                if (isMobile) {
                  setMobileNavOpen(true);
                  return;
                }
                setCollapsed((value) => !value);
              }}
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

      {isMobile && (
        <Drawer
          placement="left"
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          width={280}
          className="shell-mobile-drawer"
          title={null}
          closable={false}
          styles={{ body: { padding: 0 } }}
        >
          <div className="shell-brand">
            <div className="shell-brand-badge">PM</div>
            <div className="shell-brand-copy">
              <Typography.Title level={4} className="shell-brand-title">
                {TEXT.brandTitle}
              </Typography.Title>
              <Typography.Text className="shell-brand-subtitle">{TEXT.brandSubtitle}</Typography.Text>
            </div>
          </div>
          <div className="shell-mobile-nav">{navMenu}</div>
        </Drawer>
      )}
    </Layout>
  );
};

export default MainLayout;
