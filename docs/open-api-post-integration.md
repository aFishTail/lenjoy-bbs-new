# Open API 发帖对接文档

## 1. 说明

Lenjoy BBS 提供一套面向第三方系统的发帖接口。

该接口适用于以下场景：

- 第三方业务系统代论坛账号发帖
- 外部内容平台将内容同步到论坛
- 企业内部系统通过固定账号池向论坛发布内容

当前版本能力范围：

- 支持发帖
- 复用现有论坛用户体系
- 调用方可指定一个已绑定的发布账号
- 支持帖子类型：`NORMAL`、`RESOURCE`

当前版本不支持：

- `BOUNTY` 悬赏帖
- 编辑帖子
- 删除帖子
- 关闭帖子
- 幂等去重

## 2. 接入前准备

在管理后台完成以下配置：

1. 创建 Open API 调用方
2. 系统生成对应 `apiKey`
3. 为该调用方配置一个或多个发布账号绑定
4. 为每个绑定生成 `bindingCode`

管理后台位置：

- 调用方列表：`/admin/open-api`
- 调用方绑定详情：`/admin/open-api/{clientId}`

说明：

- 一个调用方可以绑定多个论坛账号
- 发帖时不能直接传任意 `userId`
- 发帖时必须传该调用方名下的 `bindingCode`

## 3. 鉴权方式

请求头：

```http
X-API-Key: your_api_key
Content-Type: application/json
```

规则：

- `X-API-Key` 必填
- `apiKey` 无效时请求会被拒绝
- 调用方被停用时请求会被拒绝

## 4. 发帖接口

### 4.1 接口地址

```http
POST /api/open/v1/posts
```

### 4.2 请求头

```http
X-API-Key: your_api_key
Content-Type: application/json
```

### 4.3 请求体

```json
{
  "authorBindingCode": "partner_user_001",
  "postType": "NORMAL",
  "title": "这是一个测试帖子",
  "categoryId": 1,
  "tagIds": [10, 20],
  "content": "这里是帖子正文"
}
```

资源帖示例：

```json
{
  "authorBindingCode": "partner_user_002",
  "postType": "RESOURCE",
  "title": "Spring Boot 部署清单",
  "categoryId": 2,
  "tagIds": [30],
  "content": "这是资源帖的公开预览内容",
  "hiddenContent": "这里是购买后可见的下载地址或资源内容",
  "price": 99
}
```

## 5. 请求字段说明

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `authorBindingCode` | string | 是 | 发布账号绑定编码，必须属于当前 `apiKey` 对应调用方 |
| `postType` | string | 是 | 帖子类型，支持 `NORMAL`、`RESOURCE` |
| `title` | string | 是 | 帖子标题 |
| `categoryId` | number | 是 | 分类 ID |
| `tagIds` | number[] | 否 | 标签 ID 列表 |
| `content` | string | 是 | 帖子正文；普通帖必填，资源帖的公开内容也必填 |
| `hiddenContent` | string | 条件必填 | 仅 `RESOURCE` 帖子需要，表示购买后可见内容 |
| `price` | number | 条件必填 | 仅 `RESOURCE` 帖子需要，且必须大于 0 |

说明：

- `categoryId`、`tagIds` 必须是系统中有效且可用的数据
- 被绑定的论坛账号如果处于禁言、禁用等不可发帖状态，请求会失败
- 当前版本不支持 `BOUNTY`

## 6. 成功响应

```json
{
  "success": true,
  "code": "OK",
  "message": "成功",
  "data": {
    "postId": 123,
    "authorId": 88,
    "authorUsername": "alice",
    "postType": "NORMAL",
    "status": "PUBLISHED",
    "createdAt": "2026-04-04T12:00:00",
    "detailPath": "/posts/123"
  }
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `postId` | 新创建的帖子 ID |
| `authorId` | 实际发帖账号 ID |
| `authorUsername` | 实际发帖账号用户名 |
| `postType` | 帖子类型 |
| `status` | 创建后的帖子状态，正常为 `PUBLISHED` |
| `createdAt` | 创建时间 |
| `detailPath` | 论坛前台帖子详情路径 |

## 7. 失败响应

统一响应格式：

```json
{
  "success": false,
  "code": "OPEN_API_KEY_INVALID",
  "message": "API key is invalid",
  "data": null
}
```

## 8. 常见错误码

| 错误码 | 含义 |
| --- | --- |
| `OPEN_API_KEY_MISSING` | 缺少 `X-API-Key` |
| `OPEN_API_KEY_INVALID` | `apiKey` 无效 |
| `OPEN_API_KEY_DISABLED` | 调用方已被停用 |
| `OPEN_AUTHOR_BINDING_NOT_FOUND` | `authorBindingCode` 不存在、未启用，或不属于当前调用方 |
| `OPEN_POST_TYPE_UNSUPPORTED` | 当前提交了不支持的帖子类型，如 `BOUNTY` |
| `USER_MUTED` | 绑定账号处于禁言状态，不可发帖 |
| `USER_DISABLED` | 绑定账号状态不可发帖 |
| `CATEGORY_REQUIRED` | 分类为空 |
| `CONTENT_REQUIRED` | 正文为空 |
| `RESOURCE_CONTENT_REQUIRED` | 资源帖缺少隐藏内容 |
| `PRICE_INVALID` | 资源帖价格不合法 |
| `POST_TYPE_INVALID` | 帖子类型不合法 |
| `VALIDATION_ERROR` | 请求参数校验失败 |

## 9. 调用示例

### 9.1 cURL

普通帖：

```bash
curl -X POST "http://localhost:8080/api/open/v1/posts" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "authorBindingCode": "partner_user_001",
    "postType": "NORMAL",
    "title": "测试帖子",
    "categoryId": 1,
    "tagIds": [10],
    "content": "测试正文"
  }'
```

资源帖：

```bash
curl -X POST "http://localhost:8080/api/open/v1/posts" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "authorBindingCode": "partner_user_002",
    "postType": "RESOURCE",
    "title": "资源测试帖子",
    "categoryId": 2,
    "tagIds": [30],
    "content": "公开预览内容",
    "hiddenContent": "下载地址",
    "price": 99
  }'
```

### 9.2 JavaScript

```ts
async function createPost() {
  const response = await fetch("http://localhost:8080/api/open/v1/posts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": "your_api_key",
    },
    body: JSON.stringify({
      authorBindingCode: "partner_user_001",
      postType: "NORMAL",
      title: "测试帖子",
      categoryId: 1,
      tagIds: [10],
      content: "测试正文",
    }),
  });

  const result = await response.json();
  return result;
}
```

## 10. 对接建议

- 使用 HTTPS 传输 `apiKey`
- 将 `apiKey` 保存在服务端，不要暴露在前端页面
- 如业务可能发生重试，请调用方自行避免重复提交
- 发帖前建议先确认分类、标签和绑定账号是否已在后台配置完成

## 11. 当前限制

- 不支持幂等键
- 同一请求重复提交会生成多篇帖子
- 不支持悬赏帖
- 不支持开放接口后台自助申请，需管理员先配置调用方与绑定账号
