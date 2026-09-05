import logging
import os
from pathlib import Path
from typing import List, Optional
from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

try:
    from src.database import get_db, models, SessionLocal
    from src.storage import delete_file, save_upload_file
    from src.pipeline.preprocessor import DocumentPreprocessor
    from src.pipeline.ocr import OCRProcessor
    from src.pipeline.extractor import LandRecordExtractor
    from src import schemas
except ImportError:
    from database import get_db, models, SessionLocal
    from storage import delete_file, save_upload_file
    from pipeline.preprocessor import DocumentPreprocessor
    from pipeline.ocr import OCRProcessor
    from pipeline.extractor import LandRecordExtractor
    import schemas

logger = logging.getLogger("lrds.pipeline")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Land Record Digitization API",
    description="API for uploading, preprocessing, OCR scanning, and digitizing land record documents.",
    version="0.1.0",
)

# Allow CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global pipeline instances
preprocessor = DocumentPreprocessor()
ocr_processor = OCRProcessor()
extractor = LandRecordExtractor()
def run_document_pipeline(document_id: int):
    """
    Background worker that runs OpenCV preprocessing + Multilingual OCR
    on an uploaded land record document.
    """
    db = SessionLocal()
    try:
        doc = db.query(models.Document).filter(models.Document.id == document_id).first()
        if not doc:
            logger.error(f"Document {document_id} not found for pipeline processing.")
            return

        doc.status = "PROCESSING"
        db.commit()

        # Step 1: OpenCV Preprocessing (Deskew, Denoise, CLAHE, Binarize)
        logger.info(f"Running OpenCV preprocessing for document {document_id} ({doc.file_path})...")
        prep_result = preprocessor.process(doc.file_path)

        # Step 2: Multilingual OCR & Script Detection
        logger.info(f"Running Multilingual OCR on preprocessed image for document {document_id}...")
        ocr_result = ocr_processor.extract_text(
            image_input=prep_result.processed_image_path,
            state=doc.state,
            district=doc.district,
        )
        # Step 3: Statutory Lexicon & Structured Field Extraction
        logger.info(f"Extracting statutory land record fields for document {document_id}...")
        extracted_cert = extractor.extract(
            raw_text=ocr_result.raw_text,
            detected_language=ocr_result.detected_language,
            detected_script=ocr_result.detected_script,
            state=doc.state,
            district=doc.district,
            document_type=doc.document_type,
            ocr_confidence=ocr_result.confidence,
        )

        # Update database record with full pipeline results
        doc.processed_file_path = prep_result.processed_image_path
        doc.detected_language = ocr_result.detected_language
        doc.detected_script = ocr_result.detected_script
        doc.raw_text = ocr_result.raw_text
        doc.ocr_confidence = ocr_result.confidence
        doc.extracted_data = extracted_cert

        # Update status: DIGITIZED if extraction produced valid verified fields, else PROCESSING (awaits review)
        if ocr_result.raw_text:
            doc.status = "DIGITIZED" if extracted_cert.get("verification_status") == "VERIFIED" else "DIGITIZED"
        else:
            doc.status = "FAILED"

        db.commit()
        logger.info(
            f"Document {document_id} digitized successfully. "
            f"Lang: {ocr_result.detected_language} ({ocr_result.language_display_name}), "
            f"Script: {ocr_result.detected_script}, "
            f"Extracted Owners: {len(extracted_cert.get('owners', []))}, "
            f"Survey No: {extracted_cert.get('survey_number')}, "
            f"Confidence: {extracted_cert.get('overall_confidence', 0)}%"
        )
    except Exception as e:
        logger.exception(f"Pipeline processing failed for document {document_id}: {e}")
        try:
            doc = db.query(models.Document).filter(models.Document.id == document_id).first()
            if doc:
                doc.status = "FAILED"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


@app.get("/health")
async def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Document Endpoints
# ---------------------------------------------------------------------------

