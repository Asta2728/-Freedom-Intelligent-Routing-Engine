# FIRE Project Development Guide

This guide provides basic information for setting up and running the FIRE backend project using `uv`.

## 🚀 Environment Setup

The project uses `uv` for lightning-fast Python package management.

### Installation
If you don't have `uv` installed, run:
```powershell
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### Dependency Installation
From the `backend` directory:
```bash
uv sync
```

## 🛠️ Running the Project

### Start the API Server
The main FastAPI application:
```bash
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 🐞 Debug & Troubleshooting
If you encounter errors that are not showing up in the console, use the debug runner:
```bash
uv run python debug_run.py
```
This forces:
- `--log-level debug`
- `--reload-exclude .venv` (Fixes infinite reload loops)
- Explicit application logging initialization

### Start the Task IQ Worker
Necessary for background ingestion and FIRE pipeline processing:
```bash
uv run taskiq worker app.worker.taskiq_app:broker -w 1
```

## 🗄️ Database Management

### Migrations
Apply database schema changes (Alembic):
```bash
# Note: Ensure DB connection is available
uv run alembic upgrade head
```

### Seeding Data
Populate the database with initial required data (Business Units, Managers):
```bash
uv run python -m app.db.seed
```
*(Note: Ensure the seed script path is correct for your environment)*

## 🤖 AI Agent Interactions

- **WebSocket**: `ws://localhost:8000/api/v1/agent/ws/agent`
- **Streaming Chat**: `POST /api/v1/agent/chat` (Returns SSE stream)

---
*Refer to `main-despiction.md` for full project requirements.*
