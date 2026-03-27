"""数据导入路由。"""

from __future__ import annotations

import base64
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from io import BytesIO
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from openpyxl import Workbook, load_workbook
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..services.ai_parser import AIParserError, parse_screenshots

router = APIRouter(prefix="/api/import", tags=["导入"])

ENTITY_CONFIG: dict[str, dict[str, Any]] = {
    "projects": {
        "headers": [
            ("项目编号", "project_code"),
            ("项目名称", "project_name"),
            ("项目属性", "project_type"),
            ("开始日期", "start_date"),
            ("项目状态", "status"),
            ("项目预算", "budget"),
            ("负责人", "manager"),
            ("备注", "remark"),
        ],
        "example": {
            "project_code": "PRJ-2026-001",
            "project_name": "智慧园区建设项目",
            "project_type": "EPC",
            "start_date": "2026-03-01",
            "status": "立项",
            "budget": "1000000",
            "manager": "张三",
            "remark": "示例",
        },
        "required": ["project_code", "project_name", "status"],
    },
    "contracts": {
        "headers": [
            ("合同编号", "contract_code"),
            ("合同名称", "contract_name"),
            ("项目编号", "project_code"),
            ("供应商", "vendor"),
            ("合同金额", "amount"),
            ("合同状态", "status"),
            ("采购方式", "procurement_type"),
            ("费用归口部门", "cost_department"),
            ("签订日期", "sign_date"),
            ("归档日期", "filing_date"),
            ("开始日期", "start_date"),
            ("结束日期", "end_date"),
            ("主合同编号", "parent_contract_code"),
            ("续约类型", "renewal_type"),
            ("收支方向", "payment_direction"),
            ("备注", "remark"),
        ],
        "example": {
            "contract_code": "CTR-2026-001",
            "contract_name": "园区网络建设合同",
            "project_code": "PRJ-2026-001",
            "vendor": "北京甲方科技有限公司",
            "amount": "250000",
            "status": "草拟",
            "procurement_type": "公开招标",
            "cost_department": "信息部",
            "sign_date": "2026-03-10",
            "filing_date": "2026-03-12",
            "start_date": "2026-03-15",
            "end_date": "2026-12-31",
            "parent_contract_code": "",
            "renewal_type": "不续约",
            "payment_direction": "支出",
            "remark": "示例",
        },
        "required": ["contract_code", "contract_name", "project_code", "amount", "status"],
    },
    "payments": {
        "headers": [
            ("合同编号", "contract_code"),
            ("付款序号", "seq"),
            ("付款阶段", "phase"),
            ("计划日期", "planned_date"),
            ("计划金额", "planned_amount"),
            ("实付日期", "actual_date"),
            ("实付金额", "actual_amount"),
            ("付款状态", "payment_status"),
            ("说明", "description"),
            ("备注", "remark"),
        ],
        "example": {
            "contract_code": "CTR-2026-001",
            "seq": "1",
            "phase": "首付款",
            "planned_date": "2026-04-01",
            "planned_amount": "50000",
            "actual_date": "",
            "actual_amount": "",
            "payment_status": "未付",
            "description": "首付款",
            "remark": "示例",
        },
        "required": ["contract_code", "payment_status"],
    },
}


@router.post("/screenshot", response_model=schemas.AIScreenshotParseResponse)
async def import_from_screenshot(files: list[UploadFile] = File(...)):
    """上传截图并调用 AI 进行解析。"""
    if not files:
        raise HTTPException(status_code=400, detail="请上传至少一张截图")

    images_b64: list[str] = []
    for file in files:
        content = await file.read()
        if not content:
            continue
        images_b64.append(base64.b64encode(content).decode("utf-8"))

    if not images_b64:
        raise HTTPException(status_code=400, detail="上传文件为空")

    try:
        parsed_data, uncertain_fields = parse_screenshots(images_b64)
    except AIParserError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"AI 识别失败：{exc}") from exc

    return {"parsed_data": parsed_data, "uncertain_fields": uncertain_fields}


def _to_decimal(value, default: Decimal | None = Decimal("0")) -> Decimal | None:
    if value is None or value == "":
        return default
    try:
        return Decimal(str(value))
    except InvalidOperation as exc:
        raise ValueError("金额格式不正确") from exc


def _to_date(value) -> date | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value))


def _ensure_entity(entity: str) -> dict[str, Any]:
    cfg = ENTITY_CONFIG.get(entity)
    if not cfg:
        raise HTTPException(status_code=400, detail="entity 仅支持 projects/contracts/payments")
    return cfg


@router.get("/template/{entity}")
def download_template(entity: str):
    cfg = _ensure_entity(entity)
    wb = Workbook()
    ws = wb.active
    ws.title = "导入模板"

    headers = [item[0] for item in cfg["headers"]]
    ws.append(headers)
    ws.append([cfg["example"].get(field, "") for _, field in cfg["headers"]])

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{entity}_template.xlsx"'},
    )


