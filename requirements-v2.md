# 项目-合同-付款管理系统 — 需求规格说明 v2

## 一、系统概述

替代 WPS 多维表格，实现 **项目 → 合同 → 付款计划** 三级关联管理，并支持合同明细（标的清单）和合同变更记录。单用户本地 Web 应用，SQLite 存储，前后端分离。

核心亮点：
- 三级关联：项目 → 合同 → 付款计划
- **AI 截图识别**：截图 OA 系统合同备案表 → 自动解析 → 一键导入
- Excel 批量导入/导出
- 仪表盘统计总览

## 二、技术选型

| 层 | 技术 | 说明 |
|---|---|---|
| 后端 | Python + FastAPI | 轻量、类型安全、自动 OpenAPI 文档 |
| 数据库 | SQLite（SQLAlchemy ORM） | 零运维，单文件备份 |
| 前端 | React + TypeScript + Ant Design | 表格/表单/统计组件成熟，中文友好 |
| AI 识别 | Claude API（claude-sonnet-4-20250514）| 截图 → 结构化 JSON，Vision 能力 |
| 部署 | 本地 `uvicorn` 或 Docker Compose | 一条命令启动 |

## 三、数据模型（共 5 张表）

### 3.1 项目表 `projects`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | INTEGER PK | 自动 | 主键 |
| project_code | VARCHAR(50) UNIQUE | ✅ | 项目编号，如 `WLGS202400076` |
| project_name | VARCHAR(300) | ✅ | 项目名称 |
| project_type | VARCHAR(50) | ❌ | 项目属性：研发项目 / 工程项目 / 服务项目 |
| start_date | DATE | ❌ | 立项日期 |
| status | VARCHAR(20) | ✅ | 项目状态：立项 / 执行中 / 验收 / 结项 |
| budget | DECIMAL(14,2) | ❌ | 项目金额（预算） |
| manager | VARCHAR(50) | ❌ | 负责人 |
| remark | TEXT | ❌ | 备注（如"国家重大科技专项横向项目"） |
| created_at | DATETIME | 自动 | |
| updated_at | DATETIME | 自动 | |

### 3.2 合同表 `contracts`（根据 OA 采购合同备案表完善）

| 字段 | 类型 | 必填 | 说明 | 来源 |
|---|---|---|---|---|
| id | INTEGER PK | 自动 | 主键 | |
| project_id | FK → projects.id | ✅ | 所属项目 | OA: 项目编号/项目名称 |
| contract_code | VARCHAR(80) UNIQUE | ✅ | 合同编号 `WLGS202500056CG20260005` | OA: 合同编号 |
| contract_name | VARCHAR(500) | ✅ | 合同名称 | OA: 合同名称 |
| procurement_type | VARCHAR(50) | ❌ | 采购类型：自用类-其他 / 项目类 等 | OA: 采购类型 |
| cost_department | VARCHAR(100) | ❌ | 费用归属责任中心：规划部 / 研发部 等 | OA: 费用归属责任中心 |
| vendor | VARCHAR(200) | ❌ | 客户/供应商单位名称 | OA: 客户单位名称 |
| amount | DECIMAL(14,2) | ✅ | 合同金额（变更后取最新值） | OA: 采购合同金额（变更后） |
| amount_before_change | DECIMAL(14,2) | ❌ | 合同金额（变更前） | OA: 合同金额（变更前） |
| sign_date | DATE | ❌ | 合同签订日期 | OA: 合同签订日期 |
| filing_date | DATE | ❌ | 合同备案日期 | OA: 合同备案日期 |
| start_date | DATE | ❌ | 开始执行日期 | OA: 开始执行日期 |
| end_date | DATE | ❌ | 结束执行日期 | OA: 结束执行日期 |
| parent_contract_code | VARCHAR(80) | ❌ | 主合同编号（关联框架合同） | OA: 主合同编号 |
| renewal_type | VARCHAR(50) | ❌ | 合同续签类型：固定期限合同 / 框架合同 | OA: 合同续签类型 |
| payment_direction | VARCHAR(10) | ❌ | 收支方向：支出 / 收入 | OA: 收支方向 |
| status | VARCHAR(20) | ✅ | 合同状态：草拟/签订/服务中/执行中/归档 | OA: 合同状态 |
| filing_reference | TEXT | ❌ | 备案合同文件名/编号 | OA: 备案合同 |
| remark | TEXT | ❌ | 备注 | |
| created_at | DATETIME | 自动 | | |
| updated_at | DATETIME | 自动 | | |

