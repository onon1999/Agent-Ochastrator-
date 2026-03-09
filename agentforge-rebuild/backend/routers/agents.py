import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from backend.database import get_db
from backend.models.agent import Agent

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/agents", tags=["agents"])

class AgentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    persona: str
    agent_type: str = "custom"
    llm_config: Dict[str, Any] = {}
    workflow_steps: List[Dict] = []
    behavior: Dict[str, Any] = {}
    enabled_tools: List[str] = []

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    persona: Optional[str] = None
    agent_type: Optional[str] = None
    llm_config: Optional[Dict[str, Any]] = None
    workflow_steps: Optional[List[Dict]] = None
    behavior: Optional[Dict[str, Any]] = None
    enabled_tools: Optional[List[str]] = None

class AgentResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    persona: str
    agent_type: str
    llm_config: Dict[str, Any]
    workflow_steps: List[Dict]
    behavior: Dict[str, Any]
    enabled_tools: List[str]

@router.get("/", response_model=List[AgentResponse])
async def list_agents(db: AsyncSession = Depends(get_db)):
    """List all agents."""
    result = await db.execute(select(Agent))
    agents = result.scalars().all()
    return agents

@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    """Get agent by ID."""
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

@router.post("/", response_model=AgentResponse, status_code=201)
async def create_agent(agent_data: AgentCreate, db: AsyncSession = Depends(get_db)):
    """Create new agent."""
    agent = Agent(**agent_data.model_dump())
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    logger.info(f"Created agent id={agent.id} name={agent.name}")
    return agent

@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str,
    agent_data: AgentUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update agent."""
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    for key, value in agent_data.model_dump(exclude_unset=True).items():
        setattr(agent, key, value)
    
    await db.commit()
    await db.refresh(agent)
    logger.info(f"Updated agent id={agent.id}")
    return agent

@router.delete("/{agent_id}", status_code=204)
async def delete_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    """Delete agent."""
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    await db.delete(agent)
    await db.commit()
    logger.info(f"Deleted agent id={agent_id}")
