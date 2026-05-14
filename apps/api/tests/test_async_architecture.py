import inspect

from sqlalchemy.ext.asyncio import AsyncSession


def test_database_dependency_uses_async_session():
    from lenjoy_bbs.db.session import SessionLocal, get_db

    assert SessionLocal.class_ is AsyncSession
    assert inspect.isasyncgenfunction(get_db)


def test_auth_use_cases_are_async_and_live_in_service_layer():
    from lenjoy_bbs.modules.auth.service import login_user, register_user

    assert inspect.iscoroutinefunction(register_user)
    assert inspect.iscoroutinefunction(login_user)


def test_post_use_cases_are_async_and_live_in_service_layer():
    from lenjoy_bbs.modules.posts.service import create_comment, create_post, delete_post, purchase_post, update_post

    assert inspect.iscoroutinefunction(create_post)
    assert inspect.iscoroutinefunction(update_post)
    assert inspect.iscoroutinefunction(delete_post)
    assert inspect.iscoroutinefunction(create_comment)
    assert inspect.iscoroutinefunction(purchase_post)
