from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, field_validator, model_validator
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
    amount: float
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
