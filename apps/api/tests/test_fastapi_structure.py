def test_api_router_is_single_public_aggregation_point():
    from lenjoy_bbs.api import api_router

    assert api_router.prefix == "/api/v1"
    assert "/api/v1/health" in [route.path for route in api_router.routes]


def test_shared_dependency_aliases_are_available():
    from lenjoy_bbs.core.dependencies import AdminUser, CurrentUser, DbSession, OptionalCurrentUser

    assert DbSession is not None
    assert CurrentUser is not None
    assert OptionalCurrentUser is not None
    assert AdminUser is not None


def test_wallet_asset_rules_have_service_entrypoints():
    import inspect

    from lenjoy_bbs.modules.wallet.asset_ledger import apply_admin_adjustment, grant_registration_gift, reserve_bounty_funds, settle_bounty_reward, settle_resource_purchase

    assert inspect.iscoroutinefunction(grant_registration_gift)
    assert inspect.iscoroutinefunction(apply_admin_adjustment)
    assert inspect.iscoroutinefunction(reserve_bounty_funds)
    assert inspect.iscoroutinefunction(settle_bounty_reward)
    assert inspect.iscoroutinefunction(settle_resource_purchase)


def test_post_presenters_are_split_from_application_writes():
    from lenjoy_bbs.modules.posts.bounty_settlement import accept_bounty_answer_settlement
    from lenjoy_bbs.modules.posts.engagement import create_comment, record_post_view
    from lenjoy_bbs.modules.posts.lifecycle import create_post, create_post_for_author_id, delete_post, update_post
    from lenjoy_bbs.modules.posts.lifecycle import create_post_for_author_id
    from lenjoy_bbs.modules.posts.presenters import serialize_comment, serialize_post
    from lenjoy_bbs.modules.posts.resource_trade import purchase_resource_post

    assert serialize_post is not None
    assert serialize_comment is not None
    assert accept_bounty_answer_settlement is not None
    assert record_post_view is not None
    assert create_post_for_author_id is not None
    assert purchase_resource_post is not None
    assert create_post is not None
    assert update_post is not None
    assert delete_post is not None
    assert create_comment is not None
    assert purchase_resource_post is not None


def test_security_helpers_are_split_into_specialized_modules():
    from lenjoy_bbs.core.auth_dependencies import current_user, optional_current_user, require_admin
    from lenjoy_bbs.core.passwords import hash_password, verify_password
    from lenjoy_bbs.core.tokens import create_access_token, decode_access_token, load_role_codes

    assert hash_password is not None
    assert verify_password is not None
    assert create_access_token is not None
    assert decode_access_token is not None
    assert load_role_codes is not None
    assert current_user is not None
    assert optional_current_user is not None
    assert require_admin is not None


def test_open_api_and_users_use_service_entrypoints():
    import inspect

    from lenjoy_bbs.modules.open_api.client_auth import require_active_client
    from lenjoy_bbs.modules.open_api.client_management import create_client, list_clients
    from lenjoy_bbs.modules.open_api.publisher_identity import get_or_create_open_api_user
    from lenjoy_bbs.modules.open_api.publication import create_open_post
    from lenjoy_bbs.modules.users.service import update_profile

    create_client_sig = inspect.signature(create_client)
    create_open_post_sig = inspect.signature(create_open_post)
    update_profile_sig = inspect.signature(update_profile)

    assert inspect.iscoroutinefunction(create_client)
    assert inspect.iscoroutinefunction(create_open_post)
    assert inspect.iscoroutinefunction(list_clients)
    assert inspect.iscoroutinefunction(require_active_client)
    assert inspect.iscoroutinefunction(get_or_create_open_api_user)
    assert inspect.iscoroutinefunction(update_profile)
    assert list(create_client_sig.parameters) == [
        "db", "name", "remark", "status_value"
    ]
    assert list(
        create_open_post_sig.parameters) == ["db", "api_key", "payload"]
    assert list(update_profile_sig.parameters) == ["db", "user", "payload"]


