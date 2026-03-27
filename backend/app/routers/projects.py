"""项目管理路由。"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/projects", tags=["项目"])

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


@router.get("", response_model=schemas.ProjectListResponse)
def list_projects(
    status: str | None = Query(default=None, description="按状态筛选"),
    exclude_statuses: str | None = Query(default=None, description="排除的状态，多个用逗号分隔"),
    search: str | None = Query(default=None, description="按编号或名称搜索"),
    sort_field: str = Query(default="start_date", description="排序字段"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$", description="排序方向"),
    page: int = Query(default=1, ge=1, description="页码，从 1 开始"),
    page_size: int = Query(default=10, ge=1, le=100, description="每页条数"),
    db: Session = Depends(get_db),
):
    """分页查询项目列表。"""
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

    total = query.count()
    sort_column = PROJECT_SORT_FIELDS.get(sort_field, models.Project.start_date)
    if sort_order == "asc":
        query = query.order_by(sort_column.asc(), models.Project.id.desc())
    else:
        query = query.order_by(sort_column.desc(), models.Project.id.desc())

    items = query.offset((page - 1) * page_size).limit(page_size).all()

    project_ids = [p.id for p in items]
    counts: dict[int, int] = {}
    if project_ids:
        rows = (
            db.query(models.Contract.project_id, func.count(models.Contract.id))
            .filter(models.Contract.project_id.in_(project_ids))
            .group_by(models.Contract.project_id)
            .all()
        )
        counts = {row[0]: row[1] for row in rows}

    response_items = []
    for p in items:
        item = schemas.ProjectResponse.model_validate(p)
        item.contract_count = counts.get(p.id, 0)
        response_items.append(item)

    return schemas.ProjectListResponse(total=total, page=page, page_size=page_size, items=response_items)


@router.get("/{project_id}", response_model=schemas.ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    """查询项目详情。"""
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    item = schemas.ProjectResponse.model_validate(project)
    item.contract_count = len(project.contracts)
    return item


@router.post("", response_model=schemas.ProjectResponse)
def create_project(payload: schemas.ProjectCreate, db: Session = Depends(get_db)):
    """创建项目。"""
    entity = models.Project(**payload.model_dump())
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return entity


@router.put("/{project_id}", response_model=schemas.ProjectResponse)
def update_project(project_id: int, payload: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    """更新项目。"""
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
    """删除项目。"""
    entity = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="项目不存在")

    has_contracts = db.query(models.Contract).filter(models.Contract.project_id == project_id).first() is not None
    if has_contracts:
        raise HTTPException(status_code=400, detail="项目下存在合同，禁止删除")

    db.delete(entity)
    db.commit()
    return {"message": "删除成功"}
