FROM python:3.12-slim

WORKDIR /app

# System deps for curl-cffi (needs libcurl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir -e .

COPY ingestion/ ./ingestion/

# Backend models are mounted at /backend via docker-compose volume
ENV PYTHONPATH="/app:/backend"

CMD ["python", "-m", "ingestion.main"]
