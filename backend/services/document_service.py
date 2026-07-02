"""Document service: list/get/create/update/delete with ownership scoping."""

import json

from sqlalchemy.orm import Session

from database import Document


class DocumentService:
    @staticmethod
    def list_for_user(db: Session, user_id: int) -> list[dict]:
        rows = (
            db.query(Document)
            .filter(Document.user_id == user_id)
            .order_by(Document.id.desc())
            .all()
        )
        return [
            {
                "id": r.id,
                "document_type": r.document_type,
                "data": json.loads(r.data_json),
                "created_at": r.created_at.isoformat(),
                "updated_at": r.updated_at.isoformat(),
            }
            for r in rows
        ]

    @staticmethod
    def get(db: Session, doc_id: int, user_id: int) -> dict | None:
        row = (
            db.query(Document)
            .filter(Document.id == doc_id, Document.user_id == user_id)
            .one_or_none()
        )
        if row is None:
            return None
        return {
            "id": row.id,
            "document_type": row.document_type,
            "data": json.loads(row.data_json),
            "created_at": row.created_at.isoformat(),
            "updated_at": row.updated_at.isoformat(),
        }

    @staticmethod
    def create(db: Session, user_id: int, document_type: str, data: dict) -> int:
        row = Document(
            user_id=user_id,
            document_type=document_type,
            data_json=json.dumps(data),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row.id

    @staticmethod
    def update(db: Session, doc_id: int, user_id: int, document_type: str, data: dict) -> bool:
        row = (
            db.query(Document)
            .filter(Document.id == doc_id, Document.user_id == user_id)
            .one_or_none()
        )
        if row is None:
            return False
        row.document_type = document_type
        row.data_json = json.dumps(data)
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