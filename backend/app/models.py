"""ORM 模型定义。"""

from sqlalchemy import DECIMAL, Column, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from .database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    project_code = Column(String(50), unique=True, nullable=False, index=True)
    project_name = Column(String(300), nullable=False, index=True)
    project_type = Column(String(50), nullable=True)
    start_date = Column(Date, nullable=True)
    status = Column(String(20), nullable=False, index=True)
    budget = Column(DECIMAL(14, 2), nullable=True)
    manager = Column(String(50), nullable=True)
    remark = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    contracts = relationship("Contract", back_populates="project", order_by="Contract.id.desc()")


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False, index=True)
    contract_code = Column(String(80), unique=True, nullable=False, index=True)
    contract_name = Column(String(500), nullable=False)
    procurement_type = Column(String(50), nullable=True)
    cost_department = Column(String(100), nullable=True)
    vendor = Column(String(200), nullable=True)
    amount = Column(DECIMAL(14, 2), nullable=False)
    amount_before_change = Column(DECIMAL(14, 2), nullable=True)
    sign_date = Column(Date, nullable=True)
    filing_date = Column(Date, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    parent_contract_code = Column(String(80), nullable=True)
    renewal_type = Column(String(50), nullable=True)
    payment_direction = Column(String(10), nullable=True)
    status = Column(String(20), nullable=False, index=True)
    filing_reference = Column(Text, nullable=True)
    remark = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    project = relationship("Project", back_populates="contracts")
    items = relationship("ContractItem", back_populates="contract", order_by="ContractItem.seq")
    payments = relationship("Payment", back_populates="contract", order_by="Payment.seq")
    changes = relationship("ContractChange", back_populates="contract", order_by="ContractChange.seq")


class ContractItem(Base):
    __tablename__ = "contract_items"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id", ondelete="RESTRICT"), nullable=False, index=True)
    seq = Column(Integer, nullable=False)
    item_name = Column(String(200), nullable=False)
    quantity = Column(DECIMAL(10, 2), nullable=False)
    unit = Column(String(20), nullable=True)
    unit_price = Column(DECIMAL(14, 2), nullable=True)
    amount = Column(DECIMAL(14, 2), nullable=False)

    contract = relationship("Contract", back_populates="items")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id", ondelete="RESTRICT"), nullable=False, index=True)
    seq = Column(Integer, nullable=True)
    phase = Column(String(100), nullable=True)
    planned_date = Column(Date, nullable=True)
    planned_amount = Column(DECIMAL(14, 2), nullable=True)
    actual_date = Column(Date, nullable=True)
    actual_amount = Column(DECIMAL(14, 2), nullable=True)
    pending_amount = Column(DECIMAL(14, 2), nullable=True)
    payment_status = Column(String(20), nullable=False, index=True)
    description = Column(String(500), nullable=True)
    remark = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    contract = relationship("Contract", back_populates="payments")


class ContractChange(Base):
    __tablename__ = "contract_changes"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id", ondelete="RESTRICT"), nullable=False, index=True)
    seq = Column(Integer, nullable=False)
    change_date = Column(Date, nullable=False)
    change_info = Column(String(500), nullable=True)
    before_content = Column(Text, nullable=True)
    after_content = Column(Text, nullable=True)
    change_description = Column(Text, nullable=True)

    contract = relationship("Contract", back_populates="changes")
