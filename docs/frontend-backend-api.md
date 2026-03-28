# 前后端接口文档

本文档只覆盖“前端真实在调用”的接口，不是泛化版 Swagger 抄录。

## 1. 总体约定

### 1.1 Base URL

前端统一通过 [frontend/src/api/client.ts](/Users/dovea/Desktop/Github/project-manage/frontend/src/api/client.ts) 发请求。

接口基址规则：

- 本地开发或预览：
  - 页面在 `localhost` / `127.0.0.1`
  - 或页面端口为 `5173` / `4173`
  - 则请求 `http://当前主机:8000/api`
- 反向代理部署：
  - 请求 `/api`

也就是说：

- 电脑本地看：`http://127.0.0.1:8000/api`
- 手机局域网看：`http://电脑局域网IP:8000/api`

### 1.2 错误返回

后端统一错误处理中间件在 [backend/app/main.py](/Users/dovea/Desktop/Github/project-manage/backend/app/main.py)。

常见错误格式：

```json
{ "message": "项目不存在" }
```

参数校验错误：

```json
{
  "message": "请求参数校验失败",
  "errors": [...]
}
```

### 1.3 数据约定

几个重要约定：

1. `pending_amount` 由后端计算
   - 计算规则：`planned_amount - actual_amount`
2. `GET /api/projects` 是唯一分页列表接口
   - `page_size <= 100`
3. `GET /api/contracts` 和 `GET /api/contracts/{id}` 都会带出嵌套子表
   - `items`
   - `payments`
   - `changes`
4. 付款状态前端统一显示为：
   - `未付`
   - `已提报`
   - `已付款`
   - 后端仍兼容历史值 `已提交`

## 2. 前端页面到接口的映射

| 页面 | 前端文件 | 主要接口 |
| --- | --- | --- |
| `/` | [Dashboard.tsx](/Users/dovea/Desktop/Github/project-manage/frontend/src/pages/Dashboard.tsx) | `GET /dashboard/summary` `GET /dashboard/workflow` `GET /dashboard/pending-payments` |
| `/projects` | [ProjectsPage.tsx](/Users/dovea/Desktop/Github/project-manage/frontend/src/pages/ProjectsPage.tsx) | `GET /projects` `POST /projects` `PUT /projects/{id}` `DELETE /projects/{id}` `GET /export/projects` |
| `/projects/:id` | [ProjectDetailPage.tsx](/Users/dovea/Desktop/Github/project-manage/frontend/src/pages/ProjectDetailPage.tsx) | `GET /projects/{id}` `GET /contracts` |
| `/contracts` | [ContractsPage.tsx](/Users/dovea/Desktop/Github/project-manage/frontend/src/pages/ContractsPage.tsx) | `GET /contracts` `POST /contracts` `GET /projects` `GET /export/contracts` |
| `/contracts/:id` | [ContractDetailPage.tsx](/Users/dovea/Desktop/Github/project-manage/frontend/src/pages/ContractDetailPage.tsx) | `GET /contracts/{id}` `POST/PUT/DELETE /contracts/{id}/items` `POST/PUT/DELETE /contracts/{id}/changes` `POST/PUT/DELETE /payments` |
| `/payments` | [PaymentsPage.tsx](/Users/dovea/Desktop/Github/project-manage/frontend/src/pages/PaymentsPage.tsx) | `GET /payments` `POST /payments` `PUT /payments/{id}` `DELETE /payments/{id}` `GET /contracts` `GET /projects` `GET /export/payments` |
| `/imports` | [ImportsPage.tsx](/Users/dovea/Desktop/Github/project-manage/frontend/src/pages/ImportsPage.tsx) | `GET /import/template/{entity}` `POST /import/excel/{entity}` `POST /import/screenshot` `POST /import/screenshot/confirm` |

## 3. 仪表盘接口

### 3.1 `GET /api/dashboard/summary`

用途：

- 首页基础统计
- 项目状态分布图

响应示例：

