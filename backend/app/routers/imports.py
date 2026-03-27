"""AI 截图识别导入路由。"""

from __future__ import annotations

import base64
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..services.ai_parser import AIParserError, parse_screenshots

router = APIRouter(prefix="/api/import", tags=["导入"])


def _to_decimal(value: Any) -> Decimal | None:
    """将输入值转换为 Decimal。"""
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except InvalidOperation as exc:
        raise HTTPException(status_code=400, detail="金额字段格式不正确") from exc


def _build_pending_amount(planned_amount: Decimal | None, actual_amount: Decimal | None) -> Decimal | None:
    """计算待付款金额。"""
    if planned_amount is None and actual_amount is None:
        return None
    return (planned_amount or Decimal("0")) - (actual_amount or Decimal("0"))


def _to_date(value: Any) -> date | None:
    """将输入值转换为日期。"""
    if value in (None, ""):
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="日期字段格式应为 YYYY-MM-DD") from exc


def _normalize_project_info(contract_data: dict[str, Any]) -> tuple[str, str]:
    """规范化项目编号和项目名称。"""
    project_code = (contract_data.get("project_code") or "").strip()
    project_name = (contract_data.get("project_name") or "").strip()

    if not project_code and not project_name:
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        project_code = f"AI-{timestamp}"
        project_name = f"AI导入项目-{timestamp}"
    elif not project_code:
        project_code = f"AI-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    elif not project_name:
        project_name = project_code

    return project_code, project_name


def _get_or_create_project(contract_data: dict[str, Any], db: Session) -> models.Project:
    """通过项目编号查找项目，不存在时自动创建。"""
    project_code, project_name = _normalize_project_info(contract_data)

    project = db.query(models.Project).filter(models.Project.project_code == project_code).first()
    if project:
        if not project.project_name and project_name:
            project.project_name = project_name
        return project

    project = models.Project(
        project_code=project_code,
        project_name=project_name,
        status="立项",
    )
    db.add(project)
    db.flush()
    return project


@router.post("/screenshot", response_model=schemas.AIScreenshotParseResponse)
async def import_from_screenshot(files: list[UploadFile] = File(...)):
    """上传多张截图并调用 Claude Vision 解析。"""
    if not files:
        raise HTTPException(status_code=400, detail="请至少上传一张截图")

    images_b64: list[str] = []
    for file in files:
        content = await file.read()
        if content:
            images_b64.append(base64.b64encode(content).decode("utf-8"))

    if not images_b64:
        raise HTTPException(status_code=400, detail="上传的截图内容为空")

    try:
        parsed_data, uncertain_fields = parse_screenshots(images_b64)
    except AIParserError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"AI 识别失败：{exc}") from exc

    return schemas.AIScreenshotParseResponse(parsed_data=parsed_data, uncertain_fields=uncertain_fields)


@router.post("/screenshot/confirm")
def confirm_screenshot_import(payload: schemas.AIScreenshotConfirmRequest, db: Session = Depends(get_db)):
    """确认识别结果并写入数据库。"""
    parsed_data = payload.parsed_data
    contract_data = parsed_data.get("contract") or {}
    items = parsed_data.get("items") or []
    payment_plans = parsed_data.get("payment_plans") or []
    changes = parsed_data.get("changes") or []

    contract_code = (contract_data.get("contract_code") or "").strip()
    contract_name = (contract_data.get("contract_name") or "").strip()
    status = (contract_data.get("status") or "").strip()

    if not contract_code:
        raise HTTPException(status_code=400, detail="合同编号不能为空")
    if not contract_name:
        raise HTTPException(status_code=400, detail="合同名称不能为空")
    if not status:
        raise HTTPException(status_code=400, detail="合同状态不能为空")
    if _to_decimal(contract_data.get("amount")) is None:
        raise HTTPException(status_code=400, detail="合同金额不能为空")

    existing_contract = db.query(models.Contract).filter(models.Contract.contract_code == contract_code).first()
    if existing_contract:
        raise HTTPException(status_code=400, detail="合同编号已存在，请修改后再导入")

    project = _get_or_create_project(contract_data, db)

    contract = models.Contract(
        project_id=project.id,
        contract_code=contract_code,
        contract_name=contract_name,
        procurement_type=contract_data.get("procurement_type"),
        cost_department=contract_data.get("cost_department"),
        vendor=contract_data.get("vendor"),
        amount=_to_decimal(contract_data.get("amount")),
        amount_before_change=_to_decimal(contract_data.get("amount_before_change")),
        sign_date=_to_date(contract_data.get("sign_date")),
        filing_date=_to_date(contract_data.get("filing_date")),
        start_date=_to_date(contract_data.get("start_date")),
        end_date=_to_date(contract_data.get("end_date")),
        parent_contract_code=contract_data.get("parent_contract_code"),
        renewal_type=contract_data.get("renewal_type"),
        payment_direction=contract_data.get("payment_direction"),
        status=status,
        filing_reference=contract_data.get("filing_reference"),
        remark=contract_data.get("remark"),
    )
    db.add(contract)
    db.flush()

    for index, item in enumerate(items, start=1):
        db.add(
            models.ContractItem(
                contract_id=contract.id,
                seq=int(item.get("seq") or index),
                item_name=item.get("item_name") or f"标的{index}",
                quantity=_to_decimal(item.get("quantity")) or Decimal("0"),
                unit=item.get("unit"),
                unit_price=_to_decimal(item.get("unit_price")),
                amount=_to_decimal(item.get("amount")) or Decimal("0"),
            )
        )

    for index, payment in enumerate(payment_plans, start=1):
        planned_amount = _to_decimal(payment.get("planned_amount"))
        actual_amount = _to_decimal(payment.get("actual_amount"))
        db.add(
            models.Payment(
                contract_id=contract.id,
                seq=int(payment["seq"]) if payment.get("seq") not in (None, "") else index,
                phase=payment.get("phase"),
                planned_date=_to_date(payment.get("planned_date")),
                planned_amount=planned_amount,
                actual_date=_to_date(payment.get("actual_date")),
                actual_amount=actual_amount,
                pending_amount=_build_pending_amount(planned_amount, actual_amount),
                payment_status=payment.get("payment_status") or "未付",
                description=payment.get("description"),
                remark=payment.get("remark"),
            )
        )

    for index, change in enumerate(changes, start=1):
        change_date = _to_date(change.get("change_date"))
        if not change_date:
            continue
        db.add(
            models.ContractChange(
                contract_id=contract.id,
                seq=int(change.get("seq") or index),
                change_date=change_date,
                change_info=change.get("change_info"),
                before_content=change.get("before_content"),
                after_content=change.get("after_content"),
                change_description=change.get("change_description"),
            )
        )

    db.commit()
    db.refresh(contract)

    return {
        "message": "导入成功",
        "project_id": project.id,
        "contract_id": contract.id,
    }