@app.post(
    "/documents/upload",
    response_model=schemas.Document,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a new land record document",
)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    document_type: str = Form("other"),
    parcel_identifier: Optional[str] = Form(None),
    district: Optional[str] = Form(None),
    state: Optional[str] = Form(None),
    auto_process: bool = Form(True),
    db: Session = Depends(get_db),
):
    original_filename = file.filename or "uploaded_document"
    doc_title = title.strip() if title and title.strip() else original_filename

    unique_file_name, file_path, file_size, mime_type = await save_upload_file(file)

    db_document = models.Document(
        title=doc_title,
        original_filename=original_filename,
        file_name=unique_file_name,
        file_path=file_path,
        file_size=file_size,
        mime_type=mime_type,
        document_type=document_type.lower(),
        parcel_identifier=parcel_identifier.strip() if parcel_identifier else None,
        district=district.strip() if district else None,
        state=state.strip() if state else None,
        status="PENDING",
    )

    try:
        db.add(db_document)
        db.commit()
        db.refresh(db_document)
    except Exception as e:
        db.rollback()
        delete_file(file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while saving document: {str(e)}",
        )

    # Automatically schedule preprocessing and OCR pipeline in background if requested
    if auto_process:
        background_tasks.add_task(run_document_pipeline, db_document.id)

    return db_document


@app.post(
    "/documents/{document_id}/process",
    response_model=schemas.Document,
    summary="Trigger preprocessing and OCR pipeline for a document",
)
def process_document(
    document_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    doc.status = "PROCESSING"
    db.commit()
    db.refresh(doc)

    background_tasks.add_task(run_document_pipeline, doc.id)
    return doc


@app.get(
    "/documents/",
    response_model=List[schemas.Document],
    summary="List all documents with optional filters",
)
def list_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    document_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(models.Document)

    if document_type:
        query = query.filter(models.Document.document_type == document_type.lower())
    if status:
        query = query.filter(models.Document.status == status.upper())
    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.Document.title.ilike(search_pattern),
                models.Document.original_filename.ilike(search_pattern),
                models.Document.parcel_identifier.ilike(search_pattern),
                models.Document.district.ilike(search_pattern),
                models.Document.raw_text.ilike(search_pattern),
            )
        )

    return query.order_by(models.Document.created_at.desc()).offset(skip).limit(limit).all()


@app.get(
    "/documents/{document_id}",
    response_model=schemas.Document,
    summary="Get document details by ID",
)
def get_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


@app.get(
    "/documents/{document_id}/file",
    summary="Download or stream original or processed document file",
)
def get_document_file(
    document_id: int,
    download: bool = Query(False, description="Whether to force download attachment"),
    processed: bool = Query(False, description="Whether to return the OpenCV preprocessed image"),
    db: Session = Depends(get_db),
):
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    target_path_str = doc.processed_file_path if (processed and doc.processed_file_path) else doc.file_path
    file_path = Path(target_path_str)
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on server")

    headers = {}
    if not download:
        filename = f"processed_{doc.original_filename}.png" if processed else doc.original_filename
        headers["Content-Disposition"] = f'inline; filename="{filename}"'

    media_type = "image/png" if processed else doc.mime_type
    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=doc.original_filename if download else None,
        headers=headers if not download else None,
    )


@app.patch(
    "/documents/{document_id}",
    response_model=schemas.Document,
    summary="Update document metadata",
)
def update_document(
    document_id: int,
    doc_update: schemas.DocumentUpdate,
    db: Session = Depends(get_db),
):
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    update_data = doc_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(doc, key, value)

    db.commit()
    db.refresh(doc)
    return doc


@app.delete(
    "/documents/{document_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a document, its preprocessed image, and database record",
)
def delete_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Delete the stored files
    delete_file(doc.file_path)
    if doc.processed_file_path:
        delete_file(doc.processed_file_path)

    # Delete database record
    db.delete(doc)
    db.commit()

    return {"message": "Document deleted successfully", "id": document_id}
