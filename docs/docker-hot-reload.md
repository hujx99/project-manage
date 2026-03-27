# Docker 热重载问题说明

## 问题现象

修改本地代码后，在浏览器中刷新页面，前端或后端的变更没有生效，依然显示旧版本的内容。

---

## 根本原因

### 镜像构建机制

Docker 的工作原理是将代码**打包进镜像（Image）**。执行 `docker compose up --build` 时，Docker 会：

1. 读取 `Dockerfile`
2. 将当前目录的文件**复制（COPY）进镜像层**
3. 基于镜像启动容器（Container）

这意味着镜像构建完成后，镜像内的文件就是**快照（Snapshot）**，与宿主机上的源码文件完全独立。后续对本地文件的任何修改，容器内都感知不到。

```
本地文件系统          Docker 镜像（静态快照）
──────────────        ──────────────────────
src/app.py  ──COPY──▶  /app/src/app.py  ← 容器读这里，不是本地
```

### 前端的额外问题

前端 `Dockerfile` 使用多阶段构建：

```dockerfile
# Stage 1: 编译
FROM node:20 AS builder
COPY frontend/ .
RUN npm run build          # 构建产物打包进镜像

# Stage 2: 运行
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html   # 静态文件已固化
```

Nginx 提供的是**编译后的静态产物**，`.tsx` 源文件根本不存在于运行中的容器里，因此 Vite 的热更新（HMR）在 Docker 环境中完全失效。

---

## 解决方案

### 方案一：Volume 挂载（后端推荐）

`docker-compose.yml` 中已为后端配置了 Volume 挂载：

```yaml
services:
  backend:
    volumes:
      - ./backend:/app/backend   # 宿主机目录 → 容器目录（实时同步）
```

Volume 挂载会将宿主机目录**直接映射**到容器内，绕过镜像快照机制。配合 uvicorn 的 `--reload` 参数，修改 Python 文件后容器会自动重启对应进程。

```
本地文件系统          容器（通过 Volume 实时映射）
──────────────        ──────────────────────────
backend/app/  ──────▶  /app/backend/app/   ← 同一份文件，实时同步
  main.py  (修改)  →   main.py (立即可见) → uvicorn --reload 触发重启
```

**使用方式：**
```powershell
# 仅启动后端（无需重新构建镜像）
docker compose up backend -d
```

### 方案二：本地 Vite 开发服务器（前端推荐）

前端不使用 Docker，直接在本机运行 Vite 开发服务器：

```powershell
cd frontend
npm run dev    # 启动在 http://localhost:5173
```

Vite 具备原生热模块替换（HMR）能力，保存文件后浏览器**毫秒级**更新，无需刷新页面。

`frontend/src/api/client.ts` 已针对开发模式配置代理：

```typescript
// 开发模式指向本地 Docker 后端，生产模式使用相对路径
baseURL: import.meta.env.DEV ? 'http://localhost:8000/api' : '/api'
```

---

## 推荐开发工作流

```
┌─────────────────────────────────────────────────────┐
│  Terminal 1（后端）                                   │
│  docker compose up backend -d                        │
│  → 监听 http://localhost:8000                         │
│  → Volume 挂载，Python 文件修改后 uvicorn 自动重载    │
├─────────────────────────────────────────────────────┤
│  Terminal 2（前端）                                   │
│  cd frontend && npm run dev                          │
│  → 监听 http://localhost:5173                         │
│  → Vite HMR，TSX/CSS 文件修改后浏览器毫秒级热更新    │
└─────────────────────────────────────────────────────┘
```

访问 `http://localhost:5173` 进行开发。

---

## 何时需要重新构建镜像

以下情况需要执行 `docker compose build backend`：

| 变更类型 | 是否需要重建 |
|---------|------------|
| 修改 Python 业务代码（`backend/app/`） | **不需要**（Volume 挂载自动同步） |
| 新增/删除 `requirements.txt` 中的依赖 | **需要** |
| 修改 `backend/Dockerfile` | **需要** |
| 修改 `docker-compose.yml` 中的环境变量 | **需要** `docker compose up -d --force-recreate` |

---

## 为什么本项目后端不能在本地直接运行

本项目依赖 `pydantic-core`，该库需要编译 Rust 扩展。Python 3.14 尚无预编译的二进制包（wheel），本地 `pip install` 时会尝试从源码编译，需要完整的 Rust 工具链，在未配置 Rust 环境的机器上会失败：

```
error: can't find Rust compiler
× Preparing metadata (pyproject.toml) did not run successfully.
```

Docker 镜像使用 `python:3.11-slim`，该版本有预编译的 wheel，因此构建成功。这是本项目**必须用 Docker 运行后端**的直接原因。
