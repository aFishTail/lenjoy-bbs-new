FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_SYSTEM_PYTHON=1

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock* ./
RUN uv sync --no-dev

COPY alembic.ini ./alembic.ini
COPY migrations ./migrations
COPY lenjoy_bbs ./lenjoy_bbs

EXPOSE 8080
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn lenjoy_bbs.main:app --host 0.0.0.0 --port 8080"]
