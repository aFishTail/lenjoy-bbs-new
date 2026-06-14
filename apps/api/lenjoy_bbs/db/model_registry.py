from lenjoy_bbs.db.base import Base
from lenjoy_bbs.modules.internal_admin import models as internal_admin_models
from lenjoy_bbs.modules.messages import models as message_models
from lenjoy_bbs.modules.open_api import models as open_api_models
from lenjoy_bbs.modules.posts import models as post_models
from lenjoy_bbs.modules.reports import models as report_models
from lenjoy_bbs.modules.taxonomy import models as taxonomy_models
from lenjoy_bbs.modules.users import models as user_models
from lenjoy_bbs.modules.wallet import models as wallet_models

MODEL_MODULES = (
    user_models,
    wallet_models,
    taxonomy_models,
    post_models,
    report_models,
    open_api_models,
    message_models,
    internal_admin_models,
)

__all__ = ["Base", "MODEL_MODULES"]
