import json
import logging
import sys
from contextvars import ContextVar, Token
from datetime import UTC, datetime
from time import perf_counter
from typing import Any
from uuid import uuid4

from fastapi import Request

from lenjoy_bbs.core.config import Settings, get_settings

_REQUEST_CONTEXT: ContextVar[dict[str, Any]] = ContextVar("request_context", default={})
_LOGGING_CONFIGURED = False
_STANDARD_RECORD_FIELDS = {
    "args",
    "asctime",
    "created",
    "exc_info",
    "exc_text",
    "filename",
    "funcName",
    "levelname",
    "levelno",
    "lineno",
    "module",
    "msecs",
    "message",
    "msg",
    "name",
    "pathname",
    "process",
    "processName",
    "relativeCreated",
    "stack_info",
    "thread",
    "threadName",
    "taskName",
}
_REDACTED_KEYS = {
    "access_token",
    "authorization",
    "captcha",
    "captcha_code",
    "debug_code",
    "password",
    "password_hash",
    "token",
}


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


def get_request_context() -> dict[str, Any]:
    return dict(_REQUEST_CONTEXT.get())


def bind_request_context(**values: Any) -> Token:
    context = get_request_context()
    context.update({key: value for key, value in values.items() if value is not None})
    return _REQUEST_CONTEXT.set(context)


def clear_request_context(token: Token) -> None:
    _REQUEST_CONTEXT.reset(token)


def set_request_user(user_id: int | None) -> None:
    bind_request_context(user_id=user_id)


def log_event(logger: logging.Logger, level: int, event: str, **fields: Any) -> None:
    logger.log(level, event, extra={"event": event, **fields})


class RequestContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        for key, value in _REQUEST_CONTEXT.get().items():
            if not hasattr(record, key):
                setattr(record, key, value)
        if not hasattr(record, "event"):
            setattr(record, "event", record.getMessage())
        return True


class JsonLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "event": getattr(record, "event", record.getMessage()),
        }
        for field in ("request_id", "method", "path", "status_code", "duration_ms", "user_id", "client_ip", "app_env"):
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = value

        extras = {
            key: value
            for key, value in record.__dict__.items()
            if key not in _STANDARD_RECORD_FIELDS and key not in payload
        }
        for key, value in extras.items():
            payload[key] = _sanitize_value(key, value)

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=_json_default)


class TextLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        base = [
            datetime.fromtimestamp(record.created, UTC).isoformat(),
            record.levelname,
            record.name,
            getattr(record, "event", record.getMessage()),
        ]
        details = []
        for key in ("request_id", "method", "path", "status_code", "duration_ms", "user_id"):
            value = getattr(record, key, None)
            if value is not None:
                details.append(f"{key}={value}")
        message = " ".join(base + details)
        if record.exc_info:
            return f"{message}\n{self.formatException(record.exc_info)}"
        return message


def configure_logging(settings: Settings | None = None) -> None:
    global _LOGGING_CONFIGURED
    settings = settings or get_settings()
    root_logger = logging.getLogger()
    root_logger.setLevel(_resolve_level(settings.log_level))
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonLogFormatter() if settings.log_format.lower() == "json" else TextLogFormatter())
    handler.addFilter(RequestContextFilter())
    root_logger.handlers = [handler]

    for logger_name in ("uvicorn.error", "uvicorn", "fastapi"):
        logger = logging.getLogger(logger_name)
        logger.handlers = []
        logger.propagate = True
        logger.setLevel(_resolve_level(settings.log_level))

    access_logger = logging.getLogger("uvicorn.access")
    access_logger.handlers = []
    access_logger.propagate = False
    access_logger.disabled = True
    _LOGGING_CONFIGURED = True


def install_request_logging(app) -> None:
    logger = get_logger("lenjoy_bbs.http")

    @app.middleware("http")
    async def request_logging_middleware(request: Request, call_next):
        request_id = request.headers.get("X-Request-Id") or uuid4().hex
        token = bind_request_context(
            app_env=get_settings().app_env,
            client_ip=request.client.host if request.client else None,
            method=request.method,
            path=request.url.path,
            request_id=request_id,
        )
        request.state.request_id = request_id
        request.state.authenticated_user_id = None
        start = perf_counter()
        response = None
        try:
            response = await call_next(request)
            response.headers["X-Request-Id"] = request_id
            return response
        except Exception as exc:
            logger.error(
                "request.unhandled_exception",
                extra={
                    "event": "request.unhandled_exception",
                    "error_type": type(exc).__name__,
                    "status_code": 500,
                },
                exc_info=exc,
            )
            raise
        finally:
            status_code = response.status_code if response is not None else 500
            duration_ms = round((perf_counter() - start) * 1000, 2)
            if request.url.path != "/api/v1/health":
                level = logging.WARNING if status_code >= 500 or duration_ms >= get_settings().slow_request_ms else logging.INFO
                log_event(
                    logger,
                    level,
                    "http.request",
                    duration_ms=duration_ms,
                    status_code=status_code,
                    user_id=request.state.authenticated_user_id,
                )
            clear_request_context(token)


def _resolve_level(level_name: str) -> int:
    return getattr(logging, level_name.upper(), logging.INFO)


def _sanitize_value(key: str, value: Any) -> Any:
    normalized_key = key.lower()
    if normalized_key in _REDACTED_KEYS:
        return "[REDACTED]"
    if isinstance(value, dict):
        return {item_key: _sanitize_value(str(item_key), item_value) for item_key, item_value in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_sanitize_value(key, item) for item in value]
    return value


def _json_default(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.astimezone(UTC).isoformat()
    return str(value)
