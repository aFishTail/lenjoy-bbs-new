from datetime import datetime
from typing import Any


def camelize(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part[:1].upper() + part[1:] for part in tail)


def model_dict(model: Any, fields: list[str]) -> dict[str, Any]:
    data = {}
    for field in fields:
        value = getattr(model, field)
        if isinstance(value, datetime):
            value = value.isoformat()
        data[camelize(field)] = value
    return data


def user_public(user, roles: list[str] | None = None) -> dict[str, Any]:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "phone": user.phone,
        "avatarUrl": user.avatar_url,
        "bio": user.bio,
        "roles": roles or getattr(user, "role_codes", []),
    }
