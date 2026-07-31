from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator
from review_utils import PERIOD_DAYS

INCOME_CATEGORIES = {"Salary"}
EXPENSE_CATEGORIES = {
    "Rent",
    "Grocery",
    "Travel Cost",
    "Vehicle Repair",
    "Health + Medication",
    "Other",
}
ALLOWED_CATEGORIES = INCOME_CATEGORIES | EXPENSE_CATEGORIES


class TransactionCreate(BaseModel):
    amount: float = Field(gt=0)
    type: str
    category: str
    notes: str | None = ""

    @field_validator("type")
    @classmethod
    def validate_type(cls, v):
        v = v.lower()
        if v not in ("income", "expense"):
            raise ValueError("type must be 'income' or 'expense'")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v):
        if v not in ALLOWED_CATEGORIES:
            raise ValueError(f"category must be one of {sorted(ALLOWED_CATEGORIES)}")
        return v

    @model_validator(mode="after")
    def validate_category_matches_type(self):
        if self.type == "income" and self.category not in INCOME_CATEGORIES:
            raise ValueError(
                f"category '{self.category}' is not valid for type 'income'; "
                f"expected one of {sorted(INCOME_CATEGORIES)}"
            )
        if self.type == "expense" and self.category not in EXPENSE_CATEGORIES:
            raise ValueError(
                f"category '{self.category}' is not valid for type 'expense'; "
                f"expected one of {sorted(EXPENSE_CATEGORIES)}"
            )
        return self


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
    email: EmailStr
    username: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str


class ReviewGenerateRequest(BaseModel):
    period: str

    @field_validator("period")
    @classmethod
    def validate_period(cls, v):
        if v not in PERIOD_DAYS:
            raise ValueError(f"period must be one of {list(PERIOD_DAYS)}")
        return v


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    period_label: str
    period_start: datetime
    period_end: datetime
    total_income: float
    total_expense: float
    balance: float
    category_breakdown: dict
    expense_review: str
    income_review: str
    savings_advice: str
    is_auto_generated: bool
    generated_at: datetime
