FROM python:3.12-slim AS runtime

ARG PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
ARG PIP_DEFAULT_TIMEOUT=120
ARG PIP_RETRIES=5
ARG UV_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_SYSTEM_PYTHON=1 \
    UV_INDEX_URL=${UV_INDEX_URL}

WORKDIR /app

RUN pip install --no-cache-dir \
    --index-url "${PIP_INDEX_URL}" \
    --timeout "${PIP_DEFAULT_TIMEOUT}" \
    --retries "${PIP_RETRIES}" \
    uv

COPY pyproject.toml uv.lock* ./
RUN uv sync --no-dev

COPY alembic.ini ./alembic.ini
COPY migrations ./migrations
COPY lenjoy_bbs ./lenjoy_bbs

EXPOSE 8080
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn lenjoy_bbs.main:app --host 0.0.0.0 --port 8080"]
