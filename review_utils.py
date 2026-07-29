from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Transaction

PERIOD_DAYS = {
    "last_week": 7,
    "past_2_weeks": 14,
    "past_4_weeks": 28,
    "past_12_weeks": 84,
}

PERIOD_LABELS = {
    "last_week": "Last 7 Days",
    "past_2_weeks": "Past 2 Weeks",
    "past_4_weeks": "Past 4 Weeks",
    "past_12_weeks": "Past 12 Weeks",
}


async def compute_period_stats(db: AsyncSession, user_id: int, period: str) -> dict:
    days = PERIOD_DAYS[period]
    period_end = datetime.utcnow()
    period_start = period_end - timedelta(days=days)

    result = await db.execute(
        select(Transaction).where(
            Transaction.user_id == user_id,
            Transaction.date >= period_start,
            Transaction.date <= period_end,
        )
    )
    transactions = result.scalars().all()

    total_income = sum(t.amount for t in transactions if t.type == "income")
    total_expense = sum(t.amount for t in transactions if t.type == "expense")
    balance = total_income - total_expense

    category_breakdown: dict[str, float] = {}
    for t in transactions:
        if t.type == "expense":
            category_breakdown[t.category] = category_breakdown.get(t.category, 0.0) + t.amount

    return {
        "period_label": PERIOD_LABELS[period],
        "period_start": period_start,
        "period_end": period_end,
        "total_income": total_income,
        "total_expense": total_expense,
        "balance": balance,
        "category_breakdown": category_breakdown,
    }
