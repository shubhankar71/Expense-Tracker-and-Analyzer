import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from database import init_db
from rate_limit import limiter
from routes.auth_routes import router as auth_router
from routes.transactions import router as transactions_router
from routes.analytics import router as analytics_router
from routes.reviews import router as reviews_router

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(title="Finance Tracker", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.include_router(auth_router)
app.include_router(transactions_router)
app.include_router(analytics_router)
app.include_router(reviews_router)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
async def home():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))
    

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