### 3.3 合同明细表 `contract_items`（标的清单）

对应 OA 截图中的标的清单区域。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | INTEGER PK | 自动 | |
| contract_id | FK → contracts.id | ✅ | 所属合同 |
| seq | INTEGER | ✅ | 序号 |
| item_name | VARCHAR(200) | ✅ | 标的名称，如"设备采购（服务期）""设备采购（万兆交换机）" |
| quantity | DECIMAL(10,2) | ✅ | 数量 |
| unit | VARCHAR(20) | ❌ | 单位：个/台/套/项 等 |
| unit_price | DECIMAL(14,2) | ❌ | 单价 |
| amount | DECIMAL(14,2) | ✅ | 金额（= 数量 × 单价） |

### 3.4 付款计划/记录表 `payments`

对应 OA 截图中的"付款期间"表格，同时兼容 WPS 多维表格中的付款管理。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | INTEGER PK | 自动 | |
| contract_id | FK → contracts.id | ✅ | 所属合同 |
| seq | INTEGER | ❌ | 序号（第几期） |
| phase | VARCHAR(100) | ❌ | 付款期间/阶段名称：第一期/第二期/质保金 等 |
| planned_date | DATE | ❌ | 计划支付日期（来自 OA 付款计划） |
| planned_amount | DECIMAL(14,2) | ❌ | 计划支付金额（来自 OA 付款计划） |
| actual_date | DATE | ❌ | 实际付款日期 |
| actual_amount | DECIMAL(14,2) | ❌ | 实际付款金额（流程已提金额） |
| pending_amount | DECIMAL(14,2) | 自动 | 待付款 = planned_amount - actual_amount |
| payment_status | VARCHAR(20) | ✅ | 状态：未付 / 已提交 / 已付款 |
| description | VARCHAR(500) | ❌ | 支付说明 |
| remark | TEXT | ❌ | 备注 |
| created_at | DATETIME | 自动 | |
| updated_at | DATETIME | 自动 | |

### 3.5 合同变更记录表 `contract_changes`

对应 OA 截图底部的变更记录表。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | INTEGER PK | 自动 | |
| contract_id | FK → contracts.id | ✅ | 所属合同 |
| seq | INTEGER | ✅ | 序号 |
| change_date | DATE | ✅ | 变更日期 |
| change_info | VARCHAR(500) | ❌ | 变更合同信息 |
| before_content | TEXT | ❌ | 变更前内容 |
| after_content | TEXT | ❌ | 变更后内容 |
| change_description | TEXT | ❌ | 变更说明 |

### 3.6 关联关系总览

```
项目 projects
 ├── 1:N ── 合同 contracts
 │            ├── 1:N ── 合同明细 contract_items（标的清单）
 │            ├── 1:N ── 付款计划 payments
 │            └── 1:N ── 变更记录 contract_changes
```

## 四、功能需求

### 4.1 项目管理（CRUD）

- **列表页**：表格展示，支持按状态筛选、编号/名称搜索
- **新建/编辑**：表单录入
- **详情页**：项目信息 + 下属合同列表 + 汇总统计
  - 合同总数 / 合同总金额
  - 已付总额 / 待付总额
  - 付款进度百分比
- **删除保护**：有关联合同时禁止删除

### 4.2 合同管理（CRUD）

- **列表页**：表格展示，显示所属项目、供应商、金额、状态
- **新建**：下拉选择所属项目，录入完整合同信息
- **详情页**：合同全部字段 + 三个子表 Tab 切换
  - **标的清单** Tab：合同明细列表（可增删改）
  - **付款计划** Tab：付款记录列表（可增删改）
  - **变更记录** Tab：变更历史列表（可增删改）
