# Git 安全清理与仓库瘦身记录

本文档记录了 2026-03-28 到 2026-03-29 对当前仓库进行的一次完整安全清理，目标包括：

- 把已经上传到 GitHub 的敏感文件从历史中移除
- 清理不应该进入版本库的重复冗余内容和本地产物
- 补齐忽略规则，避免同类问题再次发生
- 保留本机运行能力，不误删本地真实数据和依赖

## 1. 发现的问题

### 1.1 敏感数据被 Git 跟踪

仓库里曾经把以下内容纳入 Git 跟踪：

- `.env`
- `backend/data.db`

这会直接带来两类风险：

- `.env` 中的 API Key 会随着 `git push` 被上传到 GitHub
- SQLite 数据库文件会把真实业务数据一起带进远端仓库

需要特别说明的是，SQLite 本身不会“主动上传数据到 GitHub”。真正的问题是：数据库文件和敏感配置文件被 Git 跟踪了。

### 1.2 大量本地产物和可再生成内容被提交

仓库里还存在以下不应该入库的内容：

- `.venv/`
- `.venv312/`
- `frontend/node_modules/`
- `frontend/dist/`
- `backend/app/__pycache__/`
- `backend/app/routers/__pycache__/`
- `backend/app/services/__pycache__/`
- `frontend/tsconfig.app.tsbuildinfo`
- `frontend/tsconfig.node.tsbuildinfo`

这些内容的问题不是“敏感”，而是“重复冗余”：

- 它们都可以通过命令重新生成
- 会让仓库体积膨胀
- 会污染 `git status`
- 会让 clone、pull、diff、code review 变慢
- 会制造大量无意义的冲突

### 1.3 仅删当前文件不够

如果敏感文件已经被 push 到 GitHub，仅仅执行：

```bash
git rm --cached .env backend/data.db
```

只能防止以后继续提交，不能抹掉历史提交里的旧内容。

因此必须做两层处理：

1. 当前索引清理：让后续提交不再包含这些文件
2. 历史重写：把旧提交里的敏感内容从可达历史中移除

## 2. 处理原则

这次清理遵循了四个原则：

1. 代码和模板保留在仓库里，真实数据和密钥保留在本地
2. 能重新生成的内容不进版本库
3. 清理 Git 跟踪时不删除本机文件
4. 历史重写前后都做校验，确认远端和本地都不再保留可达敏感历史

## 3. 代码和配置层面的改动

### 3.1 忽略规则

在 [.gitignore](/Users/dovea/Desktop/Github/project-manage/.gitignore) 中补齐了以下规则：

```gitignore
.env
.env.*
!.env.example

.venv/
.venv312/

.local/
backend/data.db

frontend/node_modules/
frontend/dist/
*.tsbuildinfo
__pycache__/
```

作用：

- 忽略真实环境变量文件
- 忽略本地 SQLite 数据
- 忽略虚拟环境、依赖目录、构建产物和缓存
- 保留 `.env.example` 作为可提交模板

### 3.2 配置模板

新增了 [.env.example](/Users/dovea/Desktop/Github/project-manage/.env.example)，用于保留“配置结构”而不是“真实密钥”。

当前模板中保留了：

```env
ANTHROPIC_API_KEY=
SQLITE_DB_PATH=.local/project-manage.db
```

### 3.3 数据库路径调整

在 [database.py](/Users/dovea/Desktop/Github/project-manage/backend/app/database.py) 中调整了 SQLite 的默认路径策略：

- 优先读取 `DATABASE_URL`
- 否则读取 `SQLITE_DB_PATH`
- 默认落到 `.local/project-manage.db`
- 如果旧的 `backend/data.db` 存在且新路径不存在，会自动复制旧库到新位置

这样做的目的，是把真实业务数据从仓库目录里的默认受跟踪位置，迁移到默认被忽略的本地目录。

## 4. 本次 Git 操作记录

下面记录本次实际做过的 Git 操作，方便后续审计和复盘。

### 4.1 在当前工作仓库中移除敏感文件和缓存文件的跟踪

先移除敏感文件：

```bash
git rm --cached .env backend/data.db
```

再移除 Python 缓存目录：

```bash
git rm --cached -r backend/app/__pycache__ backend/app/routers/__pycache__ backend/app/services/__pycache__
```

这一步只会把文件从 Git 索引中拿掉，不会删除你本地磁盘上的真实文件。

### 4.2 建立镜像仓库，用于历史重写

为了避免直接在当前脏工作区里重写历史，先创建镜像仓库：

```bash
git clone --mirror . /tmp/project-manage-history-rewrite
```

使用镜像仓库有两个好处：

- 不会污染当前工作目录
- 可以直接针对所有 refs 做历史重写

### 4.3 重写历史

由于环境里没有 `git filter-repo`，本次使用了 `git filter-branch`：

```bash
git filter-branch --force \
  --index-filter 'git rm -r --cached --ignore-unmatch .env backend/data.db .venv .venv312 frontend/node_modules frontend/dist backend/app/__pycache__ backend/app/routers/__pycache__ backend/app/services/__pycache__ frontend/tsconfig.app.tsbuildinfo frontend/tsconfig.node.tsbuildinfo' \
  --prune-empty \
  --tag-name-filter cat \
  -- --all
```

说明：

