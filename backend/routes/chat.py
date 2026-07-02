"""HTTP routes for /api/chat — single LLM-backed chat turn."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.dependencies import get_current_user
from database import User
from models.chat import ChatRequest
from models.documents import is_known
from services.ai_service import chat as ai_chat

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("")
async def post_chat(
    body: ChatRequest,
    _: User = Depends(get_current_user),
) -> dict:
    """Run one chat turn. The LLM picks the document type from the user's
    message and returns the chosen id alongside the field snapshot and
    assistant reply.
    """
    if body.document_type is not None and not is_known(body.document_type):
        raise HTTPException(status_code=400, detail="unknown document type")

    messages = [m.model_dump() for m in body.messages]
    turn = ai_chat(messages, hint=body.document_type)
    return turn.model_dump()