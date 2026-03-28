# Lenjoy BBS 项目记忆

## 项目概述
- **项目名称**: Lenjoy BBS (乐享社区)
- **类型**: 全栈论坛/社区应用
- **架构**: Monorepo (Turborepo)

## 技术栈

### 后端 (apps/api)
- **框架**: Java 21 + Spring Boot
- **数据库**: PostgreSQL
- **缓存**: Redis
- **认证**: JWT Bearer + 验证码
- **ORM**: JPA + Hibernate
- **迁移**: Flyway

### 前端 (apps/web)
- **框架**: Next.js 14 (App Router)
- **UI**: React + Tailwind CSS + shadcn/ui
- **状态管理**: React hooks

### 基础设施
- **容器**: Docker Compose
- **网关**: Nginx

## 目录结构

```
lenjoy-bbs/
├── apps/
│   ├── api/          # Java Spring Boot 后端
│   └── web/          # Next.js 前端
├── infra/
│   ├── docker/       # Docker Compose 配置
│   └── nginx/        # Nginx 网关配置
├── docs/             # 文档 (待开发)
└── memory/           # Claude Code 记忆文件
```

## 核心约定

### 后端
- 模块化单体风格，按 domain 文件夹组织 (controller, service, domain, mapper, security, exception)
- API 响应统一使用 `ApiResponse<T>` 封装
- 验证码流程: metadata 端点返回 captchaId + imageUrl + expireAt，image 端点返回图片流
- 认证端点: `/api/v1/auth`
- 使用 Lombok 减少样板代码
- 业务错误通过 `ApiException` 和 `GlobalExceptionHandler` 集中处理

### 前端
- 前后端同在一个 Next.js 应用，通过路由分组区分管理页面 (如 /admin)
- 验证码字段: captchaId, imageUrl, captchaCode, token

### 数据库
- Flyway SQL 迁移位于 `apps/api/src/main/resources/db/migration`
- 命名规则: `V{number}__{description}.sql`
- 优先使用向后兼容的增量迁移

## 运行命令

### 后端
```bash
cd apps/api && mvn spring-boot:run     # 本地运行
cd apps/api && mvn test                # 测试
```

### 前端
```bash
cd apps/web && npm run dev             # 开发
cd apps/web && npm run build           # 构建
```

### Docker
```bash
# 完整栈
docker compose -f infra/docker/docker-compose.yml up --build

# 仅本地依赖
docker compose --env-file .env -f infra/docker/docker-compose.dev.yml up -d
```

## 环境注意
- 需 Java 21
- PostgreSQL 密码变更需重置 volume: `docker compose --env-file .env -f infra/docker/docker-compose.dev.yml down -v`
- Redis 用于验证码和短期会话数据

## 参考文档
- README.md - 启动和环境详情
- 用户故事.md - 产品范围和验收标准
- 需求文档.md - 产品需求
- 技术栈方案.md - 架构决策和栈选择
- .github/copilot-instructions.md - 项目指南 (本文件来源)

## 近期工作 (2025-03)
- 用户登录/注册功能完成
- 帖子基础功能 (浏览、发布、管理)
- 验证码集成
- UI 样式改进

---
*最后更新: 2025-03*