- `.env` 和 `backend/data.db` 是敏感内容
- `.venv`、`node_modules`、`dist`、`__pycache__`、`*.tsbuildinfo` 属于重复冗余本地产物
- `--prune-empty` 用来删除因为清理文件而变成空提交的提交

### 4.4 清除历史重写留下的备份引用

`git filter-branch` 会保留 `refs/original/` 作为回退引用，如果不清掉，旧历史依然可达。

本次执行了：

```bash
git for-each-ref --format='delete %(refname)' refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

这一步之后，再执行：

```bash
git log --all -- .env backend/data.db .venv .venv312 frontend/node_modules frontend/dist backend/app/__pycache__ backend/app/routers/__pycache__ backend/app/services/__pycache__ frontend/tsconfig.app.tsbuildinfo frontend/tsconfig.node.tsbuildinfo
```

应当返回空结果。

### 4.5 把重写后的历史推送到 GitHub

镜像仓库修正远端地址后，强推全部引用：

```bash
git remote set-url origin https://github.com/hujx99/project-manage.git
git push --force --mirror origin
```

这是本次最关键的一步，因为只有这一步完成后，GitHub 上的可达历史才会被替换。

### 4.6 让当前工作仓库对齐到新的远端历史

远端历史重写后，当前工作副本的本地 `main` 还停留在旧提交链上，因此需要重新对齐。

为了避免误操作，先创建临时备份分支：

```bash
git branch backup/pre-history-rewrite-20260328 HEAD
```

然后让当前分支指向新的 `origin/main`：

```bash
git reset origin/main
```

这里使用的是默认 mixed reset，目的不是删除工作区，而是重新对齐分支指针和索引。

### 4.7 清理当前索引中的本地产物

在当前工作仓库中，再次把本地产物从索引中彻底拿掉：

```bash
git rm --cached -r -q --ignore-unmatch .venv .venv312 frontend/node_modules frontend/dist backend/app/__pycache__ backend/app/routers/__pycache__ backend/app/services/__pycache__ frontend/tsconfig.app.tsbuildinfo frontend/tsconfig.node.tsbuildinfo
```

### 4.8 补齐最后一条忽略规则并提交

因为 `frontend/tsconfig*.tsbuildinfo` 会再次出现在未跟踪文件里，所以最后补了一条忽略规则：

```gitignore
*.tsbuildinfo
```

并完成提交和推送：

```bash
git add .gitignore
git commit -m "Ignore TypeScript build info files"
git push origin main
```

本次最终提交为：

```text
7136742 Ignore TypeScript build info files
```

### 4.9 清理当前本地仓库中的旧可达历史

在确认远端和当前分支都已经稳定后，删除临时备份分支，并清理本地 reflog：

```bash
git branch -D backup/pre-history-rewrite-20260328
git reflog expire --expire=now --all
git gc --prune=now
```

这样处理后，当前本地仓库里也不再保留重写前的可达历史。

## 5. 最终结果

本次清理完成后的状态如下：

- GitHub 远端历史已经重写
- `.env` 和 `backend/data.db` 已从远端可达历史中移除
- `.venv`、`node_modules`、`dist`、`__pycache__`、`*.tsbuildinfo` 已从版本库移除
- 当前工作仓库已对齐到新的 `origin/main`
- 当前工作区为干净状态
- 本地真实文件仍然保留，可以继续开发和运行

## 6. 后续必须继续做的事

历史重写只能处理“代码仓库里的泄露”，不能让已经暴露过的密钥自动失效。

因此还必须执行以下动作：

### 6.1 轮换已经暴露过的密钥

至少需要轮换：

- `ANTHROPIC_API_KEY`

如果 `.env` 中还有其他第三方凭证，也应一并轮换。

### 6.2 通知其他协作者重新同步仓库

因为历史已经重写，其他协作者本地的旧提交链与远端不再兼容。

最稳妥的方式：

```bash
git clone <repo-url>
```

如果必须保留旧工作区，至少需要先备份本地改动，再重新对齐：

```bash
git fetch origin
git reset --hard origin/main
```

### 6.3 之后的提交规范

后续应坚持以下规则：

- `.env` 只在本地使用，仓库里只保留 `.env.example`
- SQLite 真库只放在 `.local/` 这类忽略目录
- `node_modules`、虚拟环境、构建产物、缓存文件不提交
- 需要审计时，优先检查 `git status` 和 `.gitignore`

## 7. 建议的长期改进

为了避免同类问题再次发生，建议后续补上：

1. 在 CI 或本地 pre-commit 中加入敏感文件扫描
2. 对 `.env`、`*.db`、`node_modules`、`.venv` 做提交前阻断
3. 把“本地运行约定”和“数据目录约定”写进开发手册
4. 定期检查仓库体积和 Git 历史中的大文件

## 8. 结论

这次处理的核心，不是简单“删几个文件”，而是做了三件完整的事：

1. 把真实敏感数据从版本库和历史里移出去
2. 把重复冗余、可再生成的本地产物从版本库里清掉
3. 把忽略规则、配置模板和数据库路径策略补齐，避免问题再次发生

至此，这个仓库已经从“会把本地数据和依赖一起推上 GitHub”的状态，恢复到了“代码可提交、密钥和数据本地保留、构建产物不入库”的正常状态。
