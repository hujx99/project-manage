"""SQLite 到 PostgreSQL 的迁移脚本。"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import Session, sessionmaker

from backend.app.database import Base, DEFAULT_SQLITE_PATH, LEGACY_DB_PATH
from backend.app.models import Contract, ContractChange, ContractItem, Payment, Project

MODEL_ORDER = [Project, Contract, ContractItem, Payment, ContractChange]

MSG_SOURCE_NOT_FOUND = "\u672a\u627e\u5230 SQLite \u6570\u636e\u5e93\u6587\u4ef6\uff1a{path}"
MSG_TARGET_REQUIRED = "\u8bf7\u901a\u8fc7 --target-url \u6216 DATABASE_URL \u63d0\u4f9b PostgreSQL \u8fde\u63a5\u4e32"
MSG_TARGET_TYPE = "\u76ee\u6807\u6570\u636e\u5e93\u5fc5\u987b\u662f PostgreSQL"
MSG_TARGET_NOT_EMPTY = "\u76ee\u6807 PostgreSQL \u5df2\u6709\u6570\u636e\u3002\u8bf7\u52a0 --overwrite \u540e\u91cd\u8bd5\u3002"
MSG_DONE = "\u8fc1\u79fb\u5b8c\u6210\u3002"


def _default_sqlite_path() -> Path:
    if DEFAULT_SQLITE_PATH.exists():
        return DEFAULT_SQLITE_PATH
    return LEGACY_DB_PATH


def _resolve_source_url(sqlite_path: str | None, source_url: str | None) -> str:
    if source_url:
        return source_url

    path = Path(sqlite_path).expanduser() if sqlite_path else _default_sqlite_path()
    if not path.is_absolute():
        path = path.resolve()

    if not path.exists():
        raise SystemExit(MSG_SOURCE_NOT_FOUND.format(path=path))

    return f"sqlite:///{path}"


def _resolve_target_url(target_url: str | None) -> str:
    resolved = target_url or os.getenv("DATABASE_URL")
    if not resolved:
        raise SystemExit(MSG_TARGET_REQUIRED)
    if not resolved.startswith("postgresql"):
        raise SystemExit(MSG_TARGET_TYPE)
    return resolved


def _clone_rows(source_session: Session, target_session: Session) -> None:
    for model in MODEL_ORDER:
        rows = source_session.execute(select(model)).scalars().all()
        for row in rows:
            payload = {column.name: getattr(row, column.name) for column in model.__table__.columns}
            target_session.add(model(**payload))
        target_session.flush()


def _clear_target_data(target_session: Session) -> None:
    for model in reversed(MODEL_ORDER):
        target_session.query(model).delete()
    target_session.flush()


def _sync_postgres_sequences(target_session: Session) -> None:
    for model in MODEL_ORDER:
        table_name = model.__tablename__
        max_id = target_session.execute(select(func.max(model.id))).scalar() or 1
        target_session.execute(
            text(
                """
                SELECT setval(
                    pg_get_serial_sequence(:table_name, 'id'),
                    :max_id,
                    true
                )
                """
            ),
            {"table_name": table_name, "max_id": max_id},
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="SQLite \u6570\u636e\u8fc1\u79fb\u5230 PostgreSQL"
    )
    parser.add_argument("--sqlite-path", help="SQLite \u6570\u636e\u6587\u4ef6\u8def\u5f84")
    parser.add_argument("--source-url", help="\u81ea\u5b9a\u4e49\u6e90\u6570\u636e\u5e93\u8fde\u63a5\u4e32")
    parser.add_argument("--target-url", help="PostgreSQL \u8fde\u63a5\u4e32\uff0c\u9ed8\u8ba4\u8bfb\u53d6 DATABASE_URL")
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="\u76ee\u6807\u5e93\u6709\u6570\u636e\u65f6\u5148\u6e05\u7a7a\u518d\u5bfc\u5165",
    )
    args = parser.parse_args()

    source_url = _resolve_source_url(args.sqlite_path, args.source_url)
    target_url = _resolve_target_url(args.target_url)

    source_engine = create_engine(source_url)
    target_engine = create_engine(target_url)
    Base.metadata.create_all(bind=target_engine)

    SourceSession = sessionmaker(bind=source_engine, autoflush=False, autocommit=False)
    TargetSession = sessionmaker(bind=target_engine, autoflush=False, autocommit=False)

    with SourceSession() as source_session, TargetSession() as target_session:
        existing_count = target_session.query(Project).count()
        if existing_count and not args.overwrite:
            raise SystemExit(MSG_TARGET_NOT_EMPTY)

        if args.overwrite:
            _clear_target_data(target_session)

        _clone_rows(source_session, target_session)
        _sync_postgres_sequences(target_session)
        target_session.commit()

        print(MSG_DONE)
        for model in MODEL_ORDER:
            count = target_session.query(model).count()
            print(f"{model.__tablename__}: {count}")


if __name__ == "__main__":
    main()
