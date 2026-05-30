from dataclasses import dataclass

from fastapi import status


@dataclass(frozen=True)
class ApiMessage:
    code: str
    text: str
    http_status: int = status.HTTP_400_BAD_REQUEST


class Common:
    VALIDATION_ERROR = ApiMessage("VALIDATION_ERROR", "请求参数校验失败", status.HTTP_422_UNPROCESSABLE_CONTENT)
    ROUTE_NOT_FOUND = ApiMessage("NOT_FOUND", "接口不存在", status.HTTP_404_NOT_FOUND)
    HTTP_ERROR = ApiMessage("HTTP_ERROR", "请求处理失败")
    INTERNAL_SERVER_ERROR = ApiMessage("INTERNAL_SERVER_ERROR", "服务器内部错误", status.HTTP_500_INTERNAL_SERVER_ERROR)


class Auth:
    AUTH_REQUIRED = ApiMessage("UNAUTHORIZED", "请先登录", status.HTTP_401_UNAUTHORIZED)
    TOKEN_INVALID = ApiMessage("UNAUTHORIZED", "登录状态已失效，请重新登录", status.HTTP_401_UNAUTHORIZED)
    USER_NOT_FOUND = ApiMessage("UNAUTHORIZED", "登录用户不存在", status.HTTP_401_UNAUTHORIZED)
    ACCOUNT_DISABLED = ApiMessage("ACCOUNT_DISABLED", "账号已被禁用", status.HTTP_403_FORBIDDEN)
    ADMIN_REQUIRED = ApiMessage("FORBIDDEN", "需要管理员权限", status.HTTP_403_FORBIDDEN)
    ACCOUNT_RESERVED = ApiMessage("ACCOUNT_RESERVED", "账号标识已被系统保留")
    ACCOUNT_IDENTIFIER_CONFLICT = ApiMessage("ACCOUNT_IDENTIFIER_CONFLICT", "用户名、邮箱和手机号不能重复")
    ACCOUNT_EXISTS = ApiMessage("ACCOUNT_EXISTS", "用户名、邮箱或手机号已存在")
    BAD_CREDENTIALS = ApiMessage("BAD_CREDENTIALS", "账号或密码错误", status.HTTP_401_UNAUTHORIZED)
    CAPTCHA_UNAVAILABLE = ApiMessage("CAPTCHA_UNAVAILABLE", "验证码服务暂不可用", status.HTTP_500_INTERNAL_SERVER_ERROR)
    CAPTCHA_EXPIRED = ApiMessage("CAPTCHA_EXPIRED", "验证码无效或已过期", status.HTTP_404_NOT_FOUND)
    CAPTCHA_INVALID = ApiMessage("CAPTCHA_INVALID", "验证码无效或已过期")


class Posts:
    POST_NOT_FOUND = ApiMessage("POST_NOT_FOUND", "帖子不存在", status.HTTP_404_NOT_FOUND)
    TAG_NOT_FOUND = ApiMessage("TAG_NOT_FOUND", "一个或多个标签不存在")
    UPDATE_FORBIDDEN = ApiMessage("FORBIDDEN", "只能修改自己的帖子", status.HTTP_403_FORBIDDEN)
    DELETE_FORBIDDEN = ApiMessage("FORBIDDEN", "只能删除自己的帖子", status.HTTP_403_FORBIDDEN)
    BOUNTY_DELETE_REQUIRES_REVIEW = ApiMessage("BOUNTY_DELETE_REQUIRES_REVIEW", "悬赏已有用户参与，需提交删除申请")
    BOUNTY_DELETE_REQUEST_PENDING = ApiMessage("BOUNTY_DELETE_REQUEST_PENDING", "悬赏删除申请已提交，请等待管理员处理")
    BOUNTY_DELETE_REQUEST_NOT_ALLOWED = ApiMessage("BOUNTY_DELETE_REQUEST_NOT_ALLOWED", "当前悬赏帖不能提交删除申请")
    INVALID_KEYWORD = ApiMessage("INVALID_KEYWORD", "搜索关键词过长", status.HTTP_422_UNPROCESSABLE_CONTENT)
    POST_NOT_BOUNTY = ApiMessage("POST_NOT_BOUNTY", "该帖子不是悬赏帖")
    ACCEPT_FORBIDDEN = ApiMessage("FORBIDDEN", "只有帖子作者可以采纳答案", status.HTTP_403_FORBIDDEN)
    BOUNTY_NOT_ACTIVE = ApiMessage("BOUNTY_NOT_ACTIVE", "悬赏未处于可采纳状态")
    BOUNTY_ALREADY_RESOLVED = ApiMessage("BOUNTY_ALREADY_RESOLVED", "悬赏答案已被采纳")
    BOUNTY_EXPIRED = ApiMessage("BOUNTY_EXPIRED", "悬赏已过期，不能采纳答案")
    COMMENT_NOT_FOUND = ApiMessage("COMMENT_NOT_FOUND", "评论不存在", status.HTTP_404_NOT_FOUND)
    COMMENT_REPLY_NOT_ACCEPTABLE = ApiMessage("COMMENT_NOT_ACCEPTABLE", "只能采纳一级回答")
    COMMENT_DELETED_NOT_ACCEPTABLE = ApiMessage("COMMENT_NOT_ACCEPTABLE", "已删除的评论不能被采纳")
    SELF_ACCEPT_DENIED = ApiMessage("SELF_ACCEPT_DENIED", "不能采纳自己的回答")
    POST_NOT_PURCHASABLE = ApiMessage("POST_NOT_PURCHASABLE", "该帖子不是可购买资源")
    SELF_PURCHASE_DENIED = ApiMessage("SELF_PURCHASE_DENIED", "不能购买自己的帖子")
    ALREADY_PURCHASED = ApiMessage("ALREADY_PURCHASED", "资源已购买")


