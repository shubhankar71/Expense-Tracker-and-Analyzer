from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User, PasswordResetOTP
from schemas import UserCreate, UserOut, Token, ForgotPasswordRequest, ResetPasswordRequest
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    generate_otp,
    hash_otp,
    verify_otp,
    get_current_user,
)
from email_utils import send_otp_email
from rate_limit import limiter

router = APIRouter(prefix="/api/auth", tags=["auth"])

OTP_EXPIRE_MINUTES = 10


@router.post("/register", response_model=UserOut, status_code=201)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    existing_username = await db.execute(select(User).where(User.username == payload.username))
    if existing_username.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken")

    existing_email = await db.execute(select(User).where(User.email == payload.email))
    if existing_email.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    identifier = form_data.username
    result = await db.execute(
        select(User).where(or_(User.username == identifier, User.email == identifier))
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username/email or password")

    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)):
    return user


@router.post("/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(request: Request, payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if user:
        otp = generate_otp()
        record = PasswordResetOTP(
            user_id=user.id,
            otp_hash=hash_otp(otp),
            expires_at=datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES),
        )
        db.add(record)
        await db.commit()
        send_otp_email(user.email, otp)

    return {"message": "If that email is registered, an OTP has been sent."}


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid email or OTP")

    otp_result = await db.execute(
        select(PasswordResetOTP)
        .where(PasswordResetOTP.user_id == user.id, PasswordResetOTP.used == False)  # noqa: E712
        .order_by(PasswordResetOTP.created_at.desc())
    )
    record = otp_result.scalars().first()

    if (
        not record
        or record.expires_at < datetime.utcnow()
        or not verify_otp(payload.otp, record.otp_hash)
    ):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    user.hashed_password = hash_password(payload.new_password)
    record.used = True
    await db.commit()

    return {"message": "Password reset successfully. You can now log in."}
