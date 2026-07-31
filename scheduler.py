from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

from database import SessionLocal
from models import User, Transaction, Review
from llm_review import generate_review
from review_utils import compute_period_stats

scheduler = AsyncIOScheduler()


async def generate_weekly_reviews_for_active_users():
    async with SessionLocal() as db:
        week_ago = datetime.utcnow() - timedelta(days=7)

        # Active = has logged at least one transaction in the last 7 days.
        result = await db.execute(
            select(User.id)
            .join(Transaction, Transaction.user_id == User.id)
            .where(Transaction.date >= week_ago)
            .distinct()
        )
        active_user_ids = [row[0] for row in result.all()]

        for user_id in active_user_ids:
            stats = await compute_period_stats(db, user_id, "last_week")
            review_text = await generate_review(
                stats["period_label"], stats["total_income"], stats["total_expense"],
                stats["balance"], stats["category_breakdown"],
            )
            db.add(Review(
                user_id=user_id,
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
                is_auto_generated=True,
            ))
        await db.commit()


def start_scheduler():
    scheduler.add_job(
        generate_weekly_reviews_for_active_users,
        CronTrigger(day_of_week="sun", hour=23, minute=0),
        id="weekly_review_job",
        replace_existing=True,
    )
    scheduler.start()


def stop_scheduler():
    scheduler.shutdown(wait=False)