@router.post("/excel/{entity}")
async def import_excel(
    entity: str,
    file: UploadFile = File(...),
    duplicate_action: str = Query(default="skip", pattern="^(skip|update)$"),
    db: Session = Depends(get_db),
):
    cfg = _ensure_entity(entity)
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="仅支持 xlsx 文件")

    try:
        data = await file.read()
        wb = load_workbook(BytesIO(data))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Excel 解析失败：{exc}") from exc
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) < 2:
        raise HTTPException(status_code=400, detail="模板至少包含表头行")

    header_cells = [str(v).strip() if v is not None else "" for v in rows[0]]
    header_to_index = {name: idx for idx, name in enumerate(header_cells)}
    required_headers = [h for h, _ in cfg["headers"]]
    missing_headers = [h for h in required_headers if h not in header_to_index]
    if missing_headers:
        raise HTTPException(status_code=400, detail=f"缺少列：{','.join(missing_headers)}")

    result = {"success": 0, "failed": 0, "skipped": 0, "errors": []}

    for row_no, row in enumerate(rows[1:], start=2):
        row_data: dict[str, Any] = {}
        for zh_name, field in cfg["headers"]:
            row_data[field] = row[header_to_index[zh_name]]

        if all((v is None or v == "") for v in row_data.values()):
            continue

        try:
            for field in cfg["required"]:
                if row_data.get(field) in (None, ""):
                    raise ValueError(f"{field} 不能为空")

            if entity == "projects":
                project = (
                    db.query(models.Project)
                    .filter(models.Project.project_code == str(row_data["project_code"]).strip())
                    .first()
                )
                payload = {
                    "project_code": str(row_data["project_code"]).strip(),
                    "project_name": str(row_data["project_name"]).strip(),
                    "project_type": row_data.get("project_type"),
                    "start_date": _to_date(row_data.get("start_date")),
                    "status": str(row_data["status"]).strip(),
                    "budget": _to_decimal(row_data.get("budget"), default=None),
                    "manager": row_data.get("manager"),
                    "remark": row_data.get("remark"),
                }
                if project:
                    if duplicate_action == "skip":
                        result["skipped"] += 1
                        continue
                    for key, value in payload.items():
                        setattr(project, key, value)
                else:
                    db.add(models.Project(**payload))

            elif entity == "contracts":
                project_code = str(row_data["project_code"]).strip()
                project = db.query(models.Project).filter(models.Project.project_code == project_code).first()
                if not project:
                    raise ValueError("项目编号不存在")

                contract_code = str(row_data["contract_code"]).strip()
                contract = db.query(models.Contract).filter(models.Contract.contract_code == contract_code).first()
                payload = {
                    "project_id": project.id,
                    "contract_code": contract_code,
                    "contract_name": str(row_data["contract_name"]).strip(),
                    "vendor": row_data.get("vendor"),
                    "amount": _to_decimal(row_data.get("amount"), default=None),
                    "status": str(row_data["status"]).strip(),
                    "procurement_type": row_data.get("procurement_type"),
                    "cost_department": row_data.get("cost_department"),
                    "sign_date": _to_date(row_data.get("sign_date")),
                    "filing_date": _to_date(row_data.get("filing_date")),
                    "start_date": _to_date(row_data.get("start_date")),
                    "end_date": _to_date(row_data.get("end_date")),
                    "parent_contract_code": row_data.get("parent_contract_code"),
                    "renewal_type": row_data.get("renewal_type"),
                    "payment_direction": row_data.get("payment_direction"),
                    "remark": row_data.get("remark"),
                }

                if contract:
                    if duplicate_action == "skip":
                        result["skipped"] += 1
                        continue
                    for key, value in payload.items():
                        setattr(contract, key, value)
                else:
                    db.add(models.Contract(**payload))

            else:
                contract_code = str(row_data["contract_code"]).strip()
                contract = db.query(models.Contract).filter(models.Contract.contract_code == contract_code).first()
                if not contract:
                    raise ValueError("合同编号不存在")

                seq = int(row_data["seq"]) if row_data.get("seq") not in (None, "") else None
                payment = None
                if seq is not None:
                    payment = (
                        db.query(models.Payment)
                        .filter(models.Payment.contract_id == contract.id, models.Payment.seq == seq)
                        .first()
                    )

                planned_amount = _to_decimal(row_data.get("planned_amount"), default=None)
                actual_amount = _to_decimal(row_data.get("actual_amount"), default=None)
                payload = {
                    "contract_id": contract.id,
                    "seq": seq,
                    "phase": row_data.get("phase"),
                    "planned_date": _to_date(row_data.get("planned_date")),
                    "planned_amount": planned_amount,
                    "actual_date": _to_date(row_data.get("actual_date")),
                    "actual_amount": actual_amount,
                    "pending_amount": (planned_amount or Decimal("0")) - (actual_amount or Decimal("0"))
                    if planned_amount is not None or actual_amount is not None
                    else None,
                    "payment_status": str(row_data["payment_status"]).strip(),
                    "description": row_data.get("description"),
                    "remark": row_data.get("remark"),
                }

                if payment:
                    if duplicate_action == "skip":
                        result["skipped"] += 1
                        continue
                    for key, value in payload.items():
                        setattr(payment, key, value)
                else:
                    db.add(models.Payment(**payload))

            result["success"] += 1
        except Exception as exc:  # noqa: BLE001
            result["failed"] += 1
            result["errors"].append({"row": row_no, "message": str(exc)})

    try:
        db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        raise HTTPException(status_code=500, detail=f"导入失败，数据库写入异常：{exc}") from exc
    return result


