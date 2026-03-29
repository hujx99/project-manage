# 测试报告（2026-03-29）

本文档记录 2026-03-29 这一轮针对“项目合同付款管理系统”的完整测试结果，覆盖后端接口功能、前端构建、前端页面烟测，以及新增的 Playwright 浏览器自动化测试。

## 1. 本轮测试目标

本轮测试的目标不是只确认“页面能打开”，而是确认以下几件事：

- 后端核心业务链可正常运行
- 前后端联调链路稳定
- 新仪表盘和关键页面在桌面端、移动端都可正常展示
- 常见控制台告警和明显布局问题被收敛
- 项目具备可重复执行的前端自动化烟测能力

## 2. 测试环境

### 2.1 运行环境

- Node.js: `v25.8.2`
- npm: `11.11.1`
- Python: `3.12.13`
- Playwright: `1.58.2`

### 2.2 本轮使用的本地服务

- 后端开发服务: `http://127.0.0.1:8000`
- 前端开发服务: `http://127.0.0.1:5173`
- 局域网前端访问: `http://192.168.31.202:5173`

### 2.3 数据策略

后端接口级功能测试没有直接污染当前真实业务库，而是：

1. 从本地 SQLite 数据库复制一份临时副本
2. 用临时副本启动 `FastAPI TestClient`
3. 在临时库上执行 CRUD、导入导出、仪表盘等全链路测试

这样做的好处是：

- 能覆盖真实业务逻辑
- 不会破坏当前正在看的本地数据
- 测试结束后临时库自动销毁

## 3. 覆盖范围

### 3.1 后端接口级功能测试

本轮后端烟测覆盖了以下能力：

- 健康检查
- 仪表盘接口
  - `/api/dashboard/summary`
  - `/api/dashboard/workflow`
  - `/api/dashboard/analysis`
  - `/api/dashboard/pending-payments`
- 项目模块
  - 列表分页
  - 新建
  - 更新
  - 删除
  - 有关联合同时的删除保护
- 合同模块
  - 新建
  - 查询详情
  - 删除保护
  - 标的清单增删改
  - 变更记录增删改
  - 合同金额与标的合计不一致告警
- 付款模块
  - 新建
  - 更新
  - 删除
  - `pending_amount` 自动重算
- 导出模块
  - 项目、合同、付款三类 xlsx 导出
- 导入模块
  - 项目、合同、付款三类模板下载
  - 项目、合同、付款三类 Excel 导入
  - 重复编号 `skip/update` 策略
- AI 导入确认链路
  - `/api/import/screenshot/confirm`
  - 合同、标的、付款计划、变更记录的确认入库

### 3.2 前端构建与页面测试

本轮前端侧覆盖了：

- `npm run build`
- 开发服务和热更新链路
- 主路由和详情路由烟测
- Playwright 浏览器自动化烟测

Playwright 用例覆盖页面如下：

- 首页仪表盘
- 合同列表页
- 项目详情页
- 合同详情页
- 数据导入页

并分别验证：

- 桌面端布局
- 移动端布局
- 关键 API 请求是否成功
- 是否出现前端报错、请求失败或控制台 error/warning

## 4. 执行方式

### 4.1 后端测试

本轮后端测试使用了一次性的 Python 脚本，核心方式是：

- `FastAPI TestClient`
- 临时 SQLite 副本
- 顺序执行项目、合同、付款、导入导出、仪表盘接口的烟测

### 4.2 前端测试

本轮前端使用了两种方式：

1. 构建验证

```bash
cd frontend
npm run build
```

2. Playwright 烟测

```bash
cd frontend
npm run test:e2e
```

新增的前端测试基建如下：

- [playwright.config.ts](/Users/dovea/Desktop/Github/project-manage/frontend/playwright.config.ts)
- [smoke.spec.ts](/Users/dovea/Desktop/Github/project-manage/frontend/tests/smoke.spec.ts)

### 4.3 Playwright 配置说明

当前 Playwright 配置使用两个项目：

- `desktop-chromium`
- `mobile-chromium`

其中移动端项目使用 `Pixel 5` 设备模拟。

用例里有两条 `skipped` 是故意设计的：

- 桌面专属断言不会在移动项目里执行
- 移动专属断言不会在桌面项目里执行

因此 `skipped` 是预期行为，不代表失败。

## 5. 测试结果

### 5.1 后端结果

后端接口级功能烟测结果：

- 总检查点：`62`
- 通过：`62`
- 失败：`0`

结论：

- 核心业务链“项目 -> 合同 -> 付款”接口可正常工作
- 导入导出链路可正常工作
- 仪表盘分析接口可正常返回数据
- 删除保护、金额告警、待付金额自动计算均符合预期

### 5.2 前端结果

前端 Playwright 自动化结果：

- 通过：`8`
- 跳过：`2`
- 失败：`0`

前端构建结果：

- `npm run build`：通过

### 5.3 前端烟测覆盖结果

桌面端通过项：

- 首页仪表盘可加载分析视图
- 合同列表页表格固定布局与截断样式生效
- 项目详情页可正常加载
- 合同详情页可正常加载
- 数据导入页可正常加载

移动端通过项：

- 首页仪表盘可正常加载
- 合同列表页移动端聚合信息可正常展示
- 项目详情页可正常加载
- 合同详情页可正常加载
- 数据导入页可正常加载

