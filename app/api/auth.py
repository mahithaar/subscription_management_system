import uuid
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    validate_password_complexity,
    hash_password,
    verify_password,
    create_access_token
)
from app.models.all_models import User, Customer, PasswordResetToken, UserRole
from app.api.deps import get_current_user, require_admin

router = APIRouter(prefix="/auth", tags=["Authentication & Roles"])

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class StaffCreateRequest(BaseModel):
    name: str
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    # 1. Enforce password rules (spec: more than 8 chars, >=1 upper, >=1 lower, >=1 special)
    valid, err_msg = validate_password_complexity(payload.password)
    if not valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)

    # 2. Case-insensitive unique email check
    email_clean = payload.email.lower().strip()
    existing_user = db.query(User).filter(User.email == email_clean).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is already registered.")

    # 3. Create customer user
    hashed = hash_password(payload.password)
    new_user = User(
        email=email_clean,
        password_hash=hashed,
        role=UserRole.CUSTOMER.value
    )
    db.add(new_user)
    db.flush()

    # Create associated Customer profile
    customer = Customer(
        user_id=new_user.id,
        name=payload.name,
        email=email_clean
    )
    db.add(customer)
    db.commit()

    token = create_access_token({"sub": str(new_user.id), "role": new_user.role})
    return {
        "message": "User registered successfully.",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "email": new_user.email,
            "role": new_user.role,
            "name": customer.name,
            "customer_id": customer.id
        }
    }

@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email_clean = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email_clean).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    token = create_access_token({"sub": str(user.id), "role": user.role})
    customer_id = user.customer.id if user.customer else None
    customer_name = user.customer.name if user.customer else user.email

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "name": customer_name,
            "customer_id": customer_id
        }
    }

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "customer_id": current_user.customer.id if current_user.customer else None,
        "customer_name": current_user.customer.name if current_user.customer else None
    }

@router.post("/create-staff", status_code=status.HTTP_201_CREATED)
def create_staff(
    payload: StaffCreateRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Admin-only: Create internal staff accounts."""
    valid, err_msg = validate_password_complexity(payload.password)
    if not valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)

    email_clean = payload.email.lower().strip()
    existing = db.query(User).filter(User.email == email_clean).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists.")

    staff_user = User(
        email=email_clean,
        password_hash=hash_password(payload.password),
        role=UserRole.STAFF.value
    )
    db.add(staff_user)
    db.commit()

    return {
        "message": "Staff member created successfully.",
        "staff": {
            "id": staff_user.id,
            "email": staff_user.email,
            "role": staff_user.role
        }
    }

@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Simulated password reset email capture."""
    email_clean = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email_clean).first()

    # Generic response to prevent user enumeration
    resp = {"message": "If the email is registered, a password reset link has been sent."}
    if not user:
        return resp

    token_str = str(uuid.uuid4())
    reset_entry = PasswordResetToken(
        user_id=user.id,
        token_hash=token_str,
        expires_at=datetime.utcnow() + timedelta(minutes=30)
    )
    db.add(reset_entry)
    db.commit()

    # For hackathon demo visibility, we also return the token
    resp["demo_reset_link"] = f"/reset-password?token={token_str}"
    return resp

@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    valid, err_msg = validate_password_complexity(payload.new_password)
    if not valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)

    token_record = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token_hash == payload.token,
            PasswordResetToken.used_at == None,
            PasswordResetToken.expires_at > datetime.utcnow()
        )
        .first()
    )
    if not token_record:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token.")

    user = db.query(User).filter(User.id == token_record.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    user.password_hash = hash_password(payload.new_password)
    token_record.used_at = datetime.utcnow()
    db.commit()

    return {"message": "Password reset successfully. You can now log in with your new password."}
