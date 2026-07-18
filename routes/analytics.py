from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Transaction, User
from schemas import AnalyticsSummary
from auth import get_current_user

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


async def get_total_by_type(db: AsyncSession, user_id: int, t_type: str) -> float:
    result = await db.execute(
        select(func.sum(Transaction.amount)).where(Transaction.type == t_type, Transaction.user_id == user_id)
    )
    total = result.scalar()
    return float(total) if total else 0.0


@router.get("/summary", response_model=AnalyticsSummary)
async def summary(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    income = await get_total_by_type(db, user.id, "income")
    expense = await get_total_by_type(db, user.id, "expense")
    return AnalyticsSummary(total_income=income, total_expense=expense, balance=income - expense)