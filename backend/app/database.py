"""数据库连接与会话管理。"""

from __future__ import annotations

import os
import shutil
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = Path(__file__).resolve().parents[1]
LEGACY_DB_PATH = BACKEND_DIR / "data.db"
DEFAULT_SQLITE_PATH = PROJECT_ROOT / ".local" / "project-manage.db"


def _build_postgres_url_from_env() -> str | None:
    """从环境变量拼接 PostgreSQL 连接串。"""
    host = os.getenv("POSTGRES_HOST")
    database = os.getenv("POSTGRES_DB")
    username = os.getenv("POSTGRES_USER")
    password = os.getenv("POSTGRES_PASSWORD")
    port = os.getenv("POSTGRES_PORT", "5432")

    if not all([host, database, username, password]):
        return None

    return f"postgresql+psycopg2://{username}:{password}@{host}:{port}/{database}"


def _resolve_sqlite_url() -> tuple[str, Path]:
    """解析 SQLite 数据库路径。"""
    configured_path = os.getenv("SQLITE_DB_PATH")
    db_path = Path(configured_path).expanduser() if configured_path else DEFAULT_SQLITE_PATH
    if not db_path.is_absolute():
        db_path = (PROJECT_ROOT / db_path).resolve()

    if not db_path.exists() and LEGACY_DB_PATH.exists() and db_path != LEGACY_DB_PATH:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(LEGACY_DB_PATH, db_path)

    db_path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{db_path}", db_path


def _resolve_database_url() -> tuple[str, Path | None]:
    """优先使用 PostgreSQL，其次读取 SQLite。"""
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url, None

    postgres_url = _build_postgres_url_from_env()
    if postgres_url:
        return postgres_url, None

    sqlite_url, sqlite_path = _resolve_sqlite_url()
    return sqlite_url, sqlite_path


DATABASE_URL, DB_PATH = _resolve_database_url()

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    pool_pre_ping=not DATABASE_URL.startswith("sqlite"),
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """获取数据库会话依赖。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
