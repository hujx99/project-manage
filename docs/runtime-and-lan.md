# 运行方式、沙箱与局域网访问说明

本文回答三个问题：

1. 前端和后端分别怎么启动
2. 沙箱执行和系统级执行到底是什么关系
3. 如何把本地服务开放到局域网，让手机也能访问

## 1. 前端和后端分别怎么启动

### 1.1 后端启动

后端是 `FastAPI + Uvicorn + SQLite`，入口是：

- `backend.app.main:app`

依赖来自根目录 [requirements.txt](/Users/dovea/Desktop/Github/project-manage/requirements.txt)。

常见启动方式：

```bash
python -m venv .venv312
source .venv312/bin/activate
pip install -r requirements.txt
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

如果是开发态，希望代码改动后自动重载，可以改成：

```bash
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

如果希望同一局域网下的手机访问，就必须监听到网卡地址：

```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

### 1.2 前端启动

前端是 `React + TypeScript + Vite`，脚本定义在 [frontend/package.json](/Users/dovea/Desktop/Github/project-manage/frontend/package.json)：

- `npm run dev`: Vite 开发服务器
- `npm run build`: 先做 TypeScript 构建，再输出生产包
- `npm run preview`: 用 Vite 预览 `dist/`

开发态：

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

预览生产包：

```bash
cd frontend
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

如果要给手机看，把前端也监听到 `0.0.0.0`：

```bash
cd frontend
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

### 1.3 开发服务器和预览服务器的区别

- `npm run dev`:
  - 优点：热更新快，改代码立即生效
  - 典型端口：`5173`
- `npm run preview`:
  - 优点：看的就是构建产物，更接近最终部署效果
  - 典型端口：`4173`
  - 缺点：改完代码后要重新 `npm run build`

本次实际联调时，用的是：

- 后端：`python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000`
- 前端：`npm run preview -- --host 0.0.0.0 --port 4173`

原因很简单：你要的是“手机也能看”，所以必须监听到局域网地址，而不是只监听本机回环地址。

## 2. 沙箱执行和系统级执行是什么关系

### 2.1 不是两套代码，而是两层权限

沙箱和系统级用的是同一份仓库、同一份文件。

- 沙箱执行：
  - 可以读写当前 workspace
  - 适合读代码、改代码、跑构建、跑普通命令
  - 但会限制某些系统能力
- 系统级执行：
  - 仍然是同一目录下执行
  - 只是脱离沙箱限制
  - 适合做“需要操作本机系统资源”的动作

所以两者的关系不是“开发环境 vs 生产环境”，而是“同一项目代码，在不同权限层运行”。

### 2.2 这次项目里，哪些事必须系统级执行

在这台机器上，下面这些动作需要系统级权限：

1. 让服务监听 `0.0.0.0`
2. 打开浏览器
3. 结束已经在系统级启动的旧服务
4. 某些受限网络访问或本机端口探活

本次真实遇到过的限制就是：

- 后端在沙箱里监听 `0.0.0.0:8000` 被拒绝
- 前端在沙箱里监听 `0.0.0.0:4173` 也被拒绝

本质上不是代码有问题，而是沙箱不允许它把端口开放到系统网络接口上。

### 2.3 文件改了，为什么还要重启系统级服务

因为“代码修改”和“服务进程”是两件事：

- 你在沙箱里改了文件
- 系统级服务进程仍在跑旧代码

什么时候会自动生效，取决于启动方式：

- 后端如果用了 `--reload`，会自动重载
- 前端如果是 `npm run dev`，会热更新
- 前端如果是 `npm run preview`，不会自动更新，必须重新 `build + preview`
- 后端如果没有 `--reload`，也必须手工重启

这也是为什么这次我每次改完预览相关代码后，都要重新 build 和重启局域网服务。

## 3. 如何把本地服务同步到局域网，让手机也能访问

这里的“同步到局域网”本质上不是上传，也不是部署到远端，而是：

- 让前后端进程监听在本机网卡上
- 让手机通过电脑的局域网 IP 访问

### 3.1 具体实现方式

#### 第一步：后端监听到局域网

后端改为：

```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

这样后端不只接受 `127.0.0.1`，也接受本机局域网 IP，例如 `192.168.31.202:8000`。

#### 第二步：前端监听到局域网

前端改为：

```bash
npm run preview -- --host 0.0.0.0 --port 4173
```

