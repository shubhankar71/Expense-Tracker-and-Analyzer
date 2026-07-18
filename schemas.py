from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator


class TransactionCreate(BaseModel):
    amount: float
    type: str
    category: str = "Other"
    notes: str | None = ""

    @field_validator("type")
    @classmethod
    def validate_type(cls, v):
        v = v.lower()
        if v not in ("income", "expense"):
            raise ValueError("type must be 'income' or 'expense'")
        return v



class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount: float
    type: str
    category: str
    date: datetime
    notes: str | None


class AnalyticsSummary(BaseModel):
    total_income: float
    total_expense: float
    balance: float
    
class UserCreate(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"