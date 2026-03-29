from __future__ import annotations

import importlib
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


def _purge_backend_modules() -> None:
    for name in list(sys.modules):
        if name == "backend.app" or name.startswith("backend.app."):
            sys.modules.pop(name, None)


@pytest.fixture()
def client(tmp_path: Path) -> TestClient:
    db_path = tmp_path / "test.db"
    os.environ["SQLITE_DB_PATH"] = str(db_path)

    _purge_backend_modules()
    main_module = importlib.import_module("backend.app.main")

    with TestClient(main_module.app) as test_client:
        yield test_client

    _purge_backend_modules()
