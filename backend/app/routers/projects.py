"""项目管理路由。"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas

router = APIRouter(prefix="/api/projects", tags=["项目"])


@router.get("", response_model=dict)
def list_projects(
    status: str | None = Query(default=None, description="按状态筛选"),
    search: str | None = Query(default=None, description="编号或名称模糊搜索"),
    page: int = Query(default=1, ge=1, description="页码，从 1 开始"),
    page_size: int = Query(default=10, ge=1, le=100, description="每页条数"),
    db: Session = Depends(get_db),
):
    query = db.query(models.Project)
    if status:
        query = query.filter(models.Project.status == status)
    if search:
        like_text = f"%{search}%"
        query = query.filter(
            or_(models.Project.project_code.like(like_text), models.Project.project_name.like(like_text))
        )

    total = query.count()
    data = (
        query.order_by(models.Project.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [schemas.ProjectResponse.model_validate(item).model_dump() for item in data],
    }


@router.get("/{project_id}", response_model=schemas.ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


@router.post("", response_model=schemas.ProjectResponse)
def create_project(payload: schemas.ProjectCreate, db: Session = Depends(get_db)):
    entity = models.Project(**payload.model_dump())
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return entity


@router.put("/{project_id}", response_model=schemas.ProjectResponse)
def update_project(project_id: int, payload: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    entity = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="项目不存在")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(entity, key, value)

    db.commit()
    db.refresh(entity)
    return entity


@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    entity = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="项目不存在")

    has_contracts = (
        db.query(models.Contract).filter(models.Contract.project_id == project_id).first() is not None
    )
    if has_contracts:
        raise HTTPException(status_code=400, detail="项目下存在合同，禁止删除")

    db.delete(entity)
    db.commit()
    return {"message": "删除成功"}
