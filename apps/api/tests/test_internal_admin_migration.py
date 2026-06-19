from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATION = (
    ROOT
    / "migrations"
    / "versions"
    / "20260614_0007_internal_admin_audit_idempotency.py"
)


def test_internal_admin_tables_are_owned_by_alembic() -> None:
    source = MIGRATION.read_text(encoding="utf-8")
    assert '"internal_admin_audit_log"' in source
    assert '"internal_admin_idempotency_record"' in source
    assert '"uq_internal_admin_idempotency_scope_key"' in source
    assert 'down_revision = "20260612_0006"' in source