@router.post("/screenshot/confirm")
def confirm_screenshot_import(payload: schemas.AIScreenshotConfirmRequest, db: Session = Depends(get_db)):
    """确认解析结果并落库。"""
    parsed = payload.parsed_data
    contract_data = parsed.get("contract") or {}
    if not contract_data.get("contract_code"):
        raise HTTPException(status_code=400, detail="contract.contract_code 不能为空")

    project_code = contract_data.get("project_code") or "UNSPECIFIED"
    project_name = contract_data.get("project_name") or project_code

    project = db.query(models.Project).filter(models.Project.project_code == project_code).first()
    if not project:
        project = models.Project(
            project_code=project_code,
            project_name=project_name,
            status="立项",
        )
        db.add(project)
        db.flush()

    contract = db.query(models.Contract).filter(models.Contract.contract_code == contract_data["contract_code"]).first()
    contract_fields = {
        "project_id": project.id,
        "contract_code": contract_data["contract_code"],
        "contract_name": contract_data.get("contract_name") or contract_data["contract_code"],
        "procurement_type": contract_data.get("procurement_type"),
        "cost_department": contract_data.get("cost_department"),
        "vendor": contract_data.get("vendor"),
        "amount": _to_decimal(contract_data.get("amount")),
        "amount_before_change": _to_decimal(contract_data.get("amount_before_change"), default=None),
        "sign_date": _to_date(contract_data.get("sign_date")),
        "filing_date": _to_date(contract_data.get("filing_date")),
        "start_date": _to_date(contract_data.get("start_date")),
        "end_date": _to_date(contract_data.get("end_date")),
        "parent_contract_code": contract_data.get("parent_contract_code"),
        "renewal_type": contract_data.get("renewal_type"),
        "payment_direction": contract_data.get("payment_direction"),
        "status": contract_data.get("status") or "草拟",
    }

    if not contract:
        contract = models.Contract(**contract_fields)
        db.add(contract)
        db.flush()
    else:
        for key, value in contract_fields.items():
            setattr(contract, key, value)
        db.query(models.ContractItem).filter(models.ContractItem.contract_id == contract.id).delete()
        db.query(models.Payment).filter(models.Payment.contract_id == contract.id).delete()
        db.query(models.ContractChange).filter(models.ContractChange.contract_id == contract.id).delete()
        db.flush()

    for item in parsed.get("items") or []:
        db.add(
            models.ContractItem(
                contract_id=contract.id,
                seq=item.get("seq") or 1,
                item_name=item.get("item_name") or "未命名标的",
                quantity=_to_decimal(item.get("quantity"), default=Decimal("1")),
                unit=item.get("unit"),
                unit_price=_to_decimal(item.get("unit_price"), default=None),
                amount=_to_decimal(item.get("amount")),
            )
        )

    for payment in parsed.get("payment_plans") or []:
        planned_amount = _to_decimal(payment.get("planned_amount"), default=None)
        db.add(
            models.Payment(
                contract_id=contract.id,
                seq=payment.get("seq"),
                phase=payment.get("phase"),
                planned_date=_to_date(payment.get("planned_date")),
                planned_amount=planned_amount,
                payment_status="未付",
                description=payment.get("description"),
                pending_amount=planned_amount,
            )
        )

    for change in parsed.get("changes") or []:
        if not change.get("change_date"):
            continue
        db.add(
            models.ContractChange(
                contract_id=contract.id,
                seq=change.get("seq") or 1,
                change_date=_to_date(change.get("change_date")),
                change_info=change.get("change_info"),
                before_content=change.get("before_content"),
                after_content=change.get("after_content"),
                change_description=change.get("change_description"),
            )
        )

    try:
        db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        raise HTTPException(status_code=500, detail=f"确认导入失败：{exc}") from exc

    db.refresh(contract)
    return {"message": "导入成功", "contract_id": contract.id, "project_id": project.id}
