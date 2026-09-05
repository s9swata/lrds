from sqlalchemy import JSON, Boolean, Column, DateTime, Float, Integer, String, Text, func

try:
    from src.database.connection import Base
except ImportError:
    from .connection import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    is_active = Column(Boolean, default=True)


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False, index=True)
    original_filename = Column(String, nullable=False)
    file_name = Column(String, unique=True, nullable=False, index=True)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String, nullable=False)
    document_type = Column(String, nullable=False, default="other", index=True)
    parcel_identifier = Column(String, nullable=True, index=True)
    district = Column(String, nullable=True, index=True)
    state = Column(String, nullable=True, index=True)
    status = Column(String, nullable=False, default="PENDING", index=True)
    processed_file_path = Column(String, nullable=True)
    detected_language = Column(String, nullable=True, index=True)
    detected_script = Column(String, nullable=True, index=True)
    raw_text = Column(Text, nullable=True)
    ocr_confidence = Column(Float, nullable=True)
    extracted_data = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
