from __future__ import annotations

import ast
from pathlib import Path
from typing import Iterable

API_ROOT = Path(__file__).resolve().parents[1]
ROUTER_FILES = [
    API_ROOT / "lenjoy_bbs/modules/auth/router.py",
    API_ROOT / "lenjoy_bbs/modules/messages/router.py",
    API_ROOT / "lenjoy_bbs/modules/posts/router.py",
    API_ROOT / "lenjoy_bbs/modules/reports/router.py",
    API_ROOT / "lenjoy_bbs/modules/users/router.py",
    API_ROOT / "lenjoy_bbs/modules/wallet/router.py",
    API_ROOT / "lenjoy_bbs/modules/open_api/router.py",
    API_ROOT / "lenjoy_bbs/modules/admin/users/router.py",
    API_ROOT / "lenjoy_bbs/modules/admin/posts/router.py",
    API_ROOT / "lenjoy_bbs/modules/admin/wallet/router.py",
    API_ROOT / "lenjoy_bbs/modules/admin/taxonomy/router.py",
    API_ROOT / "lenjoy_bbs/modules/admin/metrics/router.py",
]


def _load_ast(path: Path) -> ast.AST:
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def _iter_attribute_calls(tree: ast.AST,
                          method_names: set[str]) -> Iterable[tuple[str, int]]:
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(
                node.func, ast.Attribute) and node.func.attr in method_names:
            base_path = _attribute_path(node.func.value)
            if base_path is not None:
                yield base_path, node.lineno


def _attribute_path(node: ast.AST) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        base_path = _attribute_path(node.value)
        if base_path is not None:
            return f"{base_path}.{node.attr}"
    return None


def _iter_import_froms(tree: ast.AST) -> Iterable[str]:
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            yield "." * node.level + (node.module or "")


def _iter_awaited_name_calls(tree: ast.AST) -> Iterable[tuple[str, int]]:
    for node in ast.walk(tree):
        if isinstance(node, ast.Await) and isinstance(
                node.value, ast.Call) and isinstance(node.value.func,
                                                     ast.Name):
            yield node.value.func.id, node.lineno


def test_selected_routers_do_not_call_commit_or_rollback_directly():
    for path in ROUTER_FILES:
        tree = _load_ast(path)
        direct_calls = list(_iter_attribute_calls(tree,
                                                  {"commit", "rollback"}))

        assert direct_calls == []


def test_attribute_call_helper_detects_nested_session_methods():
    tree = ast.parse("""
async def handler(ctx, self):
    await ctx.db.commit()
    await self.session.rollback()
""")

    assert list(_iter_attribute_calls(tree, {"commit", "rollback"})) == [
        ("ctx.db", 3),
        ("self.session", 4),
    ]


def test_wallet_router_does_not_commit():
    content = (API_ROOT / "lenjoy_bbs/modules/wallet/router.py").read_text(
        encoding="utf-8")

    assert ".commit(" not in content


def test_wallet_router_does_not_use_ensure_wallet():
    content = (API_ROOT / "lenjoy_bbs/modules/wallet/router.py").read_text(
        encoding="utf-8")

    assert "ensure_wallet" not in content


def test_files_router_imports_infrastructure_storage_adapter():
    tree = _load_ast(API_ROOT / "lenjoy_bbs/modules/files/router.py")
    imports = set(_iter_import_froms(tree))

    assert "lenjoy_bbs.infrastructure.storage.image_storage" in imports
    assert "lenjoy_bbs.modules.files.storage" not in imports


def test_open_api_and_users_have_service_entrypoints():
    import inspect

    from lenjoy_bbs.modules.open_api.client_management import create_client
    from lenjoy_bbs.modules.open_api.publication import create_open_post
    from lenjoy_bbs.modules.users.service import update_profile

    assert inspect.iscoroutinefunction(create_client)
    assert inspect.iscoroutinefunction(create_open_post)
    assert inspect.iscoroutinefunction(update_profile)


def test_users_router_delegates_profile_writes_to_service():
    tree = _load_ast(API_ROOT / "lenjoy_bbs/modules/users/router.py")
    imports = set(_iter_import_froms(tree))
    awaited_calls = {name for name, _ in _iter_awaited_name_calls(tree)}
    direct_calls = list(
        _iter_attribute_calls(tree, {"commit", "rollback", "flush"}))

    assert "lenjoy_bbs.modules.users.service" in imports
    assert "update_profile" in awaited_calls
    assert direct_calls == []


