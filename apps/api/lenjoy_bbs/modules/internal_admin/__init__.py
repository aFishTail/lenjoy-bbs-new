"""Internal admin API exposed to the Operations service.

Routes live under ``/api/internal/v1/admin/*`` and are authenticated with
``X-Service-Token`` plus trusted ``X-Operator-Id`` / ``Idempotency-Key``
on mutations. BBS user JWTs are explicitly rejected.
"""
