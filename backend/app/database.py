"""数据库连接与会话管理。"""

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BACKEND_DIR / "data.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

# SQLite 需要关闭同线程检查，便于 FastAPI 多请求共享。
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """获取数据库会话依赖。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