- **合同金额校验**：标的清单金额合计应等于合同金额（不等时给出警告）
- **付款进度**：付款计划金额合计 vs 已付金额，可视化进度条

### 4.3 付款管理（CRUD）

- **全局列表页**：跨合同展示所有付款记录，显示关联项目+合同名称
- **联动下拉**：先选项目 → 筛选出该项目下合同 → 选合同
- **自动计算**：待付款金额 = 计划金额 − 实际金额
- **状态切换**：未付 → 已提交 → 已付款

### 4.4 仪表盘（Dashboard）

- **统计卡片**：项目总数 / 合同总数 / 付款总笔数
- **金额汇总**：总预算 / 总合同额 / 总已付 / 总待付
- **状态分布**：项目状态分布图（饼图）
- **待付提醒**：近 30 天内应付但未付的付款列表
- **最近活动**：最近新增/修改的合同和付款

### 4.5 数据导入 — 方案 A：AI 截图识别导入（增强功能）

#### 工作流程

```
用户上传 OA 截图（1张或多张）
        ↓
后端将图片发送至 Claude API（Vision）
        ↓
Claude 返回结构化 JSON（合同信息 + 标的 + 付款计划）
        ↓
前端展示解析结果，用户可修改/确认
        ↓
确认后写入数据库
```

#### 技术实现

```python
# 后端伪代码
@router.post("/api/import/screenshot")
async def import_from_screenshot(files: List[UploadFile]):
    # 1. 将图片转为 base64
    images_b64 = [base64.b64encode(f.read()).decode() for f in files]

    # 2. 调用 Claude API
    response = anthropic_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": [
                *[{"type": "image", "source": {"type": "base64",
                    "media_type": "image/png", "data": b64}}
                  for b64 in images_b64],
                {"type": "text", "text": EXTRACTION_PROMPT}
            ]
        }]
    )

    # 3. 解析返回的 JSON
    parsed = json.loads(response.content[0].text)

    # 4. 返回给前端供确认
    return {"parsed_data": parsed, "confidence": "high"}
```

#### AI 提取 Prompt 模板

```
你是一个合同信息提取助手。请从以下OA系统截图中提取合同信息，严格返回JSON格式：

{
  "contract": {
    "contract_code": "合同编号",
    "contract_name": "合同名称",
    "procurement_type": "采购类型",
    "cost_department": "费用归属责任中心",
    "vendor": "客户单位名称",
    "amount": 数字,
    "amount_before_change": 数字或null,
    "sign_date": "YYYY-MM-DD",
    "filing_date": "YYYY-MM-DD或null",
    "start_date": "YYYY-MM-DD或null",
    "end_date": "YYYY-MM-DD或null",
    "parent_contract_code": "主合同编号或null",
    "renewal_type": "合同续签类型",
    "payment_direction": "支出或收入",
    "status": "合同状态",
    "project_code": "项目编号（如能识别）",
    "project_name": "项目名称（如能识别）"
  },
  "items": [
    {"seq": 1, "item_name": "标的名称", "quantity": 数字, "unit": "个", "unit_price": 数字, "amount": 数字}
  ],
  "payment_plans": [
    {"seq": 1, "phase": "第一期", "planned_date": "YYYY-MM-DD", "planned_amount": 数字, "description": "支付说明"}
  ],
  "changes": [
    {"seq": 1, "change_date": "YYYY-MM-DD", "change_info": "", "before_content": "", "after_content": "", "change_description": ""}
  ]
}

注意：
- 金额统一为数字，不含逗号和人民币符号
- 日期格式 YYYY-MM-DD
- 无法识别的字段填 null
- 仅返回 JSON，不要其他文字
```

#### 前端交互

1. 拖拽/粘贴上传截图（支持多张拼接）
2. 点击"AI 识别"按钮，显示 loading
3. 返回结果后，以**可编辑表单**形式展示（类似合同编辑页，但预填了 AI 识别的值）
4. 用户检查并修改（AI 不确定的字段标黄高亮）
5. 点击"确认导入" → 写入数据库
6. 自动关联到对应项目（通过项目编号匹配）

### 4.6 数据导入 — 方案 B：Excel 模板导入（基础功能）

#### 模板设计