def test_messages_reports_and_admin_users_use_service_entrypoints():
    import inspect

    from lenjoy_bbs.modules.admin.posts.service import offline_post as admin_offline_post, online_post
    from lenjoy_bbs.modules.admin.service import create_category, create_tag, offline_post, update_user_status, update_wallet_coins
    from lenjoy_bbs.modules.admin.taxonomy.service import create_category as admin_create_category
    from lenjoy_bbs.modules.admin.taxonomy.service import create_tag as admin_create_tag
    from lenjoy_bbs.modules.admin.users.service import update_user_status as admin_update_user_status
    from lenjoy_bbs.modules.admin.wallet.service import update_wallet_coins as admin_update_wallet_coins
    from lenjoy_bbs.modules.messages.service import mark_all_messages_read, mark_message_read
    from lenjoy_bbs.modules.reports.service import create_comment_report, create_post_report

    assert inspect.iscoroutinefunction(mark_message_read)
    assert inspect.iscoroutinefunction(mark_all_messages_read)
    assert inspect.iscoroutinefunction(create_post_report)
    assert inspect.iscoroutinefunction(create_comment_report)
    assert inspect.iscoroutinefunction(update_user_status)
    assert inspect.iscoroutinefunction(offline_post)
    assert inspect.iscoroutinefunction(online_post)
    assert inspect.iscoroutinefunction(update_wallet_coins)
    assert inspect.iscoroutinefunction(create_category)
    assert inspect.iscoroutinefunction(create_tag)
    assert update_user_status is admin_update_user_status
    assert offline_post is admin_offline_post
    assert update_wallet_coins is admin_update_wallet_coins
    assert create_category is admin_create_category
    assert create_tag is admin_create_tag


def test_admin_router_aggregates_feature_subpackage_routers():
    from lenjoy_bbs.modules.admin.router import router

    paths = {route.path for route in router.routes}

    assert "/admin/users" in paths
    assert "/admin/posts" in paths
    assert "/admin/coins/users" in paths
    assert "/admin/categories" in paths
    assert "/admin/metrics/dashboard" in paths


def test_module_models_are_co_located_with_domain_code():
    from lenjoy_bbs.db.base import Base, IdType, now_utc
    from lenjoy_bbs.db.model_registry import MODEL_MODULES
    from lenjoy_bbs.modules.messages.models import SiteMessage
    from lenjoy_bbs.modules.open_api.models import OpenApiAccountBinding, OpenApiClient
    from lenjoy_bbs.modules.posts.models import CommentLike, Post, PostComment, PostFavorite, PostLike, PostTag, ResourcePurchase
    from lenjoy_bbs.modules.reports.models import CommentReport, PostReport, ResourceAppeal
    from lenjoy_bbs.modules.taxonomy.models import Category, Tag
    from lenjoy_bbs.modules.users.models import Role, UserAccount, UserFollow, UserRole
    from lenjoy_bbs.modules.wallet.models import Wallet, WalletLedger

    assert Base is not None
    assert IdType is not None
    assert now_utc is not None
    assert MODEL_MODULES
    assert Role is not None
    assert UserAccount is not None
    assert UserRole is not None
    assert UserFollow is not None
    assert Wallet is not None
    assert WalletLedger is not None
    assert Category is not None
    assert Tag is not None
    assert Post is not None
    assert PostTag is not None
    assert PostComment is not None
    assert PostLike is not None
    assert PostFavorite is not None
    assert CommentLike is not None
    assert ResourcePurchase is not None
    assert ResourceAppeal is not None
    assert PostReport is not None
    assert CommentReport is not None
    assert OpenApiClient is not None
    assert OpenApiAccountBinding is not None
    assert SiteMessage is not None


def test_db_compatibility_model_modules_are_removed():
    from pathlib import Path

    db_dir = Path(__file__).resolve().parents[1] / "lenjoy_bbs" / "db"
    removed_modules = {
        "integration_models.py",
        "message_models.py",
        "moderation_models.py",
        "post_models.py",
        "taxonomy_models.py",
        "user_models.py",
        "wallet_models.py",
    }

    assert removed_modules.isdisjoint({path.name for path in db_dir.iterdir()})


def test_domain_seed_data_is_not_defined_in_db_layer():
    from lenjoy_bbs.db.seed import seed_database
    from lenjoy_bbs.modules.taxonomy.seed import seed_taxonomy
    from lenjoy_bbs.modules.users.seed import seed_roles

    assert seed_database is not None
    assert seed_roles is not None
    assert seed_taxonomy is not None


def test_core_routes_declare_response_models():
    from lenjoy_bbs.main import app

    routes_by_path: dict[str, list] = {}
    target_paths = {
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/posts",
        "/api/v1/posts/{post_id}",
        "/api/v1/users/me",
        "/api/v1/users/me/wallet",
    }
    for route in app.routes:
        path = getattr(route, "path", None)
        if path in target_paths:
            routes_by_path.setdefault(path, []).append(route)

    assert any(route.response_model is not None
               for route in routes_by_path["/api/v1/auth/login"])
    assert any(route.response_model is not None
               for route in routes_by_path["/api/v1/auth/register"])
    assert any(route.response_model is not None
               for route in routes_by_path["/api/v1/posts"])
    assert any(route.response_model is not None
               for route in routes_by_path["/api/v1/posts/{post_id}"])
    assert any(route.response_model is not None
               for route in routes_by_path["/api/v1/users/me"])
    assert any(route.response_model is not None
               for route in routes_by_path["/api/v1/users/me/wallet"])
