# 后台审计可视化手测记录（2026-03-29）

## 1. 测试范围

- 页面：`/admin/audit`
- 功能点：
  - 钱包流水 / 资源交易双视图切换
  - 审计筛选输入校验
  - 审计查询按钮状态与请求链路
  - 后台菜单与总览入口跳转

## 2. 测试环境

- 日期：2026-03-29
- 前端：Next.js Dev Server（`npm run dev -- -p 3100`）
- 浏览器：MCP 内置浏览器工具
- 后端：本地 `mvn spring-boot:run` 启动失败（数据库认证失败）

## 3. 前置状态

- 后端启动日志报错：`FATAL: password authentication failed for user "lenjoy"`
- 因后端未正常可用，审计 API 代理调用返回 `500`
- 前端页面可正常渲染与交互

## 4. 用例执行

### 用例 A：入口与页面结构

- 步骤：
  1. 打开 `/admin/audit`
  2. 检查侧边栏菜单项与页面标题
- 期望：
  - 菜单出现“审计中心”
  - 页面展示“后台审计可视化”
- 实际：通过

### 用例 B：双视图切换

- 步骤：
  1. 默认进入“钱包流水”
  2. 点击“资源交易”
- 期望：
  - 标题从“钱包流水审计”切换为“资源交易审计”
- 实际：通过

### 用例 C：资源交易筛选参数校验

- 步骤：
  1. 在“用户 ID（买家或卖家，可选）”输入 `abc`
  2. 点击“查询交易”
- 期望：
  - 阻止请求并提示“用户 ID 必须是正整数”
- 实际：通过

### 用例 D：钱包流水筛选参数校验

- 步骤：
  1. 切回“钱包流水”
  2. 将“条数”设为 `0`
  3. 点击“查询流水”
- 期望：
  - 阻止请求并提示“钱包流水条数必须是正整数”
- 实际：通过

### 用例 E：请求链路反馈

- 步骤：
  1. 将钱包条数恢复为 `100`
  2. 点击“查询流水”
- 期望：
  - 发起 `/api/admin/audit/wallet-ledger?limit=100`
  - 若后端异常，提示可读错误信息
- 实际：
  - 已发起请求（浏览器网络面板可见）
  - 因后端不可用返回 `500`
  - 页面提示：`请求失败（HTTP 500）`

## 5. 结果结论

- 前端审计可视化主流程（页面结构、切换、校验、查询触发）可用。
- 当前联调阻塞在后端数据库认证配置，导致审计查询无法拿到真实数据。
- 错误反馈已优化为可读文案，不再出现 JSON 解析异常提示。

## 6. 后续建议

- 修复本地后端数据库凭据后，再补一轮“真实数据链路手测”：
  - 钱包流水按 `userId + bizType` 精确筛选
  - 资源交易按 `userId / postId` 组合筛选
  - 汇总指标（成交总额、退款、净值）与列表数据一致性校验

## 7. 第二轮补测（真实数据链路）

### 7.1 环境修复与准备

- 修复项：
  - 后端启动注入仓库根目录 `.env` 后，数据库认证通过。
  - 本地历史库存在 Flyway `V10` checksum 不一致，按开发约定执行：
    - `docker compose --env-file .env -f infra/docker/docker-compose.dev.yml down -v`
    - `docker compose --env-file .env -f infra/docker/docker-compose.dev.yml up -d`
  - 后端重启后 11 条迁移全部成功。
- 联调数据造数（真实 API 链路）：
  - 注册测试用户：`admin01`（补充 `ADMIN` 角色）、`user01`
  - 创建资源帖：`audit-resource-post`，价格 `50`
  - `user01` 购买后发起申诉，`admin01` 审核通过并部分退款 `20`

### 7.2 用例 F：钱包流水真实数据查询

- 请求：`GET /api/admin/audit/wallet-ledger?limit=20`（经前端代理 `/api/admin/audit/wallet-ledger`）
- 结果：通过
- 关键验证：
  - 返回真实流水，包含：
    - `RESOURCE_PURCHASE`（支出 50）
    - `RESOURCE_SALE`（收入 50）
    - `RESOURCE_REFUND_OUT`（支出 20）
    - `RESOURCE_REFUND_IN`（收入 20）
    - `REGISTER_BONUS`（注册赠送）

### 7.3 用例 G：资源交易真实数据查询

- 请求：`GET /api/admin/audit/resource-trades?limit=20`（经前端代理 `/api/admin/audit/resource-trades`）
- 结果：通过
- 关键验证：
  - 返回记录：
    - `purchaseId=1`
    - `postTitle=audit-resource-post`
    - `price=50`
    - `refundedAmount=20`
    - `status=PARTIAL_REFUNDED`

### 7.4 用例 H：管理员权限拦截

- 请求：`user01` Token 调用 `GET /api/admin/audit/resource-trades?limit=20`
- 结果：通过
- 关键验证：
  - 返回 `HTTP 403 Forbidden`
  - 审计接口权限边界正常

### 7.5 第二轮结论

- 后台审计可视化对应的两条后端数据链路（wallet ledger / resource trades）已完成真实数据联调验证。
- 数据覆盖了购买、申诉、部分退款场景，且返回字段与页面展示需求一致。
- 管理员权限校验符合预期，非管理员无法访问审计查询。
