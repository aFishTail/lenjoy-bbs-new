from lenjoy_bbs.modules.auth.captcha import RedisCaptchaStore
from lenjoy_bbs.modules.posts.engagement import RedisPostViewStore


def test_captcha_redis_keys_use_service_namespace():
    store = object.__new__(RedisCaptchaStore)

    assert store._key("captcha-1") == "lenjoy_bbs:auth:captcha:captcha-1"


def test_post_view_redis_keys_use_service_namespace():
    store = object.__new__(RedisPostViewStore)

    assert store._key(123, "user:456") == "lenjoy_bbs:post:view:123:user:456"
