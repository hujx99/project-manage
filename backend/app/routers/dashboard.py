"""仪表盘路由。"""

from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db

router = APIRouter(prefix="/api/dashboard", tags=["仪表盘"])


def _decimal_to_float(value: Decimal | None) -> float:
    """将 Decimal 转为 float，便于 JSON 返回。"""
    return float(value or 0)


@router.get("/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    """返回仪表盘汇总数据。"""
    project_count = db.query(func.count(models.Project.id)).scalar() or 0
    contract_count = db.query(func.count(models.Contract.id)).scalar() or 0
    payment_count = db.query(func.count(models.Payment.id)).scalar() or 0

    total_budget = db.query(func.coalesce(func.sum(models.Project.budget), 0)).scalar()
    total_contract_amount = db.query(func.coalesce(func.sum(models.Contract.amount), 0)).scalar()
    total_paid_amount = db.query(func.coalesce(func.sum(models.Payment.actual_amount), 0)).scalar()
    total_pending_amount = db.query(func.coalesce(func.sum(models.Payment.pending_amount), 0)).scalar()

    status_rows = (
        db.query(models.Project.status, func.count(models.Project.id))
        .group_by(models.Project.status)
        .order_by(models.Project.status.asc())
        .all()
    )

    return {
        "project_count": project_count,
        "contract_count": contract_count,
        "payment_count": payment_count,
        "total_budget": _decimal_to_float(total_budget),
        "total_contract_amount": _decimal_to_float(total_contract_amount),
        "total_paid_amount": _decimal_to_float(total_paid_amount),
        "total_pending_amount": _decimal_to_float(total_pending_amount),
        "project_status_distribution": [
            {"status": status, "count": count}
            for status, count in status_rows
        ],
    }


@router.get("/pending-payments")
def get_pending_payments(db: Session = Depends(get_db)):
    """返回未来 30 天内计划付款但未付的记录。"""
    today = date.today()
    deadline = today + timedelta(days=30)

    rows = (
        db.query(
            models.Payment.id,
            models.Project.project_name,
            models.Contract.contract_name,
            models.Payment.pending_amount,
            models.Payment.planned_amount,
            models.Payment.planned_date,
            models.Payment.payment_status,
        )
        .join(models.Contract, models.Payment.contract_id == models.Contract.id)
        .join(models.Project, models.Contract.project_id == models.Project.id)
        .filter(models.Payment.planned_date.isnot(None))
        .filter(models.Payment.planned_date >= today)
        .filter(models.Payment.planned_date <= deadline)
        .filter(models.Payment.payment_status != "已付款")
        .order_by(models.Payment.planned_date.asc(), models.Payment.id.asc())
        .all()
    )

    return [
        {
            "id": row.id,
            "project_name": row.project_name,
            "contract_name": row.contract_name,
            "amount": _decimal_to_float(row.pending_amount if row.pending_amount is not None else row.planned_amount),
            "planned_date": row.planned_date.isoformat() if row.planned_date else None,
            "payment_status": row.payment_status,
        }
        for row in rows
    ]
