import os
import shutil
import uuid
from pathlib import Path
from typing import Tuple
from fastapi import HTTPException, UploadFile, status

# Default upload directory inside apps/api/uploads
BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

ALLOWED_MIME_TYPES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/tiff": ".tiff",
    "image/webp": ".webp",
}


def validate_file(upload_file: UploadFile) -> str:
    """Validate content type and return corresponding extension."""
    content_type = (upload_file.content_type or "").lower()
    
    # Check mime type
    if content_type not in ALLOWED_MIME_TYPES:
        # Check by filename extension fallback
        ext = Path(upload_file.filename or "").suffix.lower()
        matched = False
        for mime, allowed_ext in ALLOWED_MIME_TYPES.items():
            if ext == allowed_ext or (ext == ".jpeg" and allowed_ext == ".jpg") or (ext == ".tif" and allowed_ext == ".tiff"):
                content_type = mime
                matched = True
                break
        if not matched:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type: {upload_file.content_type or 'unknown'}. Allowed types: PDF, PNG, JPG, TIFF, WebP.",
            )
    return content_type


async def save_upload_file(upload_file: UploadFile) -> Tuple[str, str, int, str]:
    """
    Saves an uploaded file to the local upload directory.
    Returns (unique_file_name, file_path_str, file_size_bytes, mime_type)
    """
    mime_type = validate_file(upload_file)
    
    original_name = upload_file.filename or "document"
    ext = Path(original_name).suffix.lower()
    if not ext:
        ext = ALLOWED_MIME_TYPES.get(mime_type, "")
    
    unique_file_name = f"{uuid.uuid4().hex}{ext}"
    dest_path = UPLOAD_DIR / unique_file_name
    
    file_size = 0
    try:
        with open(dest_path, "wb") as buffer:
            while chunk := await upload_file.read(1024 * 1024):  # 1MB chunks
                file_size += len(chunk)
                if file_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE // (1024 * 1024)}MB.",
                    )
                buffer.write(chunk)
    except Exception as e:
        if dest_path.exists():
            dest_path.unlink()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}",
        )
    finally:
        await upload_file.close()

    return unique_file_name, str(dest_path), file_size, mime_type


def delete_file(file_path_str: str) -> bool:
    """Deletes a file from the filesystem if it exists."""
    try:
        path = Path(file_path_str)
        if path.exists() and path.is_file():
            path.unlink()
            return True
    except Exception:
        pass
    return False
