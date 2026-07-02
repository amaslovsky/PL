"""Authentication business logic.

Each method takes a SQLAlchemy `Session` and either returns data or raises
HTTPException with a meaningful status code. Routes are thin wrappers.
"""

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)
from database import User


class AuthService:
    """Handles authentication business logic."""

    def __init__(self, db: Session):
        self.db = db

    def signup(self, email: str, password: str) -> tuple[User, str]:
        """Register a new user. Returns (user, token).

        Raises HTTPException on duplicate email or short password.
        """
        if len(password) < 8:
            raise HTTPException(
                status_code=400,
                detail="Password must be at least 8 characters",
            )

        user = User(email=email, hashed_password=get_password_hash(password))
        try:
            self.db.add(user)
            self.db.commit()
            self.db.refresh(user)
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(status_code=400, detail="Email already registered")

        token = create_access_token(user.id, user.email)
        return user, token

    def signin(self, email: str, password: str) -> tuple[User, str]:
        """Authenticate a user. Returns (user, token).

        Performs a constant-time dummy bcrypt verify on unknown email to
        mitigate user-enumeration timing attacks.
        """
        user = self.db.query(User).filter(User.email == email).first()

        if user:
            password_valid = verify_password(password, user.hashed_password)
        else:
            # Constant-time: do a real bcrypt verify against a dummy hash.
            verify_password(
                password,
                "$2b$12$REuOu6.NifRKAB0krbBuzuEJaX7f.oZS5I9C/RZQLWESR.jIgpZ3C",
            )
            password_valid = False

        if not password_valid:
            raise HTTPException(
                status_code=401, detail="Invalid email or password"
            )

        token = create_access_token(user.id, user.email)
        return user, token

    def get_user_by_id(self, user_id: int) -> User:
        """Fetch a user by id. Raises 401 if not found."""
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user

    def get_user_by_email(self, email: str) -> User | None:
        """Fetch a user by email, or None if not found."""
        return self.db.query(User).filter(User.email == email).first()