import os
import json
import math
from openai import AsyncOpenAI

from knowledge_base import TIPS

EMBEDDING_MODEL = "text-embedding-3-small"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_PATH = os.path.join(BASE_DIR, "knowledge_embeddings.json")

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
_client = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


async def _embed(text: str) -> list[float]:
    response = await _client.embeddings.create(model=EMBEDDING_MODEL, input=text)
    return response.data[0].embedding


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


async def build_knowledge_index() -> list[dict]:
    """Embeds every tip in TIPS and caches the result to disk. Only needs to
    re-run when TIPS changes, since embeddings for fixed text never change."""
    if not _client:
        raise RuntimeError("OPENAI_API_KEY is not set; cannot build embeddings.")

    indexed = []
    for tip in TIPS:
        indexed.append({
            "id": tip["id"],
            "category": tip["category"],
            "text": tip["text"],
            "embedding": await _embed(tip["text"]),
        })

    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(indexed, f)
    return indexed


def _load_index() -> list[dict] | None:
    if os.path.exists(CACHE_PATH):
        with open(CACHE_PATH, "r", encoding="utf-8") as f:
            cached = json.load(f)
        if len(cached) == len(TIPS):
            return cached
    return None


async def retrieve_relevant_tips(category_breakdown: dict, top_k: int = 3) -> list[str]:
    """Returns the top_k most relevant budgeting tips for the user's current
    spending pattern. Uses embedding similarity when an OpenAI key is
    configured; falls back to category keyword matching otherwise, so the
    app still gives grounded advice with zero API dependency."""
    if not category_breakdown:
        query_text = "general budgeting and savings advice"
        sorted_cats = []
    else:
        sorted_cats = sorted(category_breakdown.items(), key=lambda kv: kv[1], reverse=True)
        query_text = "Top spending categories: " + ", ".join(c for c, _ in sorted_cats)

    if _client:
        index = _load_index()
        if index is None:
            index = await build_knowledge_index()
        query_embedding = await _embed(query_text)
        scored = [
            (_cosine_similarity(query_embedding, doc["embedding"]), doc["text"])
            for doc in index
        ]
        scored.sort(key=lambda x: x[0], reverse=True)
        return [text for _, text in scored[:top_k]]

    # No API key configured: fall back to keyword matching on category name.
    top_categories = {c.lower() for c, _ in sorted_cats[:top_k]}
    matches = [t["text"] for t in TIPS if t["category"] in top_categories]
    if not matches:
        matches = [t["text"] for t in TIPS if t["category"] == "general"]
    return matches[:top_k]
