"""付款管理路由。"""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas

router = APIRouter(prefix="/api/payments", tags=["付款"])


def _calc_pending_amount(planned_amount: Decimal | None, actual_amount: Decimal | None) -> Decimal | None:
    """计算待付款金额。"""
    if planned_amount is None and actual_amount is None:
        return None
    planned = planned_amount or Decimal("0")
    actual = actual_amount or Decimal("0")
    return planned - actual


@router.get("", response_model=list[schemas.PaymentResponse])
def list_payments(
    contract_id: int | None = Query(default=None, description="按合同筛选"),
    db: Session = Depends(get_db),
):
    query = db.query(models.Payment)
    if contract_id is not None:
        query = query.filter(models.Payment.contract_id == contract_id)
    return query.order_by(models.Payment.id.desc()).all()


@router.get("/{payment_id}", response_model=schemas.PaymentResponse)
def get_payment(payment_id: int, db: Session = Depends(get_db)):
    entity = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="付款记录不存在")
    return entity


@router.post("", response_model=schemas.PaymentResponse)
def create_payment(payload: schemas.PaymentCreate, db: Session = Depends(get_db)):
    contract = db.query(models.Contract).filter(models.Contract.id == payload.contract_id).first()
    if not contract:
        raise HTTPException(status_code=400, detail="所属合同不存在")

    data = payload.model_dump()
    data["pending_amount"] = _calc_pending_amount(data.get("planned_amount"), data.get("actual_amount"))
    entity = models.Payment(**data)
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return entity


@router.put("/{payment_id}", response_model=schemas.PaymentResponse)
def update_payment(payment_id: int, payload: schemas.PaymentUpdate, db: Session = Depends(get_db)):
    entity = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="付款记录不存在")

    update_data = payload.model_dump(exclude_unset=True)
    if "contract_id" in update_data:
        contract = db.query(models.Contract).filter(models.Contract.id == update_data["contract_id"]).first()
        if not contract:
            raise HTTPException(status_code=400, detail="所属合同不存在")

    for key, value in update_data.items():
        setattr(entity, key, value)

    entity.pending_amount = _calc_pending_amount(entity.planned_amount, entity.actual_amount)

    db.commit()
    db.refresh(entity)
    return entity


@router.delete("/{payment_id}")
def delete_payment(payment_id: int, db: Session = Depends(get_db)):
    entity = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="付款记录不存在")

    db.delete(entity)
    db.commit()
    return {"message": "删除成功"}
