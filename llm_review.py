import os
import json
from openai import OpenAI

from rag import retrieve_relevant_tips

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


def generate_review(period_label: str, total_income: float, total_expense: float,
                     balance: float, category_breakdown: dict) -> dict:
    """Calls OpenAI to produce a 3-part financial review. Falls back to a
    simple templated review if no API key is configured or the call fails."""

    relevant_tips = retrieve_relevant_tips(category_breakdown)

    if not _client:
        return _fallback_review(total_income, total_expense, balance, category_breakdown, relevant_tips)

    category_lines = "\n".join(
        f"- {cat}: Rs.{amt:.2f}" for cat, amt in category_breakdown.items()
    ) or "- No expenses recorded"

    tips_lines = "\n".join(f"- {tip}" for tip in relevant_tips) or "- No specific guidance available"

    prompt = f"""You are a friendly personal finance assistant. Analyze the user's
finances for the period "{period_label}" and respond ONLY with a JSON object
with exactly these keys: "expense_review", "income_review", "savings_advice".
Each value should be 2-4 sentences, plain language, no markdown formatting.

Data:
Total income: Rs.{total_income:.2f}
Total expense: Rs.{total_expense:.2f}
Balance: Rs.{balance:.2f}
Expense breakdown by category:
{category_lines}

Relevant budgeting guidance to ground your savings_advice in (paraphrase
naturally in your own words, don't quote verbatim, and only use what's
actually relevant to this user's numbers above):
{tips_lines}
"""

    try:
        response = _client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.7,
        )
        parsed = json.loads(response.choices[0].message.content)
        return {
            "expense_review": parsed.get("expense_review", ""),
            "income_review": parsed.get("income_review", ""),
            "savings_advice": parsed.get("savings_advice", ""),
        }
    except Exception:
        return _fallback_review(total_income, total_expense, balance, category_breakdown, relevant_tips)


def _fallback_review(total_income, total_expense, balance, category_breakdown, relevant_tips=None):
    if relevant_tips is None:
        relevant_tips = retrieve_relevant_tips(category_breakdown)

    top_category = max(category_breakdown, key=category_breakdown.get) if category_breakdown else None

    savings_advice = f"Your balance for this period is Rs.{balance:.2f}. "
    savings_advice += relevant_tips[0] if relevant_tips else (
        "Consider setting aside a fixed percentage of your income each week toward savings."
    )

    return {
        "expense_review": (
            f"You spent a total of Rs.{total_expense:.2f} this period."
            + (f" Your biggest expense category was {top_category}." if top_category else " No expenses were recorded.")
        ),
        "income_review": f"You earned Rs.{total_income:.2f} in this period.",
        "savings_advice": savings_advice,
    }
