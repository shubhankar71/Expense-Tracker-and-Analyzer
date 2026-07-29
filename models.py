from datetime import datetime
from sqlalchemy import String, Float, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    type: Mapped[str] = mapped_column(String(10), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    notes: Mapped[str | None] = mapped_column(String(200), nullable=True)


class PasswordResetOTP(Base):
    __tablename__ = "password_reset_otps"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    otp_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    period_label: Mapped[str] = mapped_column(String(50), nullable=False)
    period_start: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    total_income: Mapped[float] = mapped_column(Float, default=0.0)
    total_expense: Mapped[float] = mapped_column(Float, default=0.0)
    balance: Mapped[float] = mapped_column(Float, default=0.0)
    category_breakdown: Mapped[dict] = mapped_column(JSON, default=dict)
    expense_review: Mapped[str] = mapped_column(Text, nullable=False)
    income_review: Mapped[str] = mapped_column(Text, nullable=False)
    savings_advice: Mapped[str] = mapped_column(Text, nullable=False)
    is_auto_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
