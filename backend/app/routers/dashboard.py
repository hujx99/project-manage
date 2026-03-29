"""仪表盘路由。"""

from collections import Counter, defaultdict
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
PROJECT_STATUS_ORDER = ["立项", "合同", "初验", "终验", "质保", "结项"]
CONTRACT_STATUS_ORDER = ["草拟", "签订", "执行", "执行中", "服务中", "归档"]


def _decimal_to_float(value: Decimal | None) -> float:
    """将 Decimal 转为 float，便于 JSON 返回。"""
    return float(value or 0)


def _to_decimal(value: Decimal | None) -> Decimal:
    """统一将 ORM 中的金额值转为 Decimal。"""
    return Decimal(str(value or 0))


def _safe_percent(numerator: int | float | Decimal, denominator: int | float | Decimal) -> float:
    """避免除零的百分比计算。"""
    denominator_value = float(denominator or 0)
    if denominator_value <= 0:
        return 0.0
    return round((float(numerator) / denominator_value) * 100, 1)


def _payment_open_amount(payment: models.Payment) -> Decimal:
    """返回付款记录当前仍待处理的金额。"""
    return _to_decimal(payment.pending_amount if payment.pending_amount is not None else payment.planned_amount)


def _ordered_distribution(counter: Counter[str], order: list[str]) -> list[dict[str, int | str]]:
    """按业务顺序返回状态分布，剩余未知状态附加到末尾。"""
    items: list[dict[str, int | str]] = []
    seen: set[str] = set()

    for key in order:
        count = counter.get(key, 0)
        if count:
            items.append({"status": key, "count": count})
            seen.add(key)

    for key, count in sorted(counter.items(), key=lambda item: (-item[1], item[0])):
        if key in seen or not count:
            continue
        items.append({"status": key or "未填写", "count": count})

    return items


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


