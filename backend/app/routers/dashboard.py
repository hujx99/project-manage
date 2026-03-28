"""仪表盘路由。"""

from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from .. import models
from ..database import get_db

router = APIRouter(prefix="/api/dashboard", tags=["仪表盘"])

PAID_PAYMENT_STATUSES = {"已付款"}
SUBMITTED_PAYMENT_STATUSES = {"已提报", "已提交"}


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


@router.get("/workflow")
def get_dashboard_workflow(db: Session = Depends(get_db)):
    """返回按业务流程组织的总览数据。"""
    today = date.today()
    deadline = today + timedelta(days=7)

    project_total = db.query(func.count(models.Project.id)).scalar() or 0
    linked_project_count = db.query(func.count(func.distinct(models.Contract.project_id))).scalar() or 0
    active_project_count = (
        db.query(func.count(models.Project.id))
        .filter(models.Project.status != "结项")
        .scalar()
        or 0
    )

    contract_total = db.query(func.count(models.Contract.id)).scalar() or 0
    active_contract_count = (
        db.query(func.count(models.Contract.id))
        .filter(models.Contract.status != "归档")
        .scalar()
        or 0
    )
    contracts_without_payment = (
        db.query(func.count(models.Contract.id))
        .outerjoin(models.Payment, models.Payment.contract_id == models.Contract.id)
        .filter(models.Payment.id.is_(None))
        .scalar()
        or 0
    )

    contracts = (
        db.query(models.Contract)
        .options(
            selectinload(models.Contract.items),
            selectinload(models.Contract.payments),
        )
        .all()
    )
    contract_warning_count = 0
    for contract in contracts:
        item_total = sum(Decimal(str(item.amount or 0)) for item in contract.items)
        contract_amount = Decimal(str(contract.amount or 0))
        paid_total = sum(Decimal(str(payment.actual_amount or 0)) for payment in contract.payments)
        has_item_mismatch = bool(contract.items) and abs(item_total - contract_amount) > Decimal("0.01")
        has_overpaid = paid_total - contract_amount > Decimal("0.01")
        if has_item_mismatch or has_overpaid:
            contract_warning_count += 1

    payment_total = db.query(func.count(models.Payment.id)).scalar() or 0
    paid_payment_count = (
        db.query(func.count(models.Payment.id))
        .filter(models.Payment.payment_status.in_(PAID_PAYMENT_STATUSES))
        .scalar()
        or 0
    )
    submitted_payment_count = (
        db.query(func.count(models.Payment.id))
        .filter(models.Payment.payment_status.in_(SUBMITTED_PAYMENT_STATUSES))
        .scalar()
        or 0
    )
    unpaid_payment_count = max(payment_total - paid_payment_count - submitted_payment_count, 0)
    overdue_payment_count = (
        db.query(func.count(models.Payment.id))
        .filter(models.Payment.planned_date.isnot(None))
        .filter(models.Payment.planned_date < today)
        .filter(~models.Payment.payment_status.in_(PAID_PAYMENT_STATUSES))
        .scalar()
        or 0
    )
    due_soon_payment_count = (
        db.query(func.count(models.Payment.id))
        .filter(models.Payment.planned_date.isnot(None))
        .filter(models.Payment.planned_date >= today)
        .filter(models.Payment.planned_date <= deadline)
        .filter(~models.Payment.payment_status.in_(PAID_PAYMENT_STATUSES))
        .scalar()
        or 0
    )

    return {
        "project_stage": {
            "total": project_total,
            "active_count": active_project_count,
            "closed_count": max(project_total - active_project_count, 0),
            "linked_count": linked_project_count,
            "unlinked_count": max(project_total - linked_project_count, 0),
        },
        "contract_stage": {
            "total": contract_total,
            "active_count": active_contract_count,
            "archived_count": max(contract_total - active_contract_count, 0),
            "without_payment_count": contracts_without_payment,
            "warning_count": contract_warning_count,
        },
        "payment_stage": {
            "total": payment_total,
            "unpaid_count": unpaid_payment_count,
            "submitted_count": submitted_payment_count,
            "paid_count": paid_payment_count,
            "overdue_count": overdue_payment_count,
            "due_soon_count": due_soon_payment_count,
        },
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
