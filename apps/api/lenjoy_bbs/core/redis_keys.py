from lenjoy_bbs.core.config import get_settings


def redis_key(*parts: object) -> str:
    prefix = get_settings().redis_key_prefix.strip(":")
    body = ":".join(str(part).strip(":") for part in parts if str(part).strip(":"))
    return f"{prefix}:{body}" if prefix else body
