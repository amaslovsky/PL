"""Auth service: signup, signin, look-up.

All operations take a SQLAlchemy `Session`. Routes are thin wrappers
around these methods.
"""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.security import hash_password, verify_password
from database import User


class AuthService:
    @staticmethod
    def signup(db: Session, email: str, password: str) -> User:
        """Insert a new user with a hashed password.

        Raises IntegrityError on duplicate email; callers convert to 409.
        """
        user = User(email=email, password_hash=hash_password(password))
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def signin(db: Session, email: str, password: str) -> User | None:
        """Return the user if credentials match, else None.

        Performs a constant-time dummy bcrypt verify on unknown email to
        mitigate user-enumeration timing attacks.
        """
        user = db.query(User).filter(User.email == email).one_or_none()
        if user is None:
            # Constant-time: hash a dummy password to even out timing.
            verify_password(password, hash_password("dummy-password"))
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user

    @staticmethod
    def get_user_by_id(db: Session, user_id: int) -> User | None:
        return db.get(User, user_id)