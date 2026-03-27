from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import and_, func
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Contract, Payment, Project

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    project_count = db.query(func.count(Project.id)).scalar() or 0
    contract_count = db.query(func.count(Contract.id)).scalar() or 0
    payment_count = db.query(func.count(Payment.id)).scalar() or 0

    total_budget = db.query(func.coalesce(func.sum(Project.budget), 0)).scalar() or Decimal("0")
    total_contract_amount = db.query(func.coalesce(func.sum(Contract.amount), 0)).scalar() or Decimal("0")
    total_paid_amount = db.query(func.coalesce(func.sum(Payment.actual_amount), 0)).scalar() or Decimal("0")

    total_planned_amount = db.query(func.coalesce(func.sum(Payment.planned_amount), 0)).scalar() or Decimal("0")
    total_pending_amount = total_planned_amount - total_paid_amount

    status_rows = (
        db.query(Project.status, func.count(Project.id))
        .group_by(Project.status)
        .all()
    )
    project_status_distribution = [
        {"status": status, "count": count} for status, count in status_rows
    ]

    return {
        "project_count": project_count,
        "contract_count": contract_count,
        "payment_count": payment_count,
        "total_budget": total_budget,
        "total_contract_amount": total_contract_amount,
        "total_paid_amount": total_paid_amount,
        "total_pending_amount": total_pending_amount,
        "project_status_distribution": project_status_distribution,
    }


@router.get("/project-overview")
def get_project_overview(db: Session = Depends(get_db)):
    projects = (
        db.query(Project)
        .options(joinedload(Project.contracts).joinedload(Contract.payments))
        .all()
    )

    result = []
    for project in projects:
        contracts_data = []
        total_contract_amount = Decimal("0")
        total_pending_amount = Decimal("0")

        for contract in project.contracts:
            paid = sum(
                (p.actual_amount or Decimal("0")) for p in contract.payments
            )
            pending = sum(
                (p.planned_amount or Decimal("0")) - (p.actual_amount or Decimal("0"))
                for p in contract.payments
            )
            if pending < 0:
                pending = Decimal("0")

            total_contract_amount += contract.amount or Decimal("0")
            total_pending_amount += pending

            payments_data = []
            for p in contract.payments:
                p_planned = p.planned_amount or Decimal("0")
                p_actual = p.actual_amount or Decimal("0")
                p_pending = p_planned - p_actual
                if p_pending < 0:
                    p_pending = Decimal("0")
                payments_data.append({
                    "id": p.id,
                    "seq": p.seq,
                    "phase": p.phase,
                    "planned_amount": p_planned,
                    "actual_amount": p_actual,
                    "pending_amount": p_pending,
                    "payment_status": p.payment_status,
                    "planned_date": p.planned_date.isoformat() if p.planned_date else None,
                })

            contracts_data.append({
                "id": contract.id,
                "contract_code": contract.contract_code,
                "contract_name": contract.contract_name,
                "vendor": contract.vendor,
                "amount": contract.amount or Decimal("0"),
                "status": contract.status,
                "payment_count": len(contract.payments),
                "paid_amount": paid,
                "pending_amount": pending,
                "payments": payments_data,
            })

        result.append({
            "id": project.id,
            "project_code": project.project_code,
            "project_name": project.project_name,
            "status": project.status,
            "budget": project.budget or Decimal("0"),
            "contract_count": len(project.contracts),
            "total_contract_amount": total_contract_amount,
            "total_pending_amount": total_pending_amount,
            "contracts": contracts_data,
        })

    return result


@router.get("/pending-payments")
def get_pending_payments(db: Session = Depends(get_db)):
    today = date.today()
    deadline = today + timedelta(days=30)

    rows = (
        db.query(
            Project.project_name.label("project_name"),
            Contract.contract_name.label("contract_name"),
            Payment.planned_amount.label("amount"),
            Payment.planned_date.label("planned_date"),
        )
        .join(Contract, Payment.contract_id == Contract.id)
        .join(Project, Contract.project_id == Project.id)
        .filter(
            and_(
                Payment.planned_date >= today,
                Payment.planned_date <= deadline,
                Payment.payment_status != "已付款",
                func.coalesce(Payment.planned_amount, 0) > func.coalesce(Payment.actual_amount, 0),
            )
        )
        .order_by(Payment.planned_date.asc())
        .all()
    )

    return [
        {
            "project_name": row.project_name,
            "contract_name": row.contract_name,
            "amount": row.amount or Decimal("0"),
            "planned_date": row.planned_date,
        }
        for row in rows
    ]