这样手机可以直接打开：

```text
http://192.168.31.202:4173/
```

#### 第三步：前端必须知道后端该请求谁

关键逻辑在 [frontend/src/api/client.ts](/Users/dovea/Desktop/Github/project-manage/frontend/src/api/client.ts)。

当前规则是：

1. 如果页面运行在 `localhost` 或 `127.0.0.1`
2. 或者页面端口是本地开发/预览端口 `5173` / `4173`

则前端直接把 API 指到：

```ts
${window.location.protocol}//${window.location.hostname}:8000/api
```

这条规则非常关键，因为手机访问时：

- `window.location.hostname` 会变成电脑的局域网 IP
- 所以前端会自动请求 `http://电脑局域网IP:8000/api`

也就是说，手机打开的是：

- 前端：`http://192.168.31.202:4173`

前端自动去请求：

- 后端：`http://192.168.31.202:8000/api`

#### 第四步：后端必须允许这个来源跨域

关键逻辑在 [backend/app/main.py](/Users/dovea/Desktop/Github/project-manage/backend/app/main.py)。

当前后端同时做了两层放行：

1. 显式白名单：
   - `localhost`
   - `127.0.0.1`
   - 常用本地端口 `4173` / `5173`
2. `allow_origin_regex`
   - 允许 `http://192.168.x.x:端口`
   - 也允许其他 IPv4 局域网地址格式

没有这层的话，手机虽然能打开前端页面，但浏览器会拦掉前端到后端的请求。

### 3.2 局域网访问的操作步骤

1. 电脑和手机连同一个 Wi-Fi
2. 查电脑当前局域网地址

macOS 常见命令：

```bash
ifconfig
```

再看正在联网的网卡，例如 `en0` 的 `inet 192.168.x.x`

3. 启动后端：

```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

4. 启动前端：

```bash
cd frontend
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

5. 手机浏览器打开：

```text
http://<电脑局域网IP>:4173/
```

## 4. 技术问题和常见坑

### 4.1 误把 `127.0.0.1` 当成“手机也能访问”的地址

这是最常见的坑。

- 在电脑浏览器里，`127.0.0.1` 指的是电脑自己
- 在手机浏览器里，`127.0.0.1` 指的是手机自己

所以手机打不开电脑本地服务是正常的。

### 4.2 前端如果退回到 `/api`，预览页会拿到 HTML，不是 JSON

如果前端把接口写成 `/api`，但当前又没有 Nginx 反向代理，那么：

- `GET /api/...` 可能会被前端静态服务器接住
- 返回一整页 HTML
- 页面会出现白屏、报错或“接口地址配置错误”

这也是本项目之前本地预览白屏的直接原因之一。

### 4.3 CORS 没放开时，手机端表面能开页面，实际接口全失败

表现通常是：

- 页面壳子能显示
- 列表、图表、统计数字全空
- 控制台出现跨域错误

所以“前端能访问”不代表“业务可用”，一定要同时看后端 CORS。

### 4.4 沙箱里能 build，不代表能开放局域网端口

这次就是典型情况：

- `npm run build` 可以在沙箱里跑
- `py_compile` 这类静态检查也能在沙箱里跑
- 但监听 `0.0.0.0` 不行

所以：

- 代码修改、构建验证：优先沙箱
- 局域网启动、浏览器打开、端口探活：要用系统级

### 4.5 `preview` 不是热更新

如果你用的是：

```bash
npm run preview
```

那么每次改前端代码都要：

1. `npm run build`
2. 重启 `preview`

否则手机上看到的还是旧包。

### 4.6 本机防火墙和端口占用

如果浏览器地址没问题但手机还是打不开，要排查：

1. macOS 防火墙是否拦截了 Python / Node 的入站连接
2. `8000` / `4173` 是否已被旧进程占用
3. 手机和电脑是不是同一个 Wi-Fi，而不是一个连主网、一个连访客网

## 5. 推荐使用方式

如果你的目标是“边改边看手机效果”，推荐：

- 后端：`uvicorn --reload --host 0.0.0.0 --port 8000`
- 前端：`npm run dev -- --host 0.0.0.0 --port 5173`

如果你的目标是“给别人看一个接近发布结果的版本”，推荐：

- 后端：`uvicorn --host 0.0.0.0 --port 8000`
- 前端：`npm run build && npm run preview -- --host 0.0.0.0 --port 4173`
