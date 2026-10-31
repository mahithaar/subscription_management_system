import os

class Settings:
    PROJECT_NAME: str = "RecurOS"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "recuros-secret-key-hackathon-2026-audit-proof")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./recuros.db")
    CURRENCY_SYMBOL: str = os.getenv("CURRENCY_SYMBOL", "₹")

settings = Settings()
