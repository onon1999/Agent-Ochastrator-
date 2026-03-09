import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from backend.database import get_db
from backend.models.agent import Agent
from backend.models.conversation import Conversation
from backend.services.agent_runtime import get_agent_runtime

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])

class ChatRequest(BaseModel):
    agent_id: str
    message: str
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    message: str
    conversation_id: str
    tool_calls: Optional[List[Dict]] = None

@router.post("/", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """Send a message to an agent."""
    try:
        result = await db.execute(select(Agent).where(Agent.id == req.agent_id))
        agent = result.scalar_one_or_none()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        runtime = get_agent_runtime(db)
        result = await runtime.run(
            agent=agent,
            user_message=req.message,
            conversation_id=req.conversation_id,
        )

        return ChatResponse(**result)
    except Exception as e:
        logger.error(f"Chat error for agent {req.agent_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions/{agent_id}")
async def list_sessions(agent_id: str, db: AsyncSession = Depends(get_db)):
    """List conversation sessions for an agent."""
    result = await db.execute(
        select(Conversation).where(Conversation.agent_id == agent_id)
    )
    conversations = result.scalars().all()
    return [
        {
            "id": conv.id,
            "agent_id": conv.agent_id,
            "message_count": len(conv.messages),
            "created_at": conv.created_at.isoformat(),
            "updated_at": conv.updated_at.isoformat()
        }
        for conv in conversations
    ]