提供 3 个 Excel 模板下载：

**① 项目导入模板.xlsx**

| 项目编号* | 项目名称* | 项目属性 | 立项日期 | 项目状态* | 项目金额 | 负责人 | 备注 |
|---|---|---|---|---|---|---|---|

**② 合同导入模板.xlsx**

| 项目编号* | 合同编号* | 合同名称* | 采购类型 | 费用归属 | 供应商* | 合同金额* | 签订日期 | 合同状态* | 收支方向 | 备注 |
|---|---|---|---|---|---|---|---|---|---|---|

**③ 付款导入模板.xlsx**

| 合同编号* | 序号 | 付款阶段 | 计划日期 | 计划金额* | 实际日期 | 实际金额 | 付款状态* | 说明 |
|---|---|---|---|---|---|---|---|---|

（`*` 为必填字段）

#### 导入逻辑

- 上传 xlsx → 后端用 openpyxl 解析
- 自动匹配列名（支持中英文列名映射）
- 通过项目编号/合同编号关联已有记录
- 重复编号：提示"已存在，是否覆盖？"
- 校验失败的行：返回错误明细（第N行：金额不能为空）
- 导入结果：成功 X 条，失败 Y 条，跳过 Z 条

### 4.7 数据导出

- 支持按筛选条件导出
- 合同导出时可选择包含"标的明细""付款计划"子表
- 导出格式：xlsx，含 sheet 分页

## 五、API 设计

```
# ─── 项目 ───
GET    /api/projects                     # 列表（?status=&search=&page=&size=）
POST   /api/projects                     # 新建
GET    /api/projects/{id}                # 详情（含合同列表+汇总）
PUT    /api/projects/{id}                # 更新
DELETE /api/projects/{id}                # 删除

# ─── 合同 ───
GET    /api/contracts                    # 列表（?project_id=&status=&search=）
POST   /api/contracts                    # 新建（body 可含 items + payments）
GET    /api/contracts/{id}               # 详情（含 items + payments + changes）
PUT    /api/contracts/{id}               # 更新
DELETE /api/contracts/{id}               # 删除

# ─── 合同明细（标的） ───
GET    /api/contracts/{id}/items         # 该合同的标的列表
POST   /api/contracts/{id}/items         # 新增标的
PUT    /api/contract-items/{item_id}     # 更新
DELETE /api/contract-items/{item_id}     # 删除

# ─── 付款计划 ───
GET    /api/payments                     # 全局列表（?contract_id=&status=）
POST   /api/payments                     # 新建
GET    /api/payments/{id}                # 详情
PUT    /api/payments/{id}                # 更新
DELETE /api/payments/{id}                # 删除

# ─── 合同变更 ───
GET    /api/contracts/{id}/changes       # 变更记录列表
POST   /api/contracts/{id}/changes       # 新增变更
PUT    /api/contract-changes/{change_id} # 更新
DELETE /api/contract-changes/{change_id} # 删除

# ─── 仪表盘 ───
GET    /api/dashboard/summary            # 全局统计
GET    /api/dashboard/pending-payments   # 待付款提醒

# ─── 导入导出 ───
POST   /api/import/screenshot            # AI截图识别导入
POST   /api/import/excel/{entity}        # Excel导入（entity: projects/contracts/payments）
GET    /api/export/{entity}              # Excel导出
GET    /api/import/template/{entity}     # 下载导入模板
```

## 六、非功能需求

| 项 | 要求 |
|---|---|
| 中文界面 | 所有标签、提示、校验信息均为中文 |
| 响应式 | 支持 1280px+ 桌面浏览器 |
| 数据校验 | 前后端双重校验（编号唯一、金额非负、关联存在性） |
| 备份 | SQLite 文件可直接复制备份 |
| 启动方式 | `docker compose up` 或 `python run.py` 一条命令启动 |
| AI 密钥 | Claude API Key 通过环境变量 `ANTHROPIC_API_KEY` 配置 |

## 七、项目结构