class Wallet:
    INSUFFICIENT_COINS = ApiMessage("INSUFFICIENT_COINS", "金币余额不足")
    INSUFFICIENT_FROZEN_COINS = ApiMessage("INSUFFICIENT_FROZEN_COINS", "冻结金币余额不足")


class Users:
    SELF_FOLLOW_DENIED = ApiMessage("INVALID_OPERATION", "不能关注自己")
    USER_NOT_FOUND = ApiMessage("USER_NOT_FOUND", "用户不存在", status.HTTP_404_NOT_FOUND)
    ACCOUNT_RESERVED = Auth.ACCOUNT_RESERVED
    ACCOUNT_IDENTIFIER_CONFLICT = Auth.ACCOUNT_IDENTIFIER_CONFLICT


class Files:
    FILE_REQUIRED = ApiMessage("FILE_REQUIRED", "请选择要上传的图片")
    FILE_TOO_LARGE = ApiMessage("FILE_TOO_LARGE", "图片大小超过上传限制")
    FILE_TYPE_INVALID = ApiMessage("FILE_TYPE_INVALID", "仅支持 jpg、png、webp 和 gif 图片")
    UPLOAD_FAILED = ApiMessage("UPLOAD_FAILED", "图片上传失败", status.HTTP_500_INTERNAL_SERVER_ERROR)
    STORAGE_UNAVAILABLE = ApiMessage("STORAGE_UNAVAILABLE", "存储服务暂不可用", status.HTTP_500_INTERNAL_SERVER_ERROR)


class Admin:
    BOUNTY_DELETE_REQUEST_NOT_APPROVABLE = ApiMessage("BOUNTY_DELETE_REQUEST_NOT_APPROVABLE", "当前悬赏删除申请不能通过")
    BOUNTY_DELETE_REQUEST_NOT_FOUND = ApiMessage("BOUNTY_DELETE_REQUEST_NOT_FOUND", "悬赏删除申请不存在", status.HTTP_404_NOT_FOUND)
    BOUNTY_DELETE_REQUEST_ALREADY_HANDLED = ApiMessage("BOUNTY_DELETE_REQUEST_ALREADY_HANDLED", "悬赏删除申请已处理")
    REPORT_NOT_FOUND = ApiMessage("REPORT_NOT_FOUND", "举报不存在", status.HTTP_404_NOT_FOUND)
    APPEAL_NOT_FOUND = ApiMessage("APPEAL_NOT_FOUND", "申诉不存在", status.HTTP_404_NOT_FOUND)
    CATEGORY_NOT_FOUND = ApiMessage("CATEGORY_NOT_FOUND", "分类不存在", status.HTTP_404_NOT_FOUND)
    TAG_NOT_FOUND = ApiMessage("TAG_NOT_FOUND", "标签不存在", status.HTTP_404_NOT_FOUND)
    TAG_MERGE_INVALID = ApiMessage("TAG_MERGE_INVALID", "不能将标签合并到自身")


class OpenApi:
    UNAUTHORIZED = ApiMessage("OPEN_API_UNAUTHORIZED", "Open API 密钥无效", status.HTTP_401_UNAUTHORIZED)
    SYSTEM_USER_CONFLICT = ApiMessage(
        "OPEN_API_SYSTEM_USER_CONFLICT",
        "Open API 系统用户配置冲突",
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
