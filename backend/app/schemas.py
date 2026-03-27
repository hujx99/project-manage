"""Pydantic 数据校验模型。"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ProjectBase(BaseModel):
    project_code: str
    project_name: str
    project_type: Optional[str] = None
    start_date: Optional[date] = None
    status: str
    budget: Optional[Decimal] = None
    manager: Optional[str] = None
    remark: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    project_code: Optional[str] = None
    project_name: Optional[str] = None
    project_type: Optional[str] = None
    start_date: Optional[date] = None
    status: Optional[str] = None
    budget: Optional[Decimal] = None
    manager: Optional[str] = None
    remark: Optional[str] = None


class ProjectResponse(ProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[ProjectResponse]


class ContractItemBase(BaseModel):
    seq: int
    item_name: str
    quantity: Decimal
    unit: Optional[str] = None
    unit_price: Optional[Decimal] = None
    amount: Decimal


class ContractItemCreate(ContractItemBase):
    pass


class ContractItemUpdate(BaseModel):
    seq: Optional[int] = None
    item_name: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit: Optional[str] = None
    unit_price: Optional[Decimal] = None
    amount: Optional[Decimal] = None


class ContractItemResponse(ContractItemBase):
    id: int
    contract_id: int

    model_config = ConfigDict(from_attributes=True)


class PaymentBase(BaseModel):
    seq: Optional[int] = None
    phase: Optional[str] = None
    planned_date: Optional[date] = None
    planned_amount: Optional[Decimal] = None
    actual_date: Optional[date] = None
    actual_amount: Optional[Decimal] = None
    payment_status: str
    description: Optional[str] = None
    remark: Optional[str] = None


class PaymentCreate(PaymentBase):
    contract_id: int


class PaymentCreateInContract(PaymentBase):
    pass


class PaymentUpdate(BaseModel):
    contract_id: Optional[int] = None
    seq: Optional[int] = None
    phase: Optional[str] = None
    planned_date: Optional[date] = None
    planned_amount: Optional[Decimal] = None
    actual_date: Optional[date] = None
    actual_amount: Optional[Decimal] = None
    payment_status: Optional[str] = None
    description: Optional[str] = None
    remark: Optional[str] = None


class PaymentResponse(PaymentBase):
    id: int
    contract_id: int
    pending_amount: Optional[Decimal] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ContractChangeBase(BaseModel):
    seq: int
    change_date: date
    change_info: Optional[str] = None
    before_content: Optional[str] = None
    after_content: Optional[str] = None
    change_description: Optional[str] = None


class ContractChangeCreate(ContractChangeBase):
    pass


class ContractChangeUpdate(BaseModel):
    seq: Optional[int] = None
    change_date: Optional[date] = None
    change_info: Optional[str] = None
    before_content: Optional[str] = None
    after_content: Optional[str] = None
    change_description: Optional[str] = None


class ContractChangeResponse(ContractChangeBase):
    id: int
    contract_id: int

    model_config = ConfigDict(from_attributes=True)


class ContractBase(BaseModel):
    project_id: int
    contract_code: str
    contract_name: str
    procurement_type: Optional[str] = None
    cost_department: Optional[str] = None
    vendor: Optional[str] = None
    amount: Decimal
    amount_before_change: Optional[Decimal] = None
    sign_date: Optional[date] = None
    filing_date: Optional[date] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    parent_contract_code: Optional[str] = None
    renewal_type: Optional[str] = None
    payment_direction: Optional[str] = None
    status: str
    filing_reference: Optional[str] = None
    remark: Optional[str] = None


class ContractCreate(ContractBase):
    items: list[ContractItemCreate] = Field(default_factory=list)
    payments: list[PaymentCreateInContract] = Field(default_factory=list)


class ContractUpdate(BaseModel):
    project_id: Optional[int] = None
    contract_code: Optional[str] = None
    contract_name: Optional[str] = None
    procurement_type: Optional[str] = None
    cost_department: Optional[str] = None
    vendor: Optional[str] = None
    amount: Optional[Decimal] = None
    amount_before_change: Optional[Decimal] = None
    sign_date: Optional[date] = None
    filing_date: Optional[date] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    parent_contract_code: Optional[str] = None
    renewal_type: Optional[str] = None
    payment_direction: Optional[str] = None
    status: Optional[str] = None
    filing_reference: Optional[str] = None
    remark: Optional[str] = None


class ContractResponse(ContractBase):
    id: int
    created_at: datetime
    updated_at: datetime
    items: list[ContractItemResponse] = Field(default_factory=list)
    payments: list[PaymentResponse] = Field(default_factory=list)
    changes: list[ContractChangeResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