## 6. 本轮测试中发现并修复的问题

这轮测试不是只“跑结果”，而是借助自动化测试继续修掉了几类真实问题。

### 6.1 合同列表页长文本挤压

问题：

- 合同编号过长时会挤进合同名称列，导致阅读混乱

处理：

- 合同列表改为固定表格布局
- 合同编号、合同名称、关联项目列重新分配宽度
- 链接文本统一使用截断显示

涉及文件：

- [ContractsPage.tsx](/Users/dovea/Desktop/Github/project-manage/frontend/src/pages/ContractsPage.tsx)
- [styles.css](/Users/dovea/Desktop/Github/project-manage/frontend/src/styles.css)

### 6.2 详情页 `Descriptions` 布局 warning

问题：

- Playwright 抓到了 `Descriptions` 的列 `span` 与 `column` 配置不匹配
- 浏览器控制台存在 Ant Design warning

处理：

- 调整了项目详情页和合同详情页的 `Descriptions.Item span`

涉及文件：

- [ProjectDetailPage.tsx](/Users/dovea/Desktop/Github/project-manage/frontend/src/pages/ProjectDetailPage.tsx)
- [ContractDetailPage.tsx](/Users/dovea/Desktop/Github/project-manage/frontend/src/pages/ContractDetailPage.tsx)

### 6.3 `Modal` 使用了废弃属性

问题：

- Playwright 抓到 Ant Design 控制台 warning：
  - `destroyOnClose` 已废弃

处理：

- 统一替换为 `destroyOnHidden`

涉及文件：

- [ContractsPage.tsx](/Users/dovea/Desktop/Github/project-manage/frontend/src/pages/ContractsPage.tsx)
- [ProjectsPage.tsx](/Users/dovea/Desktop/Github/project-manage/frontend/src/pages/ProjectsPage.tsx)
- [PaymentsPage.tsx](/Users/dovea/Desktop/Github/project-manage/frontend/src/pages/PaymentsPage.tsx)

### 6.4 自动化测试基建补齐

问题：

- 仓库之前没有现成的前端浏览器自动化能力

处理：

- 安装 `@playwright/test`
- 下载 Chromium
- 新增 Playwright 配置和首批烟测用例

涉及文件：

- [package.json](/Users/dovea/Desktop/Github/project-manage/frontend/package.json)
- [playwright.config.ts](/Users/dovea/Desktop/Github/project-manage/frontend/playwright.config.ts)
- [smoke.spec.ts](/Users/dovea/Desktop/Github/project-manage/frontend/tests/smoke.spec.ts)

## 7. 本轮未覆盖内容

虽然这轮测试已经比之前完整很多，但仍有几个边界没有覆盖到：

### 7.1 AI 原始截图识别外部调用

未覆盖接口：

- `/api/import/screenshot`

原因：

- 该接口依赖外部 AI 服务和真实密钥
- 本轮只验证了“识别后确认入库”这一步

### 7.2 跨浏览器差异

当前 Playwright 仅使用 Chromium：

- 已覆盖桌面 Chromium
- 已覆盖移动 Chromium 模拟

未覆盖：

- Safari / WebKit
- Firefox

### 7.3 长时间性能与大数据量测试

本轮没有覆盖：

- 大批量导入性能
- 大量列表数据下的渲染性能
- 长时间运行稳定性
- 并发场景

### 7.4 生产包体优化

虽然构建通过，但仍保留一个非阻塞警告：

- 前端主包仍然偏大
- Vite 提示 chunk size 超过 500 kB

这不影响当前功能正确性，但属于后续性能优化项。

## 8. 当前结论

到本轮结束时，可以明确认为：

1. 后端核心功能链路是可用的
2. 前后端联调是稳定的
3. 新仪表盘和关键页面在桌面端、移动端都能正常加载
4. 合同页长文本挤压、详情页说明布局 warning、Modal 废弃属性 warning 已被清理
5. 项目现在已经具备一套可重复运行的前端自动化烟测基础

## 9. 复跑建议

如果后续继续开发，建议把以下命令作为常规回归检查：

### 9.1 前端

```bash
cd frontend
npm run build
npm run test:e2e
```

### 9.2 后端

建议把本轮临时 Python 烟测脚本整理为正式测试文件，纳入仓库，后续可直接通过：

```bash
python -m pytest
```

执行。

当前仓库里还没有正式的 pytest 测试目录，这是下一步最值得补的测试基础设施。

## 10. 后续建议

建议下一步继续做三件事中的至少一件：

1. 把本轮一次性后端烟测脚本沉淀成正式 pytest 用例
2. 扩展 Playwright，用前端自动化覆盖“新增项目 / 新增合同 / 新增付款”的完整交互链路
3. 增加 CI 中的自动构建和自动烟测，避免功能回归靠人工发现

## 11. 相关提交

本轮测试相关代码已经体现在最近提交中：

- `2038109` `feat(dashboard): add comprehensive dashboard analysis interface and fetch function`
- `d5d05f1` `Add smoke tests for dashboard, contracts, detail, and imports pages`
- `b865727` `fix: update modal behavior to use destroyOnHidden for better resource management`

如果后续需要回溯这轮测试为什么加了某些断言、为什么清理某些 warning，可以直接从这几个提交开始追。