@router.get("/analysis")
def get_dashboard_analysis(db: Session = Depends(get_db)):
    """返回更适合分析型首页的仪表盘数据。"""
    today = date.today()
    deadline_7 = today + timedelta(days=7)
    deadline_30 = today + timedelta(days=30)

    projects = (
        db.query(models.Project)
        .options(
            selectinload(models.Project.contracts).selectinload(models.Contract.items),
            selectinload(models.Project.contracts).selectinload(models.Contract.payments),
        )
        .all()
    )

    contracts = [contract for project in projects for contract in project.contracts]
    payments = [payment for contract in contracts for payment in contract.payments]

    total_budget = sum((_to_decimal(project.budget) for project in projects), Decimal("0"))
    total_contract_amount = sum((_to_decimal(contract.amount) for contract in contracts), Decimal("0"))
    total_paid_amount = sum((_to_decimal(payment.actual_amount) for payment in payments), Decimal("0"))
    total_pending_amount = sum(
        (_payment_open_amount(payment) for payment in payments if payment.payment_status not in PAID_PAYMENT_STATUSES),
        Decimal("0"),
    )

    project_status_counter = Counter(project.status or "未填写" for project in projects)
    contract_status_counter = Counter(contract.status or "未填写" for contract in contracts)

    project_total = len(projects)
    contract_total = len(contracts)
    payment_total = len(payments)

    projects_with_contracts = sum(1 for project in projects if project.contracts)
    contracts_with_payment_plans = sum(1 for contract in contracts if contract.payments)
    closed_project_count = sum(1 for project in projects if project.status == "结项")
    active_project_count = max(project_total - closed_project_count, 0)
    archived_contract_count = sum(1 for contract in contracts if contract.status == "归档")
    active_contract_count = max(contract_total - archived_contract_count, 0)

    paid_payment_count = sum(1 for payment in payments if payment.payment_status in PAID_PAYMENT_STATUSES)
    submitted_payment_count = sum(1 for payment in payments if payment.payment_status in SUBMITTED_PAYMENT_STATUSES)
    unpaid_payment_count = max(payment_total - paid_payment_count - submitted_payment_count, 0)
    outstanding_payment_count = max(payment_total - paid_payment_count, 0)

    bucket_map = {
        "overdue": {"key": "overdue", "label": "已逾期", "count": 0, "amount": Decimal("0")},
        "today": {"key": "today", "label": "今日到期", "count": 0, "amount": Decimal("0")},
        "within_7_days": {"key": "within_7_days", "label": "7天内", "count": 0, "amount": Decimal("0")},
        "within_30_days": {"key": "within_30_days", "label": "30天内", "count": 0, "amount": Decimal("0")},
        "after_30_days": {"key": "after_30_days", "label": "30天后", "count": 0, "amount": Decimal("0")},
        "no_due_date": {"key": "no_due_date", "label": "未排日期", "count": 0, "amount": Decimal("0")},
    }
    overdue_payment_count = 0
    overdue_payment_amount = Decimal("0")
    due_soon_payment_count = 0
    due_soon_payment_amount = Decimal("0")
    priority_payments: list[dict[str, int | float | str | None]] = []

    manager_buckets: dict[str, dict[str, int | Decimal | str]] = defaultdict(
        lambda: {
            "manager": "未分配",
            "project_count": 0,
            "active_project_count": 0,
            "unlinked_project_count": 0,
            "budget_total": Decimal("0"),
            "contract_total": Decimal("0"),
            "pending_total": Decimal("0"),
        }
    )
    vendor_buckets: dict[str, dict[str, int | Decimal | str]] = defaultdict(
        lambda: {
            "vendor": "未填写供应商",
            "contract_count": 0,
            "active_contract_count": 0,
            "amount_total": Decimal("0"),
            "pending_total": Decimal("0"),
        }
    )
    top_risk_projects: list[dict[str, int | float | str | None]] = []

    for project in projects:
        project_contract_total = Decimal("0")
        project_pending_total = Decimal("0")
        project_overdue_count = 0
        project_due_soon_count = 0

        manager_name = (project.manager or "").strip() or "未分配"
        manager_bucket = manager_buckets[manager_name]
        manager_bucket["manager"] = manager_name
        manager_bucket["project_count"] += 1
        manager_bucket["budget_total"] += _to_decimal(project.budget)
        if project.status != "结项":
            manager_bucket["active_project_count"] += 1
        if not project.contracts:
            manager_bucket["unlinked_project_count"] += 1

        for contract in project.contracts:
            contract_amount = _to_decimal(contract.amount)
            project_contract_total += contract_amount

            vendor_name = (contract.vendor or "").strip() or "未填写供应商"
            vendor_bucket = vendor_buckets[vendor_name]
            vendor_bucket["vendor"] = vendor_name
            vendor_bucket["contract_count"] += 1
            vendor_bucket["amount_total"] += contract_amount
            if contract.status != "归档":
                vendor_bucket["active_contract_count"] += 1

            for payment in contract.payments:
                if payment.payment_status in PAID_PAYMENT_STATUSES:
                    continue

                amount = _payment_open_amount(payment)
                project_pending_total += amount
                vendor_bucket["pending_total"] += amount

                if payment.planned_date is None:
                    bucket = bucket_map["no_due_date"]
                elif payment.planned_date < today:
                    bucket = bucket_map["overdue"]
                    overdue_payment_count += 1
                    overdue_payment_amount += amount
                    project_overdue_count += 1
                elif payment.planned_date == today:
                    bucket = bucket_map["today"]
                    due_soon_payment_count += 1
                    due_soon_payment_amount += amount
                    project_due_soon_count += 1
                elif payment.planned_date <= deadline_7:
                    bucket = bucket_map["within_7_days"]
                    due_soon_payment_count += 1
                    due_soon_payment_amount += amount
                    project_due_soon_count += 1
                elif payment.planned_date <= deadline_30:
                    bucket = bucket_map["within_30_days"]
                else:
                    bucket = bucket_map["after_30_days"]

                bucket["count"] += 1
                bucket["amount"] += amount

                if payment.planned_date is not None:
                    diff_days = (payment.planned_date - today).days
                    priority_payments.append(
                        {
                            "id": payment.id,
                            "project_name": project.project_name,
                            "contract_name": contract.contract_name,
                            "manager": manager_name,
                            "amount": _decimal_to_float(amount),
                            "planned_date": payment.planned_date.isoformat(),
                            "payment_status": payment.payment_status,
                            "diff_days": diff_days,
                        }
                    )

        manager_bucket["contract_total"] += project_contract_total
        manager_bucket["pending_total"] += project_pending_total

        risk_score = (
            project_overdue_count * 120
            + project_due_soon_count * 50
            + (80 if not project.contracts else 0)
            + float(project_pending_total / Decimal("10000"))
        )

        top_risk_projects.append(
            {
                "project_id": project.id,
                "project_name": project.project_name,
                "manager": manager_name,
                "status": project.status,
                "contract_count": len(project.contracts),
                "contract_total": _decimal_to_float(project_contract_total),
                "pending_total": _decimal_to_float(project_pending_total),
                "overdue_count": project_overdue_count,
                "due_soon_count": project_due_soon_count,
                "risk_score": round(risk_score, 1),
            }
        )

    manager_load = sorted(
        manager_buckets.values(),
        key=lambda item: (
            int(item["active_project_count"]),
            float(item["pending_total"]),
            float(item["budget_total"]),
        ),
        reverse=True,
    )[:6]
    vendor_concentration = sorted(
        vendor_buckets.values(),
        key=lambda item: (float(item["amount_total"]), int(item["contract_count"])),
        reverse=True,
    )[:6]
    top_risk_projects = sorted(
        top_risk_projects,
        key=lambda item: (float(item["risk_score"]), float(item["pending_total"])),
        reverse=True,
    )[:6]
    priority_payments = sorted(
        priority_payments,
        key=lambda item: (int(item["diff_days"]), -float(item["amount"])),
    )[:8]

    return {
        "financial_health": {
            "total_budget": _decimal_to_float(total_budget),
            "total_contract_amount": _decimal_to_float(total_contract_amount),
            "total_paid_amount": _decimal_to_float(total_paid_amount),
            "total_pending_amount": _decimal_to_float(total_pending_amount),
            "budget_usage_rate": _safe_percent(total_contract_amount, total_budget),
            "payment_execution_rate": _safe_percent(total_paid_amount, total_contract_amount),
            "pending_pressure_rate": _safe_percent(total_pending_amount, total_contract_amount),
            "uncontracted_budget": _decimal_to_float(max(total_budget - total_contract_amount, Decimal("0"))),
        },
        "coverage": {
            "project_contract_link_rate": _safe_percent(projects_with_contracts, project_total),
            "contract_payment_plan_rate": _safe_percent(contracts_with_payment_plans, contract_total),
            "payment_overdue_rate": _safe_percent(overdue_payment_count, outstanding_payment_count),
            "closed_project_rate": _safe_percent(closed_project_count, project_total),
        },
        "funnel": {
            "project_total": project_total,
            "active_project_count": active_project_count,
            "projects_with_contracts": projects_with_contracts,
            "projects_without_contracts": max(project_total - projects_with_contracts, 0),
            "contract_total": contract_total,
            "active_contract_count": active_contract_count,
            "contracts_with_payment_plans": contracts_with_payment_plans,
            "contracts_without_payment_plans": max(contract_total - contracts_with_payment_plans, 0),
            "payment_total": payment_total,
            "paid_payment_count": paid_payment_count,
            "submitted_payment_count": submitted_payment_count,
            "unpaid_payment_count": unpaid_payment_count,
        },
        "project_status_distribution": _ordered_distribution(project_status_counter, PROJECT_STATUS_ORDER),
        "contract_status_distribution": _ordered_distribution(contract_status_counter, CONTRACT_STATUS_ORDER),
        "payment_due_buckets": [
            {
                "key": bucket["key"],
                "label": bucket["label"],
                "count": int(bucket["count"]),
                "amount": _decimal_to_float(bucket["amount"]),
            }
            for bucket in bucket_map.values()
        ],
        "payment_risk": {
            "overdue_count": overdue_payment_count,
            "overdue_amount": _decimal_to_float(overdue_payment_amount),
            "due_soon_count": due_soon_payment_count,
            "due_soon_amount": _decimal_to_float(due_soon_payment_amount),
        },
        "manager_load": [
            {
                "manager": str(item["manager"]),
                "project_count": int(item["project_count"]),
                "active_project_count": int(item["active_project_count"]),
                "unlinked_project_count": int(item["unlinked_project_count"]),
                "budget_total": _decimal_to_float(item["budget_total"]),
                "contract_total": _decimal_to_float(item["contract_total"]),
                "pending_total": _decimal_to_float(item["pending_total"]),
            }
            for item in manager_load
        ],
        "vendor_concentration": [
            {
                "vendor": str(item["vendor"]),
                "contract_count": int(item["contract_count"]),
                "active_contract_count": int(item["active_contract_count"]),
                "amount_total": _decimal_to_float(item["amount_total"]),
                "pending_total": _decimal_to_float(item["pending_total"]),
            }
            for item in vendor_concentration
        ],
        "top_risk_projects": top_risk_projects,
        "priority_payments": priority_payments,
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