```json
{
  "project_count": 50,
  "contract_count": 20,
  "payment_count": 55,
  "total_budget": 249412537.73,
  "total_contract_amount": 12993840.0,
  "total_paid_amount": 516014.0,
  "total_pending_amount": 11479546.0,
  "project_status_distribution": [
    { "status": "立项", "count": 4 },
    { "status": "结项", "count": 35 }
  ]
}
```

### 3.2 `GET /api/dashboard/workflow`

用途：

- 首页业务流程总览
- 项目/合同/付款三个阶段的卡点统计

响应结构：

```json
{
  "project_stage": {
    "total": 50,
    "active_count": 15,
    "closed_count": 35,
    "linked_count": 12,
    "unlinked_count": 38
  },
  "contract_stage": {
    "total": 20,
    "active_count": 12,
    "archived_count": 8,
    "without_payment_count": 4,
    "warning_count": 1
  },
  "payment_stage": {
    "total": 55,
    "unpaid_count": 55,
    "submitted_count": 0,
    "paid_count": 0,
    "overdue_count": 52,
    "due_soon_count": 0
  }
}
```

说明：

- `project_stage.unlinked_count`: 已建项目但还没合同
- `contract_stage.without_payment_count`: 已有合同但还没付款计划
- `contract_stage.warning_count`: 合同金额与标的清单或已付款金额存在异常
- `payment_stage.overdue_count`: 计划日期已过且未付款

### 3.3 `GET /api/dashboard/pending-payments`

用途：

- 首页“近期待办”
- 首页“待付款提醒”

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 付款记录 ID |
| `project_name` | string | 所属项目名称 |
| `contract_name` | string | 所属合同名称 |
| `amount` | number | 取 `pending_amount`，如果为空则回退 `planned_amount` |
| `planned_date` | string \| null | 计划日期 |
| `payment_status` | string | 当前付款状态 |

## 4. 项目接口

项目类型见 [frontend/src/types/index.ts](/Users/dovea/Desktop/Github/project-manage/frontend/src/types/index.ts) 中 `Project` / `ProjectCreate`。

### 4.1 `GET /api/projects`

用途：

- 项目列表
- 项目筛选
- 项目看板数据

查询参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `status` | string | 按项目状态筛选 |
| `exclude_statuses` | string | 逗号分隔，排除状态 |
| `search` | string | 按项目编号或项目名称模糊搜索 |
| `sort_field` | string | 排序字段，默认 `start_date` |
| `sort_order` | `asc` \| `desc` | 排序方向 |
| `page` | number | 页码，从 1 开始 |
| `page_size` | number | 每页条数，最大 100 |

响应：

```json
{
  "total": 50,
  "page": 1,
  "page_size": 10,
  "items": [
    {
      "id": 1,
      "project_code": "P001",
      "project_name": "示例项目",
      "status": "立项",
      "contract_count": 2
    }
  ]
}
```

注意：

- 前端如果要“拉全量项目”，不能写 `page_size=1000`
- 当前正确做法是循环请求，见 [projects.ts](/Users/dovea/Desktop/Github/project-manage/frontend/src/services/projects.ts)

### 4.2 `GET /api/projects/{project_id}`

用途：

- 项目详情页

返回单个 `ProjectResponse`，额外带 `contract_count`。

### 4.3 `POST /api/projects`

用途：

- 新建项目

请求体字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `project_code` | 是 | 项目编号，唯一 |
| `project_name` | 是 | 项目名称 |
| `project_type` | 否 | 项目属性 |
| `start_date` | 否 | 立项日期，`YYYY-MM-DD` |
| `status` | 是 | 当前项目状态 |
| `budget` | 否 | 项目金额 |
| `manager` | 否 | 负责人 |
| `remark` | 否 | 备注 |

### 4.4 `PUT /api/projects/{project_id}`

用途：

- 编辑项目

请求体与 `POST /api/projects` 同结构，但支持部分字段更新。

### 4.5 `DELETE /api/projects/{project_id}`

用途：

- 删除项目

业务约束：

- 如果项目下已有合同，后端会返回：

```json
{ "message": "项目下存在合同，禁止删除" }
```

## 5. 合同接口

合同类型见 [frontend/src/types/index.ts](/Users/dovea/Desktop/Github/project-manage/frontend/src/types/index.ts) 中 `Contract` / `ContractCreate`。

