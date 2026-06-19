import secrets
from datetime import UTC, datetime, timedelta
from io import BytesIO
import logging
from random import SystemRandom
from typing import Protocol

from PIL import Image, ImageDraw, ImageFont
from redis.asyncio import Redis

from lenjoy_bbs.core.config import get_settings
from lenjoy_bbs.core.errors import ApiError
from lenjoy_bbs.core.logging import log_event
from lenjoy_bbs.core.messages import Auth
from lenjoy_bbs.core.redis_keys import redis_key

CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
logger = logging.getLogger("lenjoy_bbs.captcha")


class CaptchaStore(Protocol):
    async def set(self, captcha_id: str, code: str, ttl_seconds: int) -> None: ...

    async def get(self, captcha_id: str) -> str | None: ...

    async def pop(self, captcha_id: str) -> str | None: ...


class MemoryCaptchaStore:
    def __init__(self) -> None:
        self._items: dict[str, tuple[str, datetime]] = {}

    async def set(self, captcha_id: str, code: str, ttl_seconds: int) -> None:
        self._items[captcha_id] = (code, datetime.now(UTC) + timedelta(seconds=ttl_seconds))

    async def get(self, captcha_id: str) -> str | None:
        item = self._items.get(captcha_id)
        if not item:
            return None
        code, expires_at = item
        if datetime.now(UTC) > expires_at:
            self._items.pop(captcha_id, None)
            return None
        return code

    async def pop(self, captcha_id: str) -> str | None:
        code = await self.get(captcha_id)
        self._items.pop(captcha_id, None)
        return code


class RedisCaptchaStore:
    def __init__(self) -> None:
        self._redis = Redis.from_url(get_settings().resolved_redis_url, decode_responses=True)

    async def set(self, captcha_id: str, code: str, ttl_seconds: int) -> None:
        try:
            await self._redis.set(self._key(captcha_id), code, ex=ttl_seconds)
        except Exception as exc:
            logger.exception(
                "captcha.redis_set_failed",
                extra={"event": "captcha.redis_set_failed", "dependency": "redis", "operation": "set", "error_type": type(exc).__name__},
            )
            raise ApiError(Auth.CAPTCHA_UNAVAILABLE) from exc

    async def get(self, captcha_id: str) -> str | None:
        try:
            return await self._redis.get(self._key(captcha_id))
        except Exception as exc:
            logger.exception(
                "captcha.redis_get_failed",
                extra={"event": "captcha.redis_get_failed", "dependency": "redis", "operation": "get", "error_type": type(exc).__name__},
            )
            raise ApiError(Auth.CAPTCHA_UNAVAILABLE) from exc

    async def pop(self, captcha_id: str) -> str | None:
        try:
            return await self._redis.getdel(self._key(captcha_id))
        except Exception as exc:
            logger.exception(
                "captcha.redis_pop_failed",
                extra={"event": "captcha.redis_pop_failed", "dependency": "redis", "operation": "getdel", "error_type": type(exc).__name__},
            )
            raise ApiError(Auth.CAPTCHA_UNAVAILABLE) from exc

    def _key(self, captcha_id: str) -> str:
        return redis_key("auth", "captcha", captcha_id)


_memory_store = MemoryCaptchaStore()
_random = SystemRandom()


def get_captcha_store() -> CaptchaStore:
    settings = get_settings()
    if settings.is_test or settings.uses_sqlite:
        return _memory_store
    return RedisCaptchaStore()


async def issue_captcha() -> dict[str, str | int]:
    settings = get_settings()
    code = "".join(_random.choice(CAPTCHA_CHARS) for _ in range(settings.captcha_length))
    captcha_id = secrets.token_urlsafe(16)
    await get_captcha_store().set(captcha_id, code.lower(), settings.captcha_ttl_seconds)
    expire_at = int((datetime.now(UTC) + timedelta(seconds=settings.captcha_ttl_seconds)).timestamp() * 1000)
    data: dict[str, str | int] = {
        "captchaId": captcha_id,
        "imageUrl": f"/api/v1/auth/captcha/{captcha_id}/image",
        "expireAt": expire_at,
    }
    if settings.captcha_debug_enabled:
        data["debugCode"] = code
    log_event(logger, logging.INFO, "captcha.issued", captcha_id=captcha_id)
    return data


async def get_captcha_image(captcha_id: str) -> bytes:
    code = await get_captcha_store().get(captcha_id)
    if not code:
        raise ApiError(Auth.CAPTCHA_EXPIRED)
    return render_captcha_png(code.upper())


async def verify_captcha(captcha_id: str, captcha_code: str) -> None:
    expected = await get_captcha_store().pop(captcha_id)
    if not expected:
        raise ApiError(Auth.CAPTCHA_INVALID)
    if expected != captcha_code.strip().lower():
        raise ApiError(Auth.CAPTCHA_INVALID)


def render_captcha_png(code: str) -> bytes:
    image = Image.new("RGB", (130, 44), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=28)
    draw.text((18, 9), code, fill=(40, 40, 40), font=font)
    for _ in range(7):
        draw.line(
            (
                _random.randrange(130),
                _random.randrange(44),
                _random.randrange(130),
                _random.randrange(44),
            ),
            fill=(_random.randrange(120, 200), _random.randrange(120, 200), _random.randrange(120, 200)),
            width=1,
        )
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()
