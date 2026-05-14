from typing import Any


def meta(**extra: Any) -> dict[str, Any]:
    return {"apiVersion": "v1"} | extra


def success(data: Any = None, **meta_extra: Any) -> dict[str, Any]:
    return {"data": data, "error": None, "meta": meta(**meta_extra)}


def failure(code: str, message: str, **meta_extra: Any) -> dict[str, Any]:
    return {"data": None, "error": {"code": code, "message": message}, "meta": meta(**meta_extra)}