### 5.1 `GET /api/contracts`

用途：

- 合同列表
- 合同筛选前的原始全集

特点：

- 当前后端不分页
- 每条合同会直接带出：
  - `items`
  - `payments`
  - `changes`
  - `warnings`

`warnings` 目前来自两条规则：

1. 合同金额与标的清单合计不一致
2. 付款总额超过合同金额

### 5.2 `GET /api/contracts/{contract_id}`

用途：

- 合同详情页

返回完整 `ContractResponse`，包含：

| 字段 | 说明 |
| --- | --- |
| `items` | 标的清单 |
| `payments` | 付款计划 |
| `changes` | 变更记录 |
| `warnings` | 风险提示 |

### 5.3 `POST /api/contracts`

用途：

- 新建合同

请求体核心字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `project_id` | 是 | 所属项目 ID |
| `contract_code` | 是 | 合同编号，唯一 |
| `contract_name` | 是 | 合同名称 |
| `amount` | 是 | 合同金额 |
| `status` | 是 | 合同状态 |
| `vendor` | 否 | 供应商 |
| `sign_date` | 否 | 签订日期 |
| `start_date` | 否 | 开始执行日期 |
| `end_date` | 否 | 结束执行日期 |
| `items` | 否 | 合同明细数组 |
| `payments` | 否 | 付款计划数组 |

业务约束：

- `project_id` 必须存在，否则返回 `所属项目不存在`

### 5.4 `PUT /api/contracts/{contract_id}`

用途：

- 编辑合同主信息

请求体为部分更新。

### 5.5 `DELETE /api/contracts/{contract_id}`

用途：

- 删除合同

业务约束：

- 如果合同下已存在：
  - 标的清单
  - 付款记录
  - 变更记录

则后端返回：

```json
{ "message": "合同下存在子记录，禁止删除" }
```

### 5.6 合同标的接口

#### `POST /api/contracts/{contract_id}/items`

用途：

- 新增标的清单行

请求字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `seq` | 是 | 序号 |
| `item_name` | 是 | 标的名称 |
| `quantity` | 是 | 数量 |
| `unit` | 否 | 单位 |
| `unit_price` | 否 | 单价 |
| `amount` | 是 | 金额 |

#### `PUT /api/contracts/{contract_id}/items/{item_id}`

- 用途：编辑标的清单行

#### `DELETE /api/contracts/{contract_id}/items/{item_id}`

- 用途：删除标的清单行

### 5.7 合同变更接口

#### `POST /api/contracts/{contract_id}/changes`

请求字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `seq` | 是 | 序号 |
| `change_date` | 是 | 变更日期 |
| `change_info` | 否 | 变更信息 |
| `before_content` | 否 | 变更前内容 |
| `after_content` | 否 | 变更后内容 |
| `change_description` | 否 | 变更说明 |

#### `PUT /api/contracts/{contract_id}/changes/{change_id}`

- 用途：编辑变更记录

#### `DELETE /api/contracts/{contract_id}/changes/{change_id}`

- 用途：删除变更记录

## 6. 付款接口

付款类型见 [frontend/src/types/index.ts](/Users/dovea/Desktop/Github/project-manage/frontend/src/types/index.ts) 中 `Payment` / `PaymentCreate`。

### 6.1 `GET /api/payments`

用途：

- 全局付款列表
- 合同详情里的付款子表刷新

查询参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `contract_id` | number | 可选，按合同过滤 |

返回：

- `PaymentResponse[]`

### 6.2 `GET /api/payments/{payment_id}`

- 用途：单条付款详情

### 6.3 `POST /api/payments`

用途：

- 新建付款记录

请求体字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `contract_id` | 是 | 所属合同 ID |
| `seq` | 否 | 期次 |
| `phase` | 否 | 付款阶段 |
| `planned_date` | 否 | 计划日期 |
| `planned_amount` | 否 | 计划金额 |
| `actual_date` | 否 | 实际日期 |
| `actual_amount` | 否 | 实付金额 |
| `payment_status` | 是 | 付款状态 |
| `description` | 否 | 支付说明 |
| `remark` | 否 | 备注 |

