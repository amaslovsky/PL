"""Document service: list/get/create/update/delete with ownership scoping."""

import json

from sqlalchemy.orm import Session

from database import Document


class DocumentService:
    @staticmethod
    def _serialize(row: Document) -> dict:
        return {
            "id": row.id,
            "document_type": row.document_type,
            "title": row.title,
            "form_data": json.loads(row.form_data),
            "created_at": row.created_at.isoformat(),
            "updated_at": row.updated_at.isoformat(),
        }

    @staticmethod
    def list_for_user(db: Session, user_id: int) -> list[dict]:
        rows = (
            db.query(Document)
            .filter(Document.user_id == user_id)
            .order_by(Document.id.desc())
            .all()
        )
        return [DocumentService._serialize(r) for r in rows]

    @staticmethod
    def get(db: Session, doc_id: int, user_id: int) -> dict | None:
        row = (
            db.query(Document)
            .filter(Document.id == doc_id, Document.user_id == user_id)
            .one_or_none()
        )
        if row is None:
            return None
        return DocumentService._serialize(row)

    @staticmethod
    def create(
        db: Session, user_id: int, document_type: str, title: str, data: dict
    ) -> int:
        row = Document(
            user_id=user_id,
            document_type=document_type,
            title=title,
            form_data=json.dumps(data),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row.id

    @staticmethod
    def update(
        db: Session,
        doc_id: int,
        user_id: int,
        document_type: str,
        title: str,
        data: dict,
    ) -> bool:
        row = (
            db.query(Document)
            .filter(Document.id == doc_id, Document.user_id == user_id)
            .one_or_none()
        )
        if row is None:
            return False
        row.document_type = document_type
        row.title = title
        row.form_data = json.dumps(data)
        db.commit()
        return True

    @staticmethod
    def delete(db: Session, doc_id: int, user_id: int) -> bool:
        row = (
            db.query(Document)
            .filter(Document.id == doc_id, Document.user_id == user_id)
            .one_or_none()
        )
        if row is None:
            return False
        db.delete(row)
        db.commit()
        return True