def test_open_api_router_delegates_writes_to_service():
    tree = _load_ast(API_ROOT / "lenjoy_bbs/modules/open_api/router.py")
    imports = set(_iter_import_froms(tree))
    awaited_calls = {name for name, _ in _iter_awaited_name_calls(tree)}
    direct_calls = list(
        _iter_attribute_calls(tree, {"commit", "rollback", "flush"}))

    assert "lenjoy_bbs.modules.open_api.client_management" in imports
    assert "lenjoy_bbs.modules.open_api.publication" in imports
    assert "create_client" in awaited_calls
    assert "create_open_post" in awaited_calls
    assert direct_calls == []


def test_open_api_router_uses_service_for_client_reads():
    tree = _load_ast(API_ROOT / "lenjoy_bbs/modules/open_api/router.py")
    imports = set(_iter_import_froms(tree))
    awaited_calls = {name for name, _ in _iter_awaited_name_calls(tree)}

    assert "lenjoy_bbs.modules.open_api.client_management" in imports
    assert "list_clients" in awaited_calls


def test_open_api_publication_delegates_auth_and_identity_resolution():
    tree = _load_ast(API_ROOT / "lenjoy_bbs/modules/open_api/publication.py")
    imports = set(_iter_import_froms(tree))
    awaited_calls = {name for name, _ in _iter_awaited_name_calls(tree)}

    assert "lenjoy_bbs.modules.open_api.client_auth" in imports
    assert "lenjoy_bbs.modules.open_api.publisher_identity" in imports
    assert "require_active_client" in awaited_calls
    assert "get_or_create_open_api_user" in awaited_calls


def test_auth_router_delegates_writes_to_service():
    tree = _load_ast(API_ROOT / "lenjoy_bbs/modules/auth/router.py")
    imports = set(_iter_import_froms(tree))
    awaited_calls = {name for name, _ in _iter_awaited_name_calls(tree)}
    direct_calls = list(
        _iter_attribute_calls(tree, {"commit", "rollback", "flush"}))

    assert "lenjoy_bbs.modules.auth.service" in imports
    assert "register_user" in awaited_calls
    assert "login_user" in awaited_calls
    assert direct_calls == []


def test_auth_service_delegates_registration_asset_rules_to_asset_ledger():
    tree = _load_ast(API_ROOT / "lenjoy_bbs/modules/auth/service.py")
    imports = set(_iter_import_froms(tree))
    awaited_calls = {name for name, _ in _iter_awaited_name_calls(tree)}

    assert "lenjoy_bbs.modules.wallet.asset_ledger" in imports
    assert "lenjoy_bbs.modules.wallet.service" not in imports
    assert "grant_registration_gift" in awaited_calls


def test_posts_lifecycle_delegates_bounty_reserve_to_asset_ledger():
    tree = _load_ast(API_ROOT / "lenjoy_bbs/modules/posts/lifecycle.py")
    imports = set(_iter_import_froms(tree))
    awaited_calls = {name for name, _ in _iter_awaited_name_calls(tree)}

    assert "lenjoy_bbs.modules.wallet.asset_ledger" in imports
    assert "lenjoy_bbs.modules.wallet.service" not in imports
    assert "reserve_bounty_funds" in awaited_calls


def test_resource_trade_delegates_wallet_rules_to_asset_ledger():
    tree = _load_ast(API_ROOT / "lenjoy_bbs/modules/posts/resource_trade.py")
    imports = set(_iter_import_froms(tree))
    awaited_calls = {name for name, _ in _iter_awaited_name_calls(tree)}

    assert "lenjoy_bbs.modules.wallet.asset_ledger" in imports
    assert "lenjoy_bbs.modules.wallet.service" not in imports
    assert "settle_resource_purchase" in awaited_calls


def test_posts_router_delegates_writes_to_service():
    tree = _load_ast(API_ROOT / "lenjoy_bbs/modules/posts/router.py")
    imports = set(_iter_import_froms(tree))
    awaited_calls = {name for name, _ in _iter_awaited_name_calls(tree)}
    direct_calls = list(
        _iter_attribute_calls(tree, {"commit", "rollback", "flush"}))

    assert "lenjoy_bbs.modules.posts.lifecycle" in imports
    assert "lenjoy_bbs.modules.posts.engagement" in imports
    assert "lenjoy_bbs.modules.posts.resource_trade" in imports
    assert "lenjoy_bbs.modules.posts.bounty_settlement" in imports
    assert {
        "create_post", "update_post", "delete_post", "create_comment",
        "purchase_resource_post", "accept_bounty_answer_settlement",
        "toggle_post_like", "toggle_post_favorite", "record_post_view"
    }.issubset(awaited_calls)
    assert direct_calls == []


def test_posts_router_delegates_reads_to_read_service():
    tree = _load_ast(API_ROOT / "lenjoy_bbs/modules/posts/router.py")
    imports = set(_iter_import_froms(tree))
    awaited_calls = {name for name, _ in _iter_awaited_name_calls(tree)}

    assert "lenjoy_bbs.modules.posts.read_service" in imports
    assert {
        "list_posts_feed", "list_my_posts_feed", "read_post_detail",
        "read_post_comments"
    }.issubset(awaited_calls)


