"""HTTP routes for /api/chat/* — greeting + message."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.dependencies import get_current_user, get_db
from database import User
from models.chat import ChatRequest, ChatResponse
from services.ai_service import chat as ai_chat
from services.ai_service import greeting as ai_greeting

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.get("/greeting", response_model=ChatResponse)
async def get_greeting(
    _: User = Depends(get_current_user),
) -> dict:
    """Return the static greeting without an LLM call."""
    return ai_greeting()


@router.post("/message", response_model=ChatResponse)
async def post_message(
    body: ChatRequest,
    _: User = Depends(get_current_user),
) -> ChatResponse:
    """Run one chat turn. The LLM picks the document type from the user's
    message and returns the chosen slug alongside the field snapshot and
    assistant reply.
    """
    messages = [m.model_dump() for m in body.messages]
    return ai_chat(messages)