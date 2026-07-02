"""Pydantic request/response schemas for the /api/auth/* routes."""

from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class SigninRequest(SignupRequest):
    """SigninRequest is structurally identical to SignupRequest."""


class UserResponse(BaseModel):
    id: int
    email: str


class AuthResponse(BaseModel):
    user: UserResponse