# Re-export for compatibility
try:
    from src.database import Base, DATABASE_URL, engine, get_db, SessionLocal
except ImportError:
    from database import Base, DATABASE_URL, engine, get_db, SessionLocal

__all__ = ["Base", "DATABASE_URL", "engine", "get_db", "SessionLocal"]
