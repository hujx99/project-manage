"""AI Vision 解析服务，支持 Anthropic Claude 和 OpenAI 兼容协议（通义千问、豆包、DeepSeek 等）。"""

from __future__ import annotations

import json
import os
from typing import Any

from dotenv import load_dotenv

load_dotenv()

EXTRACTION_PROMPT = """
你是一个合同信息提取助手。请从以下OA系统截图中提取合同信息，严格返回JSON格式：

{
  "contract": {
    "contract_code": "合同编号",
    "contract_name": "合同名称",
    "procurement_type": "采购类型",
    "cost_department": "费用归属责任中心",
    "vendor": "客户单位名称",
    "amount": 数字,
    "amount_before_change": 数字或null,
    "sign_date": "YYYY-MM-DD",
    "filing_date": "YYYY-MM-DD或null",
    "start_date": "YYYY-MM-DD或null",
    "end_date": "YYYY-MM-DD或null",
    "parent_contract_code": "主合同编号或null",
    "renewal_type": "合同续签类型",
    "payment_direction": "支出或收入",
    "status": "合同状态",
    "project_code": "项目编号（如能识别）",
    "project_name": "项目名称（如能识别）"
  },
  "items": [
    {"seq": 1, "item_name": "标的名称", "quantity": 数字, "unit": "个", "unit_price": 数字, "amount": 数字}
  ],
  "payment_plans": [
    {"seq": 1, "phase": "第一期", "planned_date": "YYYY-MM-DD", "planned_amount": 数字, "description": "支付说明"}
  ],
  "changes": [
    {"seq": 1, "change_date": "YYYY-MM-DD", "change_info": "", "before_content": "", "after_content": "", "change_description": ""}
  ]
}

注意：
- 金额统一为数字，不含逗号和人民币符号
- 日期格式 YYYY-MM-DD
- 无法识别的字段填 null
- 仅返回 JSON，不要其他文字
""".strip()


class AIParserError(Exception):
    """AI 解析错误。"""


def _extract_uncertain_fields(data: Any, prefix: str = "") -> list[str]:
    paths: list[str] = []
    if isinstance(data, dict):
        for key, value in data.items():
            path = f"{prefix}.{key}" if prefix else key
            if value is None:
                paths.append(path)
            else:
                paths.extend(_extract_uncertain_fields(value, path))
    elif isinstance(data, list):
        for index, item in enumerate(data):
            path = f"{prefix}[{index}]"
            paths.extend(_extract_uncertain_fields(item, path))
    return paths


def _parse_json_response(raw_text: str) -> dict[str, Any]:
    raw_text = raw_text.strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise AIParserError("AI 返回内容不是合法 JSON") from exc


def _parse_with_anthropic(images_b64: list[str], api_key: str, model: str) -> str:
    from anthropic import Anthropic
    client = Anthropic(api_key=api_key)
    image_contents = [
        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}}
        for b64 in images_b64
    ]
    response = client.messages.create(
        model=model,
        max_tokens=4096,
        messages=[{"role": "user", "content": [*image_contents, {"type": "text", "text": EXTRACTION_PROMPT}]}],
    )
    return "\n".join(block.text for block in response.content if getattr(block, "text", None))


def _parse_with_openai_compatible(images_b64: list[str], api_key: str, base_url: str, model: str) -> str:
    from openai import OpenAI
    client = OpenAI(api_key=api_key, base_url=base_url)
    image_contents: list[dict[str, Any]] = [
        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}}
        for b64 in images_b64
    ]
    response = client.chat.completions.create(
        model=model,
        max_tokens=4096,
        messages=[{"role": "user", "content": [*image_contents, {"type": "text", "text": EXTRACTION_PROMPT}]}],
    )
    return response.choices[0].message.content or ""


def parse_screenshots(
    images_b64: list[str],
    provider: str = "anthropic",
    api_key: str = "",
    base_url: str = "",
    model: str = "",
) -> tuple[dict[str, Any], list[str]]:
    """解析截图，返回结构化数据和不确定字段列表。"""
    if not images_b64:
        raise AIParserError("至少需要一张截图")

    if not api_key and provider == "anthropic":
        api_key = os.getenv("ANTHROPIC_API_KEY", "")

    if not api_key:
        raise AIParserError("未配置 API Key，请在设置页面配置")

    if provider == "anthropic":
        model = model or "claude-sonnet-4-20250514"
        raw_text = _parse_with_anthropic(images_b64, api_key, model)
    else:
        if not base_url:
            raise AIParserError("OpenAI 兼容模式需要填写 API 地址")
        if not model:
            raise AIParserError("请填写模型名称")
        raw_text = _parse_with_openai_compatible(images_b64, api_key, base_url, model)

    parsed = _parse_json_response(raw_text)
    uncertain_fields = _extract_uncertain_fields(parsed)
    return parsed, uncertain_fields
