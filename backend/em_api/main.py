from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from em_api.config import settings
from em_api.middleware.x402 import X402Middleware
from em_api.routes import dashboard, disputes, executors, health, leaderboard, tasks, wallet_activity, world_id


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield


app = FastAPI(title="Agent Zero API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(X402Middleware)
app.include_router(health.router)
app.include_router(tasks.router)
app.include_router(world_id.router)
app.include_router(executors.router)
app.include_router(leaderboard.router)
app.include_router(wallet_activity.router)
app.include_router(dashboard.router)
app.include_router(disputes.router)


@app.get("/")
def root() -> dict:
    return {"name": "execution-market-backend", "docs": "/docs"}
