"""数据导出路由。"""

from __future__ import annotations

from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db

router = APIRouter(prefix="/api/export", tags=["导出"])

PROJECT_SORT_FIELDS = {
    "project_code": models.Project.project_code,
    "project_name": models.Project.project_name,
    "project_type": models.Project.project_type,
    "start_date": models.Project.start_date,
    "status": models.Project.status,
    "budget": models.Project.budget,
    "manager": models.Project.manager,
    "created_at": models.Project.created_at,
    "updated_at": models.Project.updated_at,
}


def _safe_int(value: str | None, field_name: str) -> int | None:
    """安全转换整数参数。"""
    if value in (None, ""):
        return None
    try:
        return int(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"{field_name} 参数格式不正确") from exc


@router.get("/{entity}")
def export_entity(
    entity: str,
    request: Request,
    format: str = Query(default="xlsx", pattern="^xlsx$"),
    db: Session = Depends(get_db),
):
    """导出指定实体数据。"""
    if format != "xlsx":
        raise HTTPException(status_code=400, detail="仅支持 xlsx 导出")

    wb = Workbook()
    ws = wb.active
    ws.title = "导出数据"

    if entity == "projects":
        status = request.query_params.get("status")
        exclude_statuses = request.query_params.get("exclude_statuses")
        search = request.query_params.get("search")
        sort_field = request.query_params.get("sort_field") or "start_date"
        sort_order = request.query_params.get("sort_order") or "desc"

        query = db.query(models.Project)
        if status:
            query = query.filter(models.Project.status == status)
        if exclude_statuses:
            excluded_values = [item.strip() for item in exclude_statuses.split(",") if item.strip()]
            if excluded_values:
                query = query.filter(~models.Project.status.in_(excluded_values))
        if search:
            like_text = f"%{search}%"
            query = query.filter(
                or_(models.Project.project_code.like(like_text), models.Project.project_name.like(like_text))
            )

        sort_column = PROJECT_SORT_FIELDS.get(sort_field, models.Project.start_date)
        if sort_order == "asc":
            query = query.order_by(sort_column.asc(), models.Project.id.desc())
        else:
            query = query.order_by(sort_column.desc(), models.Project.id.desc())

        data = query.all()
        ws.append(["项目编号", "项目名称", "项目属性", "状态", "预算", "负责人", "立项时间", "备注"])
        for item in data:
            ws.append(
                [
                    item.project_code,
                    item.project_name,
                    item.project_type,
                    item.status,
                    item.budget,
                    item.manager,
                    item.start_date.isoformat() if item.start_date else "",
                    item.remark,
                ]
            )

    elif entity == "contracts":
        project_id = _safe_int(request.query_params.get("project_id"), "project_id")
        status = request.query_params.get("status")
        query = db.query(models.Contract).join(models.Project, models.Contract.project_id == models.Project.id)
        if project_id:
            query = query.filter(models.Contract.project_id == project_id)
        if status:
            query = query.filter(models.Contract.status == status)
        data = query.order_by(models.Contract.id.desc()).all()
        ws.append(["合同编号", "合同名称", "项目编号", "项目名称", "供应商", "合同金额", "合同状态", "签订日期"])
        for item in data:
            ws.append(
                [
                    item.contract_code,
                    item.contract_name,
                    item.project.project_code if item.project else "",
                    item.project.project_name if item.project else "",
                    item.vendor,
                    item.amount,
                    item.status,
                    item.sign_date.isoformat() if item.sign_date else "",
                ]
            )

    elif entity == "payments":
        contract_id = _safe_int(request.query_params.get("contract_id"), "contract_id")
        payment_status = request.query_params.get("payment_status")
        query = db.query(models.Payment).join(models.Contract, models.Payment.contract_id == models.Contract.id)
        if contract_id:
            query = query.filter(models.Payment.contract_id == contract_id)
        if payment_status:
            query = query.filter(models.Payment.payment_status == payment_status)
        data = query.order_by(models.Payment.id.desc()).all()
        ws.append(["合同编号", "付款序号", "付款阶段", "计划日期", "计划金额", "实付日期", "实付金额", "付款状态", "备注"])
        for item in data:
            ws.append(
                [
                    item.contract.contract_code if item.contract else "",
                    item.seq,
                    item.phase,
                    item.planned_date.isoformat() if item.planned_date else "",
                    item.planned_amount,
                    item.actual_date.isoformat() if item.actual_date else "",
                    item.actual_amount,
                    item.payment_status,
                    item.remark,
                ]
            )
    else:
        raise HTTPException(status_code=400, detail="entity 仅支持 projects/contracts/payments")

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename=\"{entity}.xlsx\"'},
    )
