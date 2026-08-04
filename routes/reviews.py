from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User, Review
from schemas import ReviewGenerateRequest, ReviewOut
from auth import get_current_user
from llm_review import generate_review
from review_utils import compute_period_stats

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


@router.post("/generate", response_model=ReviewOut)
async def generate_user_review(
    payload: ReviewGenerateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stats = await compute_period_stats(db, user.id, payload.period)

    review_text = await generate_review(
        stats["period_label"], stats["total_income"], stats["total_expense"],
        stats["balance"], stats["category_breakdown"],
    )

    review = Review(
        user_id=user.id,
        period_label=stats["period_label"],
        period_start=stats["period_start"],
        period_end=stats["period_end"],
        total_income=stats["total_income"],
        total_expense=stats["total_expense"],
        balance=stats["balance"],
        category_breakdown=stats["category_breakdown"],
        expense_review=review_text["expense_review"],
        income_review=review_text["income_review"],
        savings_advice=review_text["savings_advice"],
        is_auto_generated=False,
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return review
