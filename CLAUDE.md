# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project-Contract-Payment Management System (项目-合同-付款管理系统). FastAPI backend + React TypeScript frontend + PostgreSQL database (SQLite fallback for local dev). All UI text and API messages are in Chinese.

## Build & Run Commands

### Docker (recommended — uses PostgreSQL)
```bash
docker compose up --build
# Frontend: http://localhost, Backend API: http://localhost:8000, Swagger: http://localhost:8000/docs
```

### Local Development
```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend
cd frontend && npm install && npm run dev
```

### Frontend Build
```bash
cd frontend
npm run build      # TypeScript check + Vite build
npm run preview    # Preview production build
```

### SQLite → PostgreSQL Migration
```bash
python scripts/migrate_sqlite_to_postgres.py \
  --sqlite-path .local/project-manage.db \
  --target-url postgresql+psycopg2://user:pass@localhost/db \
  --overwrite
```

No linter is configured. E2E tests use Playwright (`frontend/playwright.config.ts`).

## Architecture

### Backend (`backend/app/`)
- **main.py** — FastAPI app with CORS (allows localhost + LAN IPs via regex), global error handlers, auto-creates DB tables on startup
- **models.py** — SQLAlchemy ORM: Project → Contract → ContractItem/Payment/ContractChange (one-to-many cascade)
- **schemas.py** — Pydantic v2 validation schemas for all entities
- **database.py** — Supports PostgreSQL and SQLite. URL resolution order: `DATABASE_URL` env → `POSTGRES_*` env vars → `SQLITE_DB_PATH` env → `.local/project-manage.db` → legacy `backend/data.db`
- **routers/** — REST endpoints under `/api`: projects, contracts, payments, dashboard, imports, exports
- **services/ai_parser.py** — Claude Vision API (`claude-sonnet-4`) for OCR extraction from screenshots

### Frontend (`frontend/src/`)
- **React 18 + TypeScript + Ant Design 5** (Chinese locale zh_CN)
- **Vite** for bundling, React Router v6 for routing
- **api/client.ts** — Axios instance; base URL is `http://localhost:8000/api` in dev (`import.meta.env.DEV`), `/api` in prod
- **services/** — thin API wrappers over axios (projects.ts, contracts.ts, payments.ts, dashboard.ts)
- **pages/** — DashboardPage, ProjectsPage, ProjectDetailPage, ContractsPage, ContractDetailPage, PaymentsPage, ImportsPage

### Deployment
- Frontend Dockerfile: multi-stage Node 20 build → Nginx 1.27 serving static + reverse proxy `/api` to backend
- Backend Dockerfile: Python 3.11 slim + uvicorn
- Docker Compose includes a `postgres:16-alpine` service; backend depends on it being healthy

## Environment Configuration

Copy `.env.example` to `.env`. Key variables:
- `ANTHROPIC_API_KEY` — required for AI screenshot parsing
- `DATABASE_URL` — full SQLAlchemy URL; overrides all other DB settings
- `POSTGRES_HOST/DB/USER/PASSWORD` — used to construct PostgreSQL URL if `DATABASE_URL` is not set
- `SQLITE_DB_PATH` — SQLite fallback path (default: `.local/project-manage.db`)
- `DOCKER_DATABASE_URL` — used inside Docker Compose (points to `postgres` service hostname)

## Key Conventions

- All monetary values use DECIMAL(14, 2)
- Dates in ISO format (YYYY-MM-DD)
- `project_code` and `contract_code` are unique at DB level
- Payment `pending_amount` = `planned_amount - actual_amount`, auto-calculated server-side on PUT
- API errors return `{"message": "..."}`, validation errors include `"errors"` array
- Projects endpoint supports pagination (`page`, `page_size`), sorting, and search query params
- Contract creation accepts nested items and payments in a single POST
- Contract detail/create responses may include a `warnings` array (e.g., item sum ≠ contract amount, paid total > contract amount)
- FK relationships use RESTRICT: deleting a Project with contracts, or a Contract with payments/items, returns a 400 error
- `services/ai_parser.py` uses model `claude-sonnet-4` for screenshot OCR
