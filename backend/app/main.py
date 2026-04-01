"""FastAPI 应用入口。"""

import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from .database import Base, engine
from .routers import contracts, dashboard, exports, imports, payments, projects, settings

logger = logging.getLogger(__name__)

# 启动时自动创建表结构。
Base.metadata.create_all(bind=engine)

app = FastAPI(title="项目合同付款管理系统 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://127.0.0.1",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"^https?://((localhost|127\.0\.0\.1)|((\d{1,3}\.){3}\d{1,3}))(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException):
    """统一返回业务错误。"""
    return JSONResponse(status_code=exc.status_code, content={"message": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError):
    """统一返回请求参数校验错误。"""
    return JSONResponse(
        status_code=422,
        content={"message": "请求参数校验失败", "errors": exc.errors()},
    )


@app.exception_handler(IntegrityError)
async def integrity_error_handler(_: Request, exc: IntegrityError):
    """统一处理数据库约束异常。"""
    logger.warning("数据库约束冲突: %s", exc)
    return JSONResponse(status_code=400, content={"message": "数据冲突，请检查唯一编号或关联数据"})


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(_: Request, exc: SQLAlchemyError):
    """统一处理数据库异常。"""
    logger.exception("数据库异常: %s", exc)
    return JSONResponse(status_code=500, content={"message": "数据库处理失败，请稍后重试"})


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception):
    """兜底处理未捕获异常。"""
    logger.exception("未处理异常: %s", exc)
    return JSONResponse(status_code=500, content={"message": "服务器内部错误"})


app.include_router(projects.router)
app.include_router(contracts.router)
app.include_router(payments.router)
app.include_router(dashboard.router)
app.include_router(imports.router)
app.include_router(exports.router)
app.include_router(settings.router)


@app.get("/")
def health_check():
    """健康检查接口。"""
    return {"message": "后端服务运行正常"}
