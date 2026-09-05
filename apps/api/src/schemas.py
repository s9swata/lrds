from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict


class UserBase(BaseModel):
    name: str
    email: str
    is_active: bool = True


class UserCreate(UserBase):
    pass


class User(UserBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class DocumentBase(BaseModel):
    title: str
    document_type: str = "other"
    parcel_identifier: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    document_type: Optional[str] = None
    parcel_identifier: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    status: Optional[str] = None
    detected_language: Optional[str] = None
    detected_script: Optional[str] = None
    raw_text: Optional[str] = None
    ocr_confidence: Optional[float] = None
    extracted_data: Optional[Dict[str, Any]] = None


class Document(DocumentBase):
    id: int
    original_filename: str
    file_name: str
    file_path: str
    file_size: int
    mime_type: str
    status: str
    processed_file_path: Optional[str] = None
    detected_language: Optional[str] = None
    detected_script: Optional[str] = None
    raw_text: Optional[str] = None
    ocr_confidence: Optional[float] = None
    extracted_data: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
