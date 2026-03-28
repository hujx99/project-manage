"""数据库连接与会话管理。"""

import os
import shutil
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = Path(__file__).resolve().parents[1]
LEGACY_DB_PATH = BACKEND_DIR / "data.db"
DEFAULT_DB_PATH = PROJECT_ROOT / ".local" / "project-manage.db"


def _resolve_database_url() -> tuple[str, Path | None]:
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url, None

    configured_path = os.getenv("SQLITE_DB_PATH")
    db_path = Path(configured_path).expanduser() if configured_path else DEFAULT_DB_PATH
    if not db_path.is_absolute():
        db_path = (PROJECT_ROOT / db_path).resolve()

    # 首次切换到新默认路径时，把旧库复制到受 Git 忽略的位置，避免数据“丢失”。
    if not db_path.exists() and LEGACY_DB_PATH.exists() and db_path != LEGACY_DB_PATH:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(LEGACY_DB_PATH, db_path)

    db_path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{db_path}", db_path


DATABASE_URL, DB_PATH = _resolve_database_url()

# SQLite 需要关闭同线程检查，便于 FastAPI 多请求共享。
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
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