后端自动计算：

- `pending_amount`

### 6.4 `PUT /api/payments/{payment_id}`

用途：

- 编辑付款记录
- 标记为已付款

常见“标记已付款”写法：

```json
{
  "payment_status": "已付款",
  "actual_amount": 80000,
  "actual_date": "2026-03-28"
}
```

### 6.5 `DELETE /api/payments/{payment_id}`

- 用途：删除付款记录

## 7. 导入导出接口

### 7.1 `GET /api/import/template/{entity}`

用途：

- 下载 Excel 模板

可选 `entity`：

- `projects`
- `contracts`
- `payments`

返回：

- `xlsx` 文件流

### 7.2 `POST /api/import/excel/{entity}?duplicate_action=skip|update`

用途：

- Excel 批量导入

请求格式：

- `multipart/form-data`
- 文件字段名：`file`

查询参数：

| 参数 | 说明 |
| --- | --- |
| `duplicate_action=skip` | 重复编号跳过 |
| `duplicate_action=update` | 重复编号更新 |

返回结构：

```json
{
  "success": 10,
  "failed": 2,
  "skipped": 1,
  "errors": [
    { "row": 5, "message": "项目编号不存在" }
  ]
}
```

### 7.3 `POST /api/import/screenshot`

用途：

- 上传 OA 截图，调用 AI 识别合同、标的、付款计划、变更记录

请求格式：

- `multipart/form-data`
- 文件字段名：`files`
- 支持多文件

响应结构：

```json
{
  "parsed_data": {
    "contract": {},
    "items": [],
    "payment_plans": [],
    "changes": []
  },
  "uncertain_fields": [
    "contract.vendor",
    "payment_plans[0].planned_amount"
  ]
}
```

### 7.4 `POST /api/import/screenshot/confirm`

用途：

- 确认截图识别结果并正式写库

请求体：

```json
{
  "parsed_data": {
    "contract": {},
    "items": [],
    "payment_plans": [],
    "changes": []
  }
}
```

后端行为：

1. 校验合同编号、名称、状态、金额
2. 合同编号重复时拒绝导入
3. 若项目不存在，则自动创建项目
4. 创建合同
5. 创建标的、付款计划、变更记录

成功响应：

```json
{
  "message": "导入成功",
  "project_id": 12,
  "contract_id": 34
}
```

### 7.5 `GET /api/export/{entity}?format=xlsx`

用途：

- 列表页导出 Excel

可选 `entity`：

- `projects`
- `contracts`
- `payments`

前端当前使用方式：

- 项目页：`/export/projects`
- 合同页：`/export/contracts`
- 付款页：`/export/payments`

补充查询参数：

| 实体 | 可用参数 |
| --- | --- |
| `projects` | `status` `exclude_statuses` `search` `sort_field` `sort_order` |
| `contracts` | `project_id` `status` |
| `payments` | `contract_id` `payment_status` |

## 8. 当前接口层的几个注意点

### 8.1 项目列表是分页接口，合同和付款列表不是

这会导致三个模块的数据获取方式不对称：

- 项目：前端必须考虑分页
- 合同：当前是一次全量拉取
- 付款：当前也是一次全量拉取

如果后续数据量继续增大，合同和付款列表最好也补分页。

### 8.2 合同列表接口返回嵌套子表，载荷偏重

`GET /api/contracts` 当前直接把 `items / payments / changes / warnings` 一起返回，方便页面开发，但随着数据增大，首屏体积会变大。

如果后面做性能优化，可以拆成：

1. 列表只返回合同主信息
2. 详情接口再返回子表

### 8.3 删除保护是业务规则，不是前端提示

例如：

- 项目下有合同不能删
- 合同下有子记录不能删

这两个规则都已经在后端硬编码保护，前端即使漏校验，后端也会拦住。

### 8.4 本地预览时不要假设 `/api` 一定可用

本项目在本地 `vite dev / preview` 下，前端必须动态拼真实后端地址；只有在 Nginx 或 Docker 反向代理场景里，`/api` 才能正常工作。
