from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Transaction, User
from schemas import TransactionCreate, TransactionOut
from auth import get_current_user

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.post("", response_model=TransactionOut, status_code=201)
async def add_transaction(payload: TransactionCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    tx = Transaction(**payload.model_dump(), user_id=user.id)
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return tx


@router.get("", response_model=list[TransactionOut])
async def get_transactions(category: str | None = None, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = select(Transaction).where(Transaction.user_id == user.id)
    if category:
        stmt = stmt.where(Transaction.category == category)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.delete("/{tx_id}")
async def delete_transaction(tx_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    tx = await db.get(Transaction, tx_id)
    if not tx or tx.user_id != user.id:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await db.execute(delete(Transaction).where(Transaction.id == tx_id))
    await db.commit()
    return {"message": "Deleted successfully"}