"""HTTP routes for /api/documents — CRUD over saved drafts."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.dependencies import get_current_user, get_db
from database import User
from models.documents import DocumentSaveRequest, is_known, validate_document_data
from services.document_service import DocumentService

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.get("")
async def list_documents(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """List the signed-in user's saved drafts (newest first)."""
    return {"documents": DocumentService.list_for_user(db, user.id)}


@router.post("")
async def post_document(
    body: DocumentSaveRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Save a new draft. Validates `data` against the per-doc schema."""
    if not is_known(body.document_type):
        raise HTTPException(status_code=400, detail="unknown document type")
    data = validate_document_data(body.document_type, body.data)
    doc_id = DocumentService.create(
        db, user.id, body.document_type, body.title, data
    )
    return {"id": doc_id, "document_type": body.document_type, "title": body.title}


@router.get("/{doc_id}")
async def get_document(
    doc_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Return a single draft owned by the signed-in user."""
    row = DocumentService.get(db, doc_id, user.id)
    if row is None:
        raise HTTPException(status_code=404, detail="document not found")
    return row


@router.put("/{doc_id}")
async def put_document(
    doc_id: int,
    body: DocumentSaveRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Overwrite a draft's data. Validates `data` against the per-doc schema."""
    if not is_known(body.document_type):
        raise HTTPException(status_code=400, detail="unknown document type")
    data = validate_document_data(body.document_type, body.data)
    if not DocumentService.update(
        db, doc_id, user.id, body.document_type, body.title, data
    ):
        raise HTTPException(status_code=404, detail="document not found")
    return {"id": doc_id, "document_type": body.document_type, "title": body.title}


@router.delete("/{doc_id}")
async def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Delete a draft owned by the signed-in user."""
    if not DocumentService.delete(db, doc_id, user.id):
        raise HTTPException(status_code=404, detail="document not found")
    return {"message": "Document deleted"}