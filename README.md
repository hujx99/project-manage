# 项目合同付款管理系统

基于 `FastAPI + React + TypeScript + Ant Design + SQLite` 的本地项目管理系统，用于替代多维表格，统一管理项目、合同、付款计划、合同标的和变更记录，并支持 Excel 导入导出、AI 截图识别导入。

## 功能列表

- 项目管理：项目列表、搜索、状态筛选、新建、编辑、删除保护
- 合同管理：合同主信息维护，标的清单、付款计划、变更记录子表管理
- 付款管理：全局付款列表、联动选择项目和合同、自动计算待付款
- 仪表盘：项目数、合同数、总合同额、总待付款、项目状态分布、30 天待付款提醒
- AI 截图识别导入：上传 OA 截图，调用 Claude Vision 识别并确认导入
- Excel 导入导出：模板下载、批量导入、批量导出
- 数据校验提醒：
  - 合同金额与标的合计不一致时给出警告
  - 付款总额超过合同金额时给出警告
- 统一错误处理：请求校验错误、数据库错误、业务错误统一返回中文提示

## 截图示意

当前仓库内提供了占位示意图，可在后续替换为真实页面截图：

![系统页面示意](docs/screenshots/dashboard-placeholder.svg)

## 快速启动

### 方式一：Docker Compose

前端使用 Nginx 托管静态文件，并反向代理 `/api` 到后端 Uvicorn。

```bash
docker compose up --build
```

启动后访问：

- 前端：<http://localhost>
- 后端健康检查：<http://localhost:8000/>
- Swagger 文档：<http://localhost:8000/docs>
- ReDoc 文档：<http://localhost:8000/redoc>

### 方式二：本地开发

#### 1. 启动后端

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

如果你使用 macOS / Linux：

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 2. 启动前端

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

访问：

- 前端：<http://localhost:5173>
- 后端：<http://localhost:8000>

## AI 截图识别配置

先复制 `.env.example` 为 `.env`，再按需配置：

```env
ANTHROPIC_API_KEY=你的_Anthropic_API_Key
SQLITE_DB_PATH=.local/project-manage.db
```

如果未配置，AI 截图识别接口会直接返回中文错误提示。

其中：

- `ANTHROPIC_API_KEY`：AI 截图识别使用
- `SQLITE_DB_PATH`：本地 SQLite 文件位置

默认建议把 SQLite 放在 `.local/` 这类被 Git 忽略的目录，不要把真实业务数据放进版本库。

## API 文档地址

- Swagger UI：<http://localhost:8000/docs>
- ReDoc：<http://localhost:8000/redoc>

## 补充文档

- [运行方式、沙箱与局域网访问说明](docs/runtime-and-lan.md)
- [前后端接口文档](docs/frontend-backend-api.md)
- [Git 安全清理与仓库瘦身记录](docs/git-security-cleanup-summary.md)
- [测试报告（2026-03-29）](docs/test-report-2026-03-29.md)

## 项目结构说明

这个项目不是一组彼此独立的页面，而是一条完整业务链：

1. `项目立项`
   先建立项目台账，维护项目编号、名称、预算、负责人、阶段。
2. `合同执行`
   合同必须挂在项目下面，负责维护合同金额、供应商、标的清单、付款计划、变更记录。
3. `付款跟踪`
   付款记录挂在合同下面，用来统一跟踪计划金额、实际金额、待付款和当前状态。
4. `业务总览`
   从项目、合同、付款三个阶段汇总数据，做执行分析和风险提示。
5. `数据导入 / 导出`
   负责把 Excel、截图识别结果导入系统，或把现有业务数据导出。

从数据关系上看：

- 一个 `Project` 可以有多个 `Contract`
- 一个 `Contract` 可以有多个 `ContractItem`
- 一个 `Contract` 可以有多个 `Payment`
- 一个 `Contract` 可以有多个 `ContractChange`

## 代码结构

### 后端

- `backend/app/main.py`
  FastAPI 应用入口，负责路由注册、异常处理、CORS 等启动配置。
- `backend/app/database.py`
  数据库连接、`Session` 和 `Base` 定义；SQLite 路径通过 `.env` 中的 `SQLITE_DB_PATH` 配置。