```
project-manager/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI 入口 + CORS
│   │   ├── config.py                  # 配置（含 API Key）
│   │   ├── database.py                # SQLAlchemy 引擎 + Session
│   │   ├── models.py                  # 5 张表的 ORM 模型
│   │   ├── schemas.py                 # Pydantic 请求/响应 Schema
│   │   ├── routers/
│   │   │   ├── projects.py
│   │   │   ├── contracts.py
│   │   │   ├── payments.py
│   │   │   ├── dashboard.py
│   │   │   └── import_export.py       # 导入导出 + AI 识别
│   │   └── services/
│   │       ├── ai_parser.py           # Claude Vision 调用封装
│   │       ├── excel_handler.py       # openpyxl 导入导出
│   │       └── statistics.py          # 统计汇总逻辑
│   ├── templates/                     # Excel 导入模板文件
│   │   ├── 项目导入模板.xlsx
│   │   ├── 合同导入模板.xlsx
│   │   └── 付款导入模板.xlsx
│   ├── requirements.txt
│   └── data.db
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Projects.tsx           # 项目列表 + 详情
│   │   │   ├── Contracts.tsx          # 合同列表 + 详情（含3个子Tab）
│   │   │   ├── Payments.tsx           # 付款全局列表
│   │   │   └── Import.tsx             # 导入页（AI截图 + Excel上传）
│   │   ├── components/
│   │   │   ├── ContractDetail.tsx      # 合同详情（含子表Tab）
│   │   │   ├── ScreenshotUploader.tsx  # 截图上传+AI识别组件
│   │   │   ├── ExcelUploader.tsx       # Excel上传组件
│   │   │   └── ParseResultForm.tsx     # AI识别结果确认表单
│   │   ├── api/
│   │   │   └── client.ts              # Axios 封装
│   │   └── App.tsx
│   └── package.json
├── docker-compose.yml
├── .env                               # ANTHROPIC_API_KEY=sk-...
└── README.md
```

## 八、开发阶段（给 Claude Code 的分步 Prompt）

### Phase 1 — 数据库 + 后端 CRUD

> 根据 requirements.md 第三节数据模型，用 Python + FastAPI + SQLAlchemy + SQLite 搭建后端。创建 5 张表（projects, contracts, contract_items, payments, contract_changes）的 ORM 模型，以及对应的 Pydantic Schema 和 CRUD API Router。合同新建 API 支持同时传入 items 和 payments 子表数据一次性创建。所有注释和错误提示用中文。先不做前端。

### Phase 2 — 前端 CRUD 页面

> 用 React + TypeScript + Ant Design 创建前端。实现：①项目列表页（表格+新建/编辑弹窗）；②合同列表页（显示所属项目，支持筛选）；③合同详情页（含"标的清单""付款计划""变更记录"三个Tab，每个Tab有增删改能力）；④付款全局列表页（先选项目→再选合同的联动下拉）。侧边栏导航。

### Phase 3 — 仪表盘 + 统计

> 添加 Dashboard 首页：4 个统计卡片（项目数/合同数/总金额/待付款）+ 项目状态饼图 + 近期待付款提醒列表。后端提供 /api/dashboard/summary 和 /api/dashboard/pending-payments 接口。

### Phase 4 — AI 截图导入

> 实现 AI 截图识别导入功能。后端新增 /api/import/screenshot 接口：接收图片 → 调用 Claude claude-sonnet-4-20250514 Vision API 提取合同结构化信息 → 返回 JSON。前端新增导入页：拖拽上传截图 → 点击"AI识别" → 显示可编辑的预填表单 → 用户确认后入库。Prompt 模板见 requirements.md 第 4.5 节。ANTHROPIC_API_KEY 从 .env 读取。

### Phase 5 — Excel 导入导出

> 实现 Excel 导入导出。后端用 openpyxl：①提供模板下载 API；②导入 API 解析 xlsx，自动匹配列名，通过编号关联已有项目/合同，返回导入结果（成功/失败/跳过条数）；③导出 API 按筛选条件导出 xlsx。前端在导入页增加 Excel 上传区域和模板下载按钮。

### Phase 6 — 收尾优化

> Docker 打包（docker-compose.yml）、README 使用说明、数据校验完善（编号唯一性/金额校验/关联完整性）、付款到期提醒。
