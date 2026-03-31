"""AI 配置设置路由。"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/settings", tags=["设置"])

SETTINGS_PATH = Path(os.getenv("SETTINGS_PATH", ".local/settings.json"))


class AISettings(BaseModel):
    provider: str = "anthropic"       # anthropic | openai_compatible
    api_key: str = ""
    base_url: str = ""                # OpenAI 兼容模式下的 API 地址
    model: str = ""


def _load() -> dict[str, Any]:
    if SETTINGS_PATH.exists():
        try:
            return json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _save(data: dict[str, Any]) -> None:
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


@router.get("/ai", response_model=AISettings)
def get_ai_settings():
    """获取 AI 配置（API Key 脱敏返回）。"""
    data = _load().get("ai", {})
    settings = AISettings(**data)
    # 脱敏：只返回末尾 4 位
    if settings.api_key:
        settings.api_key = "****" + settings.api_key[-4:]
    return settings


@router.put("/ai", response_model=AISettings)
def update_ai_settings(body: AISettings):
    """保存 AI 配置。若 api_key 全是 * 则保留原来的值。"""
    data = _load()
    existing = data.get("ai", {})

    # 前端未改动密钥时会回传脱敏值，此时保留原始值
    if body.api_key.startswith("****"):
        body.api_key = existing.get("api_key", "")

    data["ai"] = body.model_dump()
    _save(data)

    result = AISettings(**data["ai"])
    if result.api_key:
        result.api_key = "****" + result.api_key[-4:]
    return result
