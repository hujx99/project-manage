# 项目合同付款管理系统

基于 `FastAPI + React + TypeScript + Ant Design` 的项目、合同、付款管理系统，支持仪表盘、Excel 导入导出、AI 截图识别导入和合同子表维护。

## 功能列表

- 项目管理：列表、搜索、状态筛选、新建、编辑、删除保护
- 合同管理：合同主表、标的清单、付款计划、变更记录
- 付款管理：全局付款列表、待付款计算、按合同筛选
- 仪表盘：项目数、合同数、付款提醒、状态分布
- Excel 导入导出：项目、合同、付款模板和批量导入导出
- AI 截图识别：调用 Claude Vision 识别截图并导入业务数据
- 列表显示设置：控制显示列、默认排序和隐藏状态

## 技术栈

- 后端：FastAPI、SQLAlchemy、Pydantic
- 前端：Vite、React、TypeScript、Ant Design
- 默认部署数据库：PostgreSQL
- 本地单机回退数据库：SQLite

## 为什么默认改成 PostgreSQL

如果要让同事一起使用系统，SQLite 不适合作为正式共享数据库：

- SQLite 更适合单机、单用户、轻并发
- PostgreSQL 更适合多人同时录入、编辑、导入
- PostgreSQL 更适合长期部署、备份恢复和后续扩展

现在项目已经支持：

- Docker 和团队部署默认使用 PostgreSQL
- 本地个人临时运行仍可回退到 SQLite

## 快速启动

### 方式一：Docker Compose

默认会启动 3 个服务：

- `postgres`
- `backend`
- `frontend`

先复制环境变量模板：

```bash
cp .env.example .env
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env
```

然后启动：

```bash
docker compose up --build -d
```

访问地址：

- 前端：<http://localhost>
- 后端健康检查：<http://localhost:8000/>
- Swagger：<http://localhost:8000/docs>
- ReDoc：<http://localhost:8000/redoc>

### 方式二：本地开发

#### 1. 启动 PostgreSQL

你可以自己本机安装 PostgreSQL，也可以只跑数据库容器：

```bash
docker compose up -d postgres
```

#### 2. 配置环境变量

在项目根目录创建 `.env`：

```env
DATABASE_URL=postgresql+psycopg2://project_manage:project_manage@localhost:5432/project_manage
ANTHROPIC_API_KEY=
```

#### 3. 启动后端

Windows PowerShell：

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

macOS / Linux：

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 4. 启动前端

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

访问地址：

- 前端：<http://localhost:5173>
- 后端：<http://localhost:8000>

## 环境变量说明

项目根目录建议使用 `.env`：

```env
ANTHROPIC_API_KEY=

POSTGRES_DB=project_manage
POSTGRES_USER=project_manage
POSTGRES_PASSWORD=project_manage
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
DATABASE_URL=postgresql+psycopg2://project_manage:project_manage@localhost:5432/project_manage

SQLITE_DB_PATH=.local/project-manage.db
```

说明：

- `DATABASE_URL`：后端优先使用的数据库连接串
- `POSTGRES_*`：如果不直接写 `DATABASE_URL`，也可以用这些变量拼接 PostgreSQL 连接
- `SQLITE_DB_PATH`：只有在未配置 PostgreSQL 时，才会回退使用
- `ANTHROPIC_API_KEY`：AI 截图识别所需

## 从 SQLite 迁移到 PostgreSQL

如果你当前已经在 SQLite 里录入了数据，可以直接迁移。

### 1. 启动 PostgreSQL

```bash
docker compose up -d postgres
```

### 2. 配置目标库连接

```env
DATABASE_URL=postgresql+psycopg2://project_manage:project_manage@localhost:5432/project_manage
```

### 3. 执行迁移脚本

默认会读取：

- `.local/project-manage.db`
- 如果不存在，再回退 `backend/data.db`

执行：

```bash
python scripts/migrate_sqlite_to_postgres.py
```

如果目标库里已经有数据，想覆盖导入：

```bash
python scripts/migrate_sqlite_to_postgres.py --overwrite
```

如果你的 SQLite 文件不在默认位置：

```bash
python scripts/migrate_sqlite_to_postgres.py --sqlite-path ./your.db
```

## 目录结构

```text
.
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── routers/
│   │   └── services/
│   └── Dockerfile
├── frontend/
│   ├── src/
│   ├── nginx.conf
│   └── Dockerfile
├── docs/
├── scripts/
├── docker-compose.yml
├── requirements.txt
└── .env.example
```

## 常用页面

- `/`：仪表盘
- `/projects`：项目管理
- `/contracts`：合同管理
- `/payments`：付款管理
- `/imports`：数据导入

## 常用接口

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

## 部署文件

- [docker-compose.yml](docker-compose.yml)：前端、后端、PostgreSQL 一键启动
- [backend/Dockerfile](backend/Dockerfile)：后端镜像
- [frontend/Dockerfile](frontend/Dockerfile)：前端镜像
- [frontend/nginx.conf](frontend/nginx.conf)：前端静态资源和 `/api` 反向代理

## 说明

- 当前没有引入 Alembic，数据库表结构仍由 SQLAlchemy 在启动时自动创建
- 如果你准备继续长期演进系统，下一步建议补上 Alembic 数据库迁移
