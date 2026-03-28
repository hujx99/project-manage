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

## 目录结构

```text
backend/
  app/
    main.py
    database.py
    models.py
    schemas.py
    routers/
    services/
  Dockerfile
  data.db
frontend/
  src/
    api/
    layouts/
    pages/
    services/
  Dockerfile
  nginx.conf
docker-compose.yml
requirements.txt
requirements-v2.md
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