def test_messages_router_delegates_writes_to_service():
    tree = _load_ast(API_ROOT / "lenjoy_bbs/modules/messages/router.py")
    imports = set(_iter_import_froms(tree))
    awaited_calls = {name for name, _ in _iter_awaited_name_calls(tree)}
    direct_calls = list(
        _iter_attribute_calls(tree, {"commit", "rollback", "flush"}))

    assert "lenjoy_bbs.modules.messages.service" in imports
    assert {"mark_message_read",
            "mark_all_messages_read"}.issubset(awaited_calls)
    assert direct_calls == []


def test_reports_router_delegates_writes_to_service():
    tree = _load_ast(API_ROOT / "lenjoy_bbs/modules/reports/router.py")
    imports = set(_iter_import_froms(tree))
    awaited_calls = {name for name, _ in _iter_awaited_name_calls(tree)}
    direct_calls = list(
        _iter_attribute_calls(tree, {"commit", "rollback", "flush"}))

    assert "lenjoy_bbs.modules.reports.service" in imports
    assert {"create_post_report",
            "create_comment_report"}.issubset(awaited_calls)
    assert direct_calls == []


def test_admin_users_router_delegates_writes_to_service():
    tree = _load_ast(API_ROOT / "lenjoy_bbs/modules/admin/users/router.py")
    imports = set(_iter_import_froms(tree))
    awaited_calls = {name for name, _ in _iter_awaited_name_calls(tree)}
    direct_calls = list(
        _iter_attribute_calls(tree, {"commit", "rollback", "flush"}))

    assert "lenjoy_bbs.modules.admin.users.service" in imports
    assert "update_user_status" in awaited_calls
    assert direct_calls == []


def test_admin_posts_router_delegates_writes_to_service():
    tree = _load_ast(API_ROOT / "lenjoy_bbs/modules/admin/posts/router.py")
    imports = set(_iter_import_froms(tree))
    awaited_calls = {name for name, _ in _iter_awaited_name_calls(tree)}
    direct_calls = list(
        _iter_attribute_calls(tree, {"commit", "rollback", "flush"}))

    assert "lenjoy_bbs.modules.admin.posts.service" in imports
    assert {"offline_post", "online_post"}.issubset(awaited_calls)
    assert direct_calls == []


def test_admin_wallet_router_delegates_writes_to_service():
    tree = _load_ast(API_ROOT / "lenjoy_bbs/modules/admin/wallet/router.py")
    imports = set(_iter_import_froms(tree))
    awaited_calls = {name for name, _ in _iter_awaited_name_calls(tree)}
    direct_calls = list(
        _iter_attribute_calls(tree, {"commit", "rollback", "flush"}))

    assert "lenjoy_bbs.modules.admin.wallet.service" in imports
    assert "update_wallet_coins" in awaited_calls
    assert direct_calls == []


def test_admin_wallet_service_delegates_adjustment_rules_to_asset_ledger():
    tree = _load_ast(API_ROOT / "lenjoy_bbs/modules/admin/wallet/service.py")
    imports = set(_iter_import_froms(tree))
    awaited_calls = {name for name, _ in _iter_awaited_name_calls(tree)}

    assert "lenjoy_bbs.modules.wallet.asset_ledger" in imports
    assert "lenjoy_bbs.modules.wallet.service" not in imports
    assert "apply_admin_adjustment" in awaited_calls


def test_bounty_settlement_delegates_wallet_rules_to_asset_ledger():
    tree = _load_ast(API_ROOT /
                     "lenjoy_bbs/modules/posts/bounty_settlement.py")
    imports = set(_iter_import_froms(tree))
    awaited_calls = {name for name, _ in _iter_awaited_name_calls(tree)}

    assert "lenjoy_bbs.modules.wallet.asset_ledger" in imports
    assert "lenjoy_bbs.modules.wallet.service" not in imports
    assert "settle_bounty_reward" in awaited_calls


def test_admin_taxonomy_router_delegates_writes_to_service():
    tree = _load_ast(API_ROOT / "lenjoy_bbs/modules/admin/taxonomy/router.py")
    imports = set(_iter_import_froms(tree))
    awaited_calls = {name for name, _ in _iter_awaited_name_calls(tree)}
    direct_calls = list(
        _iter_attribute_calls(tree, {"commit", "rollback", "flush"}))

    assert "lenjoy_bbs.modules.admin.taxonomy.service" in imports
    assert {"create_category", "create_tag"}.issubset(awaited_calls)
    assert direct_calls == []
