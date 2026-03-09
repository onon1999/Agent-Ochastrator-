import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from backend.database import get_db
from backend.models.knowledge import Knowledge
from pypdf import PdfReader  # ← Changed this
import io

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/knowledge", tags=["knowledge"])

@router.post("/{agent_id}/upload")
async def upload_document(
    agent_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Upload document for RAG."""
    try:
        content_bytes = await file.read()
        
        # Extract text based on file type
        if file.filename.endswith('.pdf'):
            pdf_reader = PdfReader(io.BytesIO(content_bytes))  # ← Changed this
            content = "\n".join([page.extract_text() for page in pdf_reader.pages])
            file_type = "pdf"
        elif file.filename.endswith('.txt'):
            content = content_bytes.decode('utf-8')
            file_type = "txt"
        else:
            content = content_bytes.decode('utf-8', errors='ignore')
            file_type = "other"
        
        # Save to database
        knowledge = Knowledge(
            agent_id=agent_id,
            filename=file.filename,
            content=content,
            file_type=file_type
        )
        db.add(knowledge)
        await db.commit()
        await db.refresh(knowledge)
        
        return {
            "id": knowledge.id,
            "filename": knowledge.filename,
            "file_type": knowledge.file_type,
            "created_at": knowledge.created_at.isoformat()
        }
    
    except Exception as e:
        logger.error(f"Document upload failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ... rest of the file stays the same

@router.get("/{agent_id}")
async def list_documents(agent_id: str, db: AsyncSession = Depends(get_db)):
    """List documents for an agent."""
    result = await db.execute(
        select(Knowledge).where(Knowledge.agent_id == agent_id)
    )
    documents = result.scalars().all()
    
    return [
        {
            "id": doc.id,
            "filename": doc.filename,
            "file_type": doc.file_type,
            "created_at": doc.created_at.isoformat()
        }
        for doc in documents
    ]

@router.delete("/{agent_id}/{doc_id}", status_code=204)
async def delete_document(
    agent_id: str,
    doc_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete a document."""
    result = await db.execute(
        select(Knowledge).where(
            Knowledge.id == doc_id,
            Knowledge.agent_id == agent_id
        )
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    await db.delete(document)
    await db.commit()
