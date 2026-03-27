"""合同与合同子资源路由。"""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from .. import models, schemas

router = APIRouter(prefix="/api/contracts", tags=["合同"])


def _calc_pending_amount(planned_amount: Decimal | None, actual_amount: Decimal | None) -> Decimal | None:
    """计算待付款金额。"""
    if planned_amount is None and actual_amount is None:
        return None
    planned = planned_amount or Decimal("0")
    actual = actual_amount or Decimal("0")
    return planned - actual


@router.get("", response_model=list[schemas.ContractResponse])
def list_contracts(db: Session = Depends(get_db)):
    data = (
        db.query(models.Contract)
        .options(
            joinedload(models.Contract.items),
            joinedload(models.Contract.payments),
            joinedload(models.Contract.changes),
        )
        .order_by(models.Contract.id.desc())
        .all()
    )
    return data


@router.get("/{contract_id}", response_model=schemas.ContractResponse)
def get_contract(contract_id: int, db: Session = Depends(get_db)):
    entity = (
        db.query(models.Contract)
        .options(
            joinedload(models.Contract.items),
            joinedload(models.Contract.payments),
            joinedload(models.Contract.changes),
        )
        .filter(models.Contract.id == contract_id)
        .first()
    )
    if not entity:
        raise HTTPException(status_code=404, detail="合同不存在")
    return entity


@router.post("", response_model=schemas.ContractResponse)
def create_contract(payload: schemas.ContractCreate, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=400, detail="所属项目不存在")

    contract_data = payload.model_dump(exclude={"items", "payments"})
    entity = models.Contract(**contract_data)
    db.add(entity)
    db.flush()

    for item in payload.items:
        db.add(models.ContractItem(contract_id=entity.id, **item.model_dump()))

    for payment in payload.payments:
        payment_data = payment.model_dump()
        payment_data["pending_amount"] = _calc_pending_amount(
            payment_data.get("planned_amount"), payment_data.get("actual_amount")
        )
        db.add(models.Payment(contract_id=entity.id, **payment_data))

    db.commit()
    db.refresh(entity)
    return get_contract(entity.id, db)


@router.put("/{contract_id}", response_model=schemas.ContractResponse)
def update_contract(contract_id: int, payload: schemas.ContractUpdate, db: Session = Depends(get_db)):
    entity = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="合同不存在")

    update_data = payload.model_dump(exclude_unset=True)
    if "project_id" in update_data:
        project = db.query(models.Project).filter(models.Project.id == update_data["project_id"]).first()
        if not project:
            raise HTTPException(status_code=400, detail="所属项目不存在")

    for key, value in update_data.items():
        setattr(entity, key, value)

    db.commit()
    db.refresh(entity)
    return get_contract(entity.id, db)


@router.delete("/{contract_id}")
def delete_contract(contract_id: int, db: Session = Depends(get_db)):
    entity = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="合同不存在")

    has_item = db.query(models.ContractItem).filter(models.ContractItem.contract_id == contract_id).first()
    has_payment = db.query(models.Payment).filter(models.Payment.contract_id == contract_id).first()
    has_change = db.query(models.ContractChange).filter(models.ContractChange.contract_id == contract_id).first()
    if has_item or has_payment or has_change:
        raise HTTPException(status_code=400, detail="合同下存在子记录，禁止删除")

    db.delete(entity)
    db.commit()
    return {"message": "删除成功"}


@router.get("/{contract_id}/items", response_model=list[schemas.ContractItemResponse])
def list_items(contract_id: int, db: Session = Depends(get_db)):
    contract = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="合同不存在")
    return db.query(models.ContractItem).filter(models.ContractItem.contract_id == contract_id).all()


@router.post("/{contract_id}/items", response_model=schemas.ContractItemResponse)
def create_item(contract_id: int, payload: schemas.ContractItemCreate, db: Session = Depends(get_db)):
    contract = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="合同不存在")

    entity = models.ContractItem(contract_id=contract_id, **payload.model_dump())
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return entity


@router.put("/{contract_id}/items/{item_id}", response_model=schemas.ContractItemResponse)
def update_item(
    contract_id: int,
    item_id: int,
    payload: schemas.ContractItemUpdate,
    db: Session = Depends(get_db),
):
    entity = (
        db.query(models.ContractItem)
        .filter(models.ContractItem.id == item_id, models.ContractItem.contract_id == contract_id)
        .first()
    )
    if not entity:
        raise HTTPException(status_code=404, detail="合同明细不存在")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(entity, key, value)

    db.commit()
    db.refresh(entity)
    return entity


@router.delete("/{contract_id}/items/{item_id}")
def delete_item(contract_id: int, item_id: int, db: Session = Depends(get_db)):
    entity = (
        db.query(models.ContractItem)
        .filter(models.ContractItem.id == item_id, models.ContractItem.contract_id == contract_id)
        .first()
    )
    if not entity:
        raise HTTPException(status_code=404, detail="合同明细不存在")

    db.delete(entity)
    db.commit()
    return {"message": "删除成功"}


@router.get("/{contract_id}/changes", response_model=list[schemas.ContractChangeResponse])
def list_changes(contract_id: int, db: Session = Depends(get_db)):
    contract = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="合同不存在")
    return db.query(models.ContractChange).filter(models.ContractChange.contract_id == contract_id).all()


@router.post("/{contract_id}/changes", response_model=schemas.ContractChangeResponse)
def create_change(contract_id: int, payload: schemas.ContractChangeCreate, db: Session = Depends(get_db)):
    contract = db.query(models.Contract).filter(models.Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="合同不存在")

    entity = models.ContractChange(contract_id=contract_id, **payload.model_dump())
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return entity


@router.put("/{contract_id}/changes/{change_id}", response_model=schemas.ContractChangeResponse)
def update_change(
    contract_id: int,
    change_id: int,
    payload: schemas.ContractChangeUpdate,
    db: Session = Depends(get_db),
):
    entity = (
        db.query(models.ContractChange)
        .filter(models.ContractChange.id == change_id, models.ContractChange.contract_id == contract_id)
        .first()
    )
    if not entity:
        raise HTTPException(status_code=404, detail="变更记录不存在")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(entity, key, value)

    db.commit()
    db.refresh(entity)
    return entity


@router.delete("/{contract_id}/changes/{change_id}")
def delete_change(contract_id: int, change_id: int, db: Session = Depends(get_db)):
    entity = (
        db.query(models.ContractChange)
        .filter(models.ContractChange.id == change_id, models.ContractChange.contract_id == contract_id)
        .first()
    )
    if not entity:
        raise HTTPException(status_code=404, detail="变更记录不存在")

    db.delete(entity)
    db.commit()
    return {"message": "删除成功"}
