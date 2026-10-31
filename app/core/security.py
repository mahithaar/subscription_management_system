import re
from datetime import datetime, timedelta
from typing import Optional, Any, Tuple
import jwt
import bcrypt

from app.core.config import settings

def validate_password_complexity(password: str) -> Tuple[bool, str]:
    """
    Blueprint rule (S1 & G1-G3):
    - "More than 8 characters" => strictly length >= 9
    - >= 1 uppercase letter
    - >= 1 lowercase letter
    - >= 1 special character (non-alphanumeric, non-space)
    """
    if len(password) < 9:
        return False, "Password must be more than 8 characters (at least 9 characters long)."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    if not re.search(r"[^A-Za-z0-9\s]", password):
        return False, "Password must contain at least one special character."
    return True, ""

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.PyJWTError:
        return None