- `backend/app/models.py`
  SQLAlchemy ORM 模型，定义项目、合同、付款、标的、变更之间的表结构和关联关系。
- `backend/app/schemas.py`
  Pydantic 请求/响应模型，用来约束接口入参和返回格式。
- `backend/app/routers/`
  按业务域拆分接口：
  - `projects.py`：项目列表、详情、增删改、删除保护
  - `contracts.py`：合同主表及标的、变更、付款子表管理
  - `payments.py`：全局付款记录增删改查和待付款重算
  - `dashboard.py`：仪表盘统计、漏斗、风险分析
  - `imports.py`：Excel 模板、Excel 导入、截图识别导入
  - `exports.py`：项目 / 合同 / 付款导出
- `backend/app/services/ai_parser.py`
  调用 AI 服务解析截图，把识别结果整理成合同、标的、付款计划、变更记录。
- `backend/tests/`
  后端 `pytest` 用例，当前主要覆盖接口级烟测和核心业务链路。

### 前端

- `frontend/src/main.tsx`
  前端应用入口，挂载 React 应用和 Ant Design 上下文。
- `frontend/src/App.tsx`
  路由入口，定义 `/`、`/projects`、`/contracts`、`/payments`、`/imports` 等页面。
- `frontend/src/layouts/MainLayout.tsx`
  系统壳层，负责侧边栏、页头、移动端抽屉导航。
- `frontend/src/pages/`
  页面层，按业务模块拆分：
  - `Dashboard.tsx`：分析型仪表盘
  - `ProjectsPage.tsx`：项目列表和立项台账
  - `ProjectDetailPage.tsx`：单项目下的合同和付款汇总
  - `ContractsPage.tsx`：合同列表
  - `ContractDetailPage.tsx`：合同详情、标的、付款计划、变更记录
  - `PaymentsPage.tsx`：全局付款待办池
  - `ImportsPage.tsx`：Excel / 截图导入
- `frontend/src/services/`
  按业务模块封装接口请求，页面不直接拼 URL。
- `frontend/src/api/client.ts`
  Axios 客户端和接口基址判断逻辑，兼容本机和局域网访问。
- `frontend/src/types/`
  前端共享类型定义，对齐后端返回结构。
- `frontend/src/constants/business.ts`
  项目、合同、付款的状态口径和颜色映射。
- `frontend/src/styles.css`
  全局样式和各页面公共布局样式。
- `frontend/tests/`
  Playwright 前端自动化测试，覆盖烟测和创建流程。

### 工程与文档

- `.github/workflows/ci.yml`
  CI 自动执行后端测试、前端构建和前端自动化烟测。
- `docs/`
  运行方式、接口、测试、安全清理等补充文档。
- `docker-compose.yml`
  一键拉起前后端容器。
- `.env.example`
  本地环境变量模板，不提交真实密钥和真实数据库路径。

## 目录结构（核心）

```text
backend/
  app/
    main.py
    database.py
    models.py
    schemas.py
    routers/
    services/
  tests/
  Dockerfile
frontend/
  src/
    api/
    constants/
    hooks/
    layouts/
    pages/
    services/
    types/
  tests/
  Dockerfile
  nginx.conf
  package.json
docs/
.github/
  workflows/
    ci.yml
docker-compose.yml
requirements.txt
.env.example
```

## 部署文件说明

- [docker-compose.yml](docker-compose.yml)：一键启动前后端
- [backend/Dockerfile](backend/Dockerfile)：后端镜像，运行 Uvicorn
- [frontend/Dockerfile](frontend/Dockerfile)：前端镜像，Vite 构建后交给 Nginx
- [frontend/nginx.conf](frontend/nginx.conf)：前端静态资源服务和 `/api` 反向代理

## 常用页面与接口

页面：

- `/` 仪表盘
- `/projects` 项目管理
- `/contracts` 合同管理
- `/payments` 付款管理
- `/imports` 数据导入

接口：

- `GET /api/projects`
- `GET /api/contracts`
- `GET /api/payments`
- `GET /api/dashboard/summary`
- `GET /api/dashboard/pending-payments`
- `POST /api/import/screenshot`
- `POST /api/import/screenshot/confirm`
- `GET /api/import/template/{entity}`
- `POST /api/import/excel/{entity}`
- `GET /api/export/{entity}?format=xlsx`
