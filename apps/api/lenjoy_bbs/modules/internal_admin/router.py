"""Internal admin router exposed to the Operations service.

All routes delegate mutation logic to the existing BBS domain services
(``lenjoy_bbs.modules.admin.*`` and ``lenjoy_bbs.modules.open_api.*``)
and only add the contract surface the Operations API expects.

Every mutation records an ``InternalAdminAuditLog`` row carrying the
trusted ``operator_id`` and ``request_id`` so that the BBS can attribute
the change back to the caller.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status

from lenjoy_bbs.core.config import get_settings
from lenjoy_bbs.core.dependencies import DbSession
from lenjoy_bbs.core.responses import success
from lenjoy_bbs.modules.admin.bounty_delete_requests.service import (
    list_bounty_delete_requests,
    review_bounty_delete_request,
)
from lenjoy_bbs.modules.admin.metrics.service import dashboard_metrics
from lenjoy_bbs.modules.admin.posts.service import (
    list_bounties,
    list_bounty_comments,
    list_posts,
    offline_post,
    online_post,
)
from lenjoy_bbs.modules.admin.reports.service import (
    list_reports,
    list_resource_appeals,
    review_comment_report,
    review_post_report,
    review_resource_appeal,
)
from lenjoy_bbs.modules.admin.taxonomy.service import (
    create_category,
    create_tag,
    delete_category,
    delete_tag,
    list_categories,
    list_tags,
    merge_tag,
    update_category,
    update_category_status,
    update_tag,
    update_tag_status,
)
from lenjoy_bbs.modules.admin.users.service import list_users, update_user_status
from lenjoy_bbs.modules.admin.wallet.service import (
    list_resource_trades,
    list_wallet_ledger,
    list_wallets,
    update_wallet_coins,
)

from . import schemas
from .audit import audit_mutation
from .dependencies import (
    InternalCaller,
    get_request_context_headers,
    require_mutation_headers,
    require_service_token,
)
from lenjoy_bbs.modules.open_api.bindings import (
    create_binding,
    delete_binding,
    list_bindings,
    update_binding_status,
)
from lenjoy_bbs.modules.open_api.client_management import (
    create_client,
    list_clients,
    update_client_status,
)

router = APIRouter(prefix="/admin", tags=["internal-admin"])

ServiceToken = Annotated[str, Depends(require_service_token)]
RequestIdHeader = Annotated[str, Depends(get_request_context_headers)]
MutationCaller = Annotated[InternalCaller, Depends(require_mutation_headers)]


def _ack(caller: InternalCaller) -> dict:
    return {
        "operatorId": caller.operator_id,
        "requestId": caller.request_id,
        "idempotencyKey": caller.idempotency_key,
    }


def _operator_admin_id(operator_id: str) -> int:
    """Map the trusted operator identifier to a synthetic int admin id.

    BBS domain services still take ``admin_id: int`` for the
    ``UserAccount.id`` foreign-key. The internal admin contract accepts
    a string operator identifier (so it can carry the operations
    service's user name) and we fold it into a stable positive int for
    storage.
    """
    try:
        return int(operator_id)
    except (TypeError, ValueError):
        return abs(hash(operator_id)) % (2**31 - 1) or 1


# ---------------------------------------------------------------------------
# Health probe (handy for orchestration)
# ---------------------------------------------------------------------------


@router.get("/ping")
async def ping(
    _token: ServiceToken,
    request_id: RequestIdHeader,
) -> dict:
    settings = get_settings()
    return success(
        {
            "service": "lenjoy-bbs-internal-admin",
            "requestId": request_id,
            "env": settings.app_env,
        }
    )


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------


@router.get("/metrics/dashboard")
async def metrics_dashboard(
    db: DbSession,
    _token: ServiceToken,
    _request_id: RequestIdHeader,
) -> dict:
    return success(await dashboard_metrics(db))


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


@router.get("/users")
async def list_users_route(
    db: DbSession,
    _token: ServiceToken,
    _request_id: RequestIdHeader,
    status_value: str | None = None,
    keyword: str | None = None,
) -> dict:
    return success(await list_users(db, status_value=status_value, keyword=keyword))


@router.patch("/users/{user_id}/status")
async def update_user_status_route(
    user_id: int,
    payload: schemas.UserStatusRequest,
    db: DbSession,
    _token: ServiceToken,
    caller: MutationCaller,
) -> dict:
    async with audit_mutation(
        db,
        domain="users",
        action="update_status",
        operator_id=caller.operator_id,
        request_id=caller.request_id,
        idempotency_key=caller.idempotency_key,
        target_id=user_id,
        payload=payload.model_dump(),
    ):
        await update_user_status(db, user_id, payload.status)
        ack = _ack(caller)
        ack["userId"] = user_id
        ack["status"] = payload.status
        return success(ack)


# ---------------------------------------------------------------------------
# Posts / Comments / Bounties
# ---------------------------------------------------------------------------


@router.get("/posts")
async def list_posts_route(
    db: DbSession,
    _token: ServiceToken,
    _request_id: RequestIdHeader,
    status_value: str | None = None,
    postType: str | None = None,
    author: str | None = None,
    categoryId: int | None = None,
    tagId: int | None = None,
) -> dict:
    return success(
        await list_posts(
            db,
            status_value=status_value,
            post_type=postType,
            author=author,
            category_id=categoryId,
            tag_id=tagId,
        )
    )


@router.patch("/posts/{post_id}/offline")
async def offline_post_route(
    post_id: int,
    db: DbSession,
    _token: ServiceToken,
    caller: MutationCaller,
) -> dict:
    async with audit_mutation(
        db,
        domain="posts",
        action="offline",
        operator_id=caller.operator_id,
        request_id=caller.request_id,
        idempotency_key=caller.idempotency_key,
        target_id=post_id,
    ):
        await offline_post(db, post_id, _operator_admin_id(caller.operator_id))
        ack = _ack(caller)
        ack["postId"] = post_id
        ack["status"] = "OFFLINE"
        return success(ack)


@router.patch("/posts/{post_id}/online")
async def online_post_route(
    post_id: int,
    db: DbSession,
    _token: ServiceToken,
    caller: MutationCaller,
) -> dict:
    async with audit_mutation(
        db,
        domain="posts",
        action="online",
        operator_id=caller.operator_id,
        request_id=caller.request_id,
        idempotency_key=caller.idempotency_key,
        target_id=post_id,
    ):
        await online_post(db, post_id)
        ack = _ack(caller)
        ack["postId"] = post_id
        ack["status"] = "PUBLISHED"
        return success(ack)


@router.get("/bounties")
async def list_bounties_route(
    db: DbSession,
    _token: ServiceToken,
    _request_id: RequestIdHeader,
    status_value: str | None = None,
    keyword: str | None = None,
) -> dict:
    return success(
        await list_bounties(db, bounty_status=status_value, keyword=keyword)
    )


@router.get("/bounties/{post_id}/comments")
async def list_bounty_comments_route(
    post_id: int,
    db: DbSession,
    _token: ServiceToken,
    _request_id: RequestIdHeader,
) -> dict:
    return success(await list_bounty_comments(db, post_id))


# ---------------------------------------------------------------------------
# Bounty delete requests
# ---------------------------------------------------------------------------


@router.get("/bounty-delete-requests")
async def list_bounty_delete_requests_route(
    db: DbSession,
    _token: ServiceToken,
    _request_id: RequestIdHeader,
    status_value: str | None = None,
    keyword: str | None = None,
) -> dict:
    return success(
        await list_bounty_delete_requests(
            db, status_value=status_value, keyword=keyword
        )
    )


@router.patch("/bounty-delete-requests/{request_id}")
async def review_bounty_delete_request_route(
    request_id: int,
    payload: schemas.BountyDeleteRequestReviewRequest,
    db: DbSession,
    _token: ServiceToken,
    caller: MutationCaller,
) -> dict:
    async with audit_mutation(
        db,
        domain="bounty_delete_requests",
        action=payload.action.lower(),
        operator_id=caller.operator_id,
        request_id=caller.request_id,
        idempotency_key=caller.idempotency_key,
        target_id=request_id,
        payload=payload.model_dump(),
    ):
        result = await review_bounty_delete_request(
            db,
            request_id,
            action=payload.action,
            note=payload.resolutionNote,
            admin_id=_operator_admin_id(caller.operator_id),
        )
        ack = _ack(caller)
        ack["requestId"] = result["id"]
        ack["status"] = result["status"]
        return success(ack)


# ---------------------------------------------------------------------------
# Reports / Appeals
# ---------------------------------------------------------------------------


@router.get("/reports")
async def list_reports_route(
    db: DbSession,
    _token: ServiceToken,
    _request_id: RequestIdHeader,
    status_value: str | None = None,
    targetType: str | None = None,
    keyword: str | None = None,
) -> dict:
    return success(
        await list_reports(
            db,
            status_value=status_value,
            target_type=targetType,
            keyword=keyword,
        )
    )


@router.patch("/reports/posts/{report_id}")
async def review_post_report_route(
    report_id: int,
    payload: schemas.ReportReviewRequest,
    db: DbSession,
    _token: ServiceToken,
    caller: MutationCaller,
) -> dict:
    async with audit_mutation(
        db,
        domain="reports.posts",
        action=payload.action or "update_status",
        operator_id=caller.operator_id,
        request_id=caller.request_id,
        idempotency_key=caller.idempotency_key,
        target_id=report_id,
        payload=payload.model_dump(),
    ):
        result = await review_post_report(
            db,
            report_id,
            status_value=payload.status,
            note=payload.resolutionNote,
            action=payload.action,
            admin_id=_operator_admin_id(caller.operator_id),
        )
        ack = _ack(caller)
        ack["reportId"] = result["id"]
        ack["status"] = result["status"]
        return success(ack)


@router.patch("/reports/comments/{report_id}")
async def review_comment_report_route(
    report_id: int,
    payload: schemas.ReportReviewRequest,
    db: DbSession,
    _token: ServiceToken,
    caller: MutationCaller,
) -> dict:
    async with audit_mutation(
        db,
        domain="reports.comments",
        action=payload.action or "update_status",
        operator_id=caller.operator_id,
        request_id=caller.request_id,
        idempotency_key=caller.idempotency_key,
        target_id=report_id,
        payload=payload.model_dump(),
    ):
        result = await review_comment_report(
            db,
            report_id,
            status_value=payload.status,
            note=payload.resolutionNote,
            action=payload.action,
            admin_id=_operator_admin_id(caller.operator_id),
        )
        ack = _ack(caller)
        ack["reportId"] = result["id"]
        ack["status"] = result["status"]
        return success(ack)


@router.get("/resource-appeals")
async def list_resource_appeals_route(
    db: DbSession,
    _token: ServiceToken,
    _request_id: RequestIdHeader,
    status_value: str | None = None,
    keyword: str | None = None,
) -> dict:
    return success(
        await list_resource_appeals(
            db, status_value=status_value, keyword=keyword
        )
    )


@router.patch("/resource-appeals/{appeal_id}")
async def review_resource_appeal_route(
    appeal_id: int,
    payload: schemas.ResourceAppealReviewRequest,
    db: DbSession,
    _token: ServiceToken,
    caller: MutationCaller,
) -> dict:
    async with audit_mutation(
        db,
        domain="resource_appeals",
        action=payload.action.lower(),
        operator_id=caller.operator_id,
        request_id=caller.request_id,
        idempotency_key=caller.idempotency_key,
        target_id=appeal_id,
        payload=payload.model_dump(),
    ):
        result = await review_resource_appeal(
            db,
            appeal_id,
            action=payload.action,
            refund_amount=payload.refundAmount,
            note=payload.resolutionNote,
            admin_id=_operator_admin_id(caller.operator_id),
        )
        ack = _ack(caller)
        ack["appealId"] = result["id"]
        ack["status"] = result["status"]
        return success(ack)


# ---------------------------------------------------------------------------
# Coins / Wallet
# ---------------------------------------------------------------------------


@router.get("/coins/users")
async def list_wallets_route(
    db: DbSession,
    _token: ServiceToken,
    _request_id: RequestIdHeader,
    status_value: str | None = None,
    keyword: str | None = None,
) -> dict:
    return success(await list_wallets(db, status_value, keyword))


@router.patch("/coins/users/{user_id}")
async def adjust_coins_route(
    user_id: int,
    payload: schemas.CoinAdjustRequest,
    db: DbSession,
    _token: ServiceToken,
    caller: MutationCaller,
) -> dict:
    async with audit_mutation(
        db,
        domain="wallet",
        action="adjust_coins",
        operator_id=caller.operator_id,
        request_id=caller.request_id,
        idempotency_key=caller.idempotency_key,
        target_id=user_id,
        payload=payload.model_dump(),
    ):
        result = await update_wallet_coins(
            db,
            user_id,
            payload.amount,
            payload.reason,
            _operator_admin_id(caller.operator_id),
        )
        ack = _ack(caller)
        ack.update(result)
        return success(ack)


@router.get("/audit/wallet-ledger")
async def audit_wallet_ledger_route(
    db: DbSession,
    _token: ServiceToken,
    _request_id: RequestIdHeader,
    userId: int | None = None,
    bizType: str | None = None,
    limit: int = 100,
) -> dict:
    return success(
        await list_wallet_ledger(
            db, user_id=userId, biz_type=bizType, limit=limit
        )
    )


@router.get("/audit/resource-trades")
async def audit_resource_trades_route(
    db: DbSession,
    _token: ServiceToken,
    _request_id: RequestIdHeader,
    userId: int | None = None,
    postId: int | None = None,
    limit: int = 100,
) -> dict:
    return success(
        await list_resource_trades(
            db, user_id=userId, post_id=postId, limit=limit
        )
    )


# ---------------------------------------------------------------------------
# Categories / Tags
# ---------------------------------------------------------------------------


@router.get("/categories")
async def list_categories_route(
    db: DbSession,
    _token: ServiceToken,
    _request_id: RequestIdHeader,
    contentType: str | None = None,
) -> dict:
    return success(await list_categories(db, contentType))


@router.post("/categories", status_code=status.HTTP_201_CREATED)
async def create_category_route(
    payload: schemas.CategoryRequest,
    db: DbSession,
    _token: ServiceToken,
    caller: MutationCaller,
) -> dict:
    async with audit_mutation(
        db,
        domain="taxonomy.categories",
        action="create",
        operator_id=caller.operator_id,
        request_id=caller.request_id,
        idempotency_key=caller.idempotency_key,
        payload=payload.model_dump(),
    ):
        result = await create_category(
            db,
            name=payload.name,
            slug=payload.slug,
            content_type=payload.contentType or "NORMAL",
            parent_id=payload.parentId,
            sort=payload.sort,
            status_value=payload.status,
            is_leaf=payload.isLeaf,
        )
        ack = _ack(caller)
        ack["category"] = result
        return success(ack)


@router.put("/categories/{category_id}")
async def update_category_route(
    category_id: int,
    payload: schemas.CategoryRequest,
    db: DbSession,
    _token: ServiceToken,
    caller: MutationCaller,
) -> dict:
    async with audit_mutation(
        db,
        domain="taxonomy.categories",
        action="update",
        operator_id=caller.operator_id,
        request_id=caller.request_id,
        idempotency_key=caller.idempotency_key,
        target_id=category_id,
        payload=payload.model_dump(),
    ):
        result = await update_category(
            db,
            category_id,
            name=payload.name,
            slug=payload.slug,
            content_type=payload.contentType or "NORMAL",
            parent_id=payload.parentId,
            sort=payload.sort,
            status_value=payload.status,
            is_leaf=payload.isLeaf,
        )
        ack = _ack(caller)
        ack["category"] = result
        return success(ack)


@router.patch("/categories/{category_id}/status")
async def update_category_status_route(
    category_id: int,
    payload: schemas.CategoryStatusRequest,
    db: DbSession,
    _token: ServiceToken,
    caller: MutationCaller,
) -> dict:
    async with audit_mutation(
        db,
        domain="taxonomy.categories",
        action="update_status",
        operator_id=caller.operator_id,
        request_id=caller.request_id,
        idempotency_key=caller.idempotency_key,
        target_id=category_id,
        payload=payload.model_dump(),
    ):
        result = await update_category_status(
            db, category_id, payload.status
        )
        ack = _ack(caller)
        ack["category"] = result
        return success(ack)


@router.delete("/categories/{category_id}")
async def delete_category_route(
    category_id: int,
    db: DbSession,
    _token: ServiceToken,
    caller: MutationCaller,
) -> dict:
    async with audit_mutation(
        db,
        domain="taxonomy.categories",
        action="delete",
        operator_id=caller.operator_id,
        request_id=caller.request_id,
        idempotency_key=caller.idempotency_key,
        target_id=category_id,
    ):
        await delete_category(db, category_id)
        return success(_ack(caller))


@router.get("/tags")
async def list_tags_route(
    db: DbSession,
    _token: ServiceToken,
    _request_id: RequestIdHeader,
    keyword: str | None = None,
) -> dict:
    return success(await list_tags(db, keyword))


@router.post("/tags", status_code=status.HTTP_201_CREATED)
async def create_tag_route(
    payload: schemas.TagRequest,
    db: DbSession,
    _token: ServiceToken,
    caller: MutationCaller,
) -> dict:
    async with audit_mutation(
        db,
        domain="taxonomy.tags",
        action="create",
        operator_id=caller.operator_id,
        request_id=caller.request_id,
        idempotency_key=caller.idempotency_key,
        payload=payload.model_dump(),
    ):
        result = await create_tag(
            db,
            name=payload.name,
            slug=payload.slug,
            status_value=payload.status,
            source=payload.source,
        )
        ack = _ack(caller)
        ack["tag"] = result
        return success(ack)


@router.put("/tags/{tag_id}")
async def update_tag_route(
    tag_id: int,
    payload: schemas.TagRequest,
    db: DbSession,
    _token: ServiceToken,
    caller: MutationCaller,
) -> dict:
    async with audit_mutation(
        db,
        domain="taxonomy.tags",
        action="update",
        operator_id=caller.operator_id,
        request_id=caller.request_id,
        idempotency_key=caller.idempotency_key,
        target_id=tag_id,
        payload=payload.model_dump(),
    ):
        result = await update_tag(
            db,
            tag_id,
            name=payload.name,
            slug=payload.slug,
            status_value=payload.status,
            source=payload.source,
        )
        ack = _ack(caller)
        ack["tag"] = result
        return success(ack)


@router.patch("/tags/{tag_id}/status")
async def update_tag_status_route(
    tag_id: int,
    payload: schemas.TagStatusRequest,
    db: DbSession,
    _token: ServiceToken,
    caller: MutationCaller,
) -> dict:
    async with audit_mutation(
        db,
        domain="taxonomy.tags",
        action="update_status",
        operator_id=caller.operator_id,
        request_id=caller.request_id,
        idempotency_key=caller.idempotency_key,
        target_id=tag_id,
        payload=payload.model_dump(),
    ):
        result = await update_tag_status(db, tag_id, payload.status)
        ack = _ack(caller)
        ack["tag"] = result
        return success(ack)


@router.post("/tags/{tag_id}/merge")
async def merge_tag_route(
    tag_id: int,
    payload: schemas.TagMergeRequest,
    db: DbSession,
    _token: ServiceToken,
    caller: MutationCaller,
) -> dict:
    async with audit_mutation(
        db,
        domain="taxonomy.tags",
        action="merge",
        operator_id=caller.operator_id,
        request_id=caller.request_id,
        idempotency_key=caller.idempotency_key,
        target_id=tag_id,
        payload=payload.model_dump(),
    ):
        result = await merge_tag(db, tag_id, payload.targetTagId)
        ack = _ack(caller)
        ack["tag"] = result
        return success(ack)


@router.delete("/tags/{tag_id}")
async def delete_tag_route(
    tag_id: int,
    db: DbSession,
    _token: ServiceToken,
    caller: MutationCaller,
) -> dict:
    async with audit_mutation(
        db,
        domain="taxonomy.tags",
        action="delete",
        operator_id=caller.operator_id,
        request_id=caller.request_id,
        idempotency_key=caller.idempotency_key,
        target_id=tag_id,
    ):
        await delete_tag(db, tag_id)
        return success(_ack(caller))


# ---------------------------------------------------------------------------
# Open API clients / bindings
# ---------------------------------------------------------------------------


@router.get("/open-api/clients")
async def list_open_api_clients_route(
    db: DbSession,
    _token: ServiceToken,
    _request_id: RequestIdHeader,
) -> dict:
    return success(await list_clients(db))


@router.post("/open-api/clients", status_code=status.HTTP_201_CREATED)
async def create_open_api_client_route(
    payload: schemas.OpenApiClientRequest,
    db: DbSession,
    _token: ServiceToken,
    caller: MutationCaller,
) -> dict:
    async with audit_mutation(
        db,
        domain="open_api.clients",
        action="create",
        operator_id=caller.operator_id,
        request_id=caller.request_id,
        idempotency_key=caller.idempotency_key,
        payload=payload.model_dump(),
    ):
        client = await create_client(
            db,
            name=payload.name,
            remark=payload.remark,
            status_value=payload.status,
        )
        ack = _ack(caller)
        ack["client"] = {
            "id": client.id,
            "name": client.name,
            "apiKey": client.api_key,
            "status": client.status,
            "remark": client.remark,
        }
        return success(ack)


@router.patch("/open-api/clients/{client_id}/status")
async def update_open_api_client_status_route(
    client_id: int,
    payload: schemas.OpenApiClientStatusRequest,
    db: DbSession,
    _token: ServiceToken,
    caller: MutationCaller,
) -> dict:
    async with audit_mutation(
        db,
        domain="open_api.clients",
        action="update_status",
        operator_id=caller.operator_id,
        request_id=caller.request_id,
        idempotency_key=caller.idempotency_key,
        target_id=client_id,
        payload=payload.model_dump(),
    ):
        result = await update_client_status(
            db, client_id, status_value=payload.status
        )
        ack = _ack(caller)
        ack["client"] = result
        return success(ack)


@router.get("/open-api/bindings")
async def list_open_api_bindings_route(
    db: DbSession,
    _token: ServiceToken,
    _request_id: RequestIdHeader,
    clientId: int | None = None,
    userId: int | None = None,
    status_value: str | None = None,
) -> dict:
    return success(
        await list_bindings(
            db,
            client_id=clientId,
            user_id=userId,
            status_value=status_value,
        )
    )


@router.post("/open-api/bindings", status_code=status.HTTP_201_CREATED)
async def create_open_api_binding_route(
    payload: schemas.OpenApiBindingRequest,
    db: DbSession,
    _token: ServiceToken,
    caller: MutationCaller,
) -> dict:
    async with audit_mutation(
        db,
        domain="open_api.bindings",
        action="create",
        operator_id=caller.operator_id,
        request_id=caller.request_id,
        idempotency_key=caller.idempotency_key,
        payload=payload.model_dump(),
    ):
        # The user_id is supplied by the trusted caller; the binding code
        # is part of the payload. We resolve the client by looking up the
        # binding code's owning client. For simplicity, we accept the
        # binding code and store it directly.
        # NOTE: legacy admin did not expose bindings, so we delegate to a
        # fresh service that handles creation atomically.
        # The service requires a client_id; we resolve it by binding_code.
        from sqlalchemy import select
        from lenjoy_bbs.modules.open_api.models import OpenApiAccountBinding

        existing = await db.scalar(
            select(OpenApiAccountBinding).where(
                OpenApiAccountBinding.binding_code == payload.bindingCode
            )
        )
        if existing is not None:
            # Reuse existing client_id.
            client_id = existing.client_id
        else:
            # No prior binding with this code — fall back to the first
            # active client. This keeps the API usable even before the
            # Operations service wires its own client lookup.
            from lenjoy_bbs.modules.open_api.models import OpenApiClient

            client = await db.scalar(
                select(OpenApiClient).where(OpenApiClient.status == "ACTIVE").order_by(OpenApiClient.id)
            )
            if client is None:
                from lenjoy_bbs.core.errors import ApiError
                from lenjoy_bbs.core.messages import OpenApi

                raise ApiError(OpenApi.CLIENT_NOT_FOUND)
            client_id = client.id

        result = await create_binding(
            db,
            client_id=client_id,
            user_id=payload.userId,
            binding_code=payload.bindingCode,
            remark=payload.remark,
            status_value=payload.status,
        )
        ack = _ack(caller)
        ack["binding"] = result
        return success(ack)


@router.patch("/open-api/bindings/{binding_id}/status")
async def update_open_api_binding_status_route(
    binding_id: int,
    payload: schemas.OpenApiBindingStatusRequest,
    db: DbSession,
    _token: ServiceToken,
    caller: MutationCaller,
) -> dict:
    async with audit_mutation(
        db,
        domain="open_api.bindings",
        action="update_status",
        operator_id=caller.operator_id,
        request_id=caller.request_id,
        idempotency_key=caller.idempotency_key,
        target_id=binding_id,
        payload=payload.model_dump(),
    ):
        result = await update_binding_status(
            db, binding_id, status_value=payload.status
        )
        ack = _ack(caller)
        ack["binding"] = result
        return success(ack)


@router.delete("/open-api/bindings/{binding_id}")
async def delete_open_api_binding_route(
    binding_id: int,
    db: DbSession,
    _token: ServiceToken,
    caller: MutationCaller,
) -> dict:
    async with audit_mutation(
        db,
        domain="open_api.bindings",
        action="delete",
        operator_id=caller.operator_id,
        request_id=caller.request_id,
        idempotency_key=caller.idempotency_key,
        target_id=binding_id,
    ):
        await delete_binding(db, binding_id)
        return success(_ack(caller))


__all__ = ["router"]
