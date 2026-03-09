import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from backend.database import get_db
from backend.models.tool import Tool
from backend.services.tool_executor import tool_executor

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tools", tags=["tools"])

class ToolCreate(BaseModel):
    name: str
    description: str
    tool_type: str
    config: Dict[str, Any] = {}
    input_schema: Dict[str, Any] = {}
    is_enabled: bool = True

class ToolUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tool_type: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    input_schema: Optional[Dict[str, Any]] = None
    is_enabled: Optional[bool] = None

class ToolResponse(BaseModel):
    id: str
    name: str
    description: str
    tool_type: str
    config: Dict[str, Any]
    input_schema: Dict[str, Any]
    is_enabled: bool

@router.get("/", response_model=List[ToolResponse])
async def list_tools(
    enabled_only: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """List all tools."""
    query = select(Tool)
    if enabled_only:
        query = query.where(Tool.is_enabled == True)
    
    result = await db.execute(query)
    tools = result.scalars().all()
    return tools

@router.get("/{tool_id}", response_model=ToolResponse)
async def get_tool(tool_id: str, db: AsyncSession = Depends(get_db)):
    """Get tool by ID."""
    result = await db.execute(select(Tool).where(Tool.id == tool_id))
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool

@router.post("/", response_model=ToolResponse, status_code=201)
async def create_tool(tool_data: ToolCreate, db: AsyncSession = Depends(get_db)):
    """Create new tool."""
    # Check for duplicate name
    result = await db.execute(select(Tool).where(Tool.name == tool_data.name))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Tool with this name already exists")
    
    tool = Tool(**tool_data.model_dump())
    db.add(tool)
    await db.commit()
    await db.refresh(tool)
    logger.info(f"Created tool id={tool.id} name={tool.name}")
    return tool

@router.put("/{tool_id}", response_model=ToolResponse)
async def update_tool(
    tool_id: str,
    tool_data: ToolUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update tool."""
    result = await db.execute(select(Tool).where(Tool.id == tool_id))
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    
    for key, value in tool_data.model_dump(exclude_unset=True).items():
        setattr(tool, key, value)
    
    await db.commit()
    await db.refresh(tool)
    logger.info(f"Updated tool id={tool.id}")
    return tool

@router.delete("/{tool_id}", status_code=204)
async def delete_tool(tool_id: str, db: AsyncSession = Depends(get_db)):
    """Delete tool."""
    result = await db.execute(select(Tool).where(Tool.id == tool_id))
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    
    await db.delete(tool)
    await db.commit()
    logger.info(f"Deleted tool id={tool_id}")

@router.post("/{tool_id}/test")
async def test_tool(
    tool_id: str,
    parameters: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Test a tool with sample parameters."""
    result = await db.execute(select(Tool).where(Tool.id == tool_id))
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    
    result = await tool_executor.execute(
        tool_name=tool.name,
        tool_type=tool.tool_type,
        config=tool.config,
        parameters=parameters
    )
    
    return result

@router.post("/seed-defaults", status_code=201)
async def seed_default_tools(db: AsyncSession = Depends(get_db)):
    """Seed default tools (web_search, email, http_api)."""
    default_tools = [
        {
            "name": "web_search",
            "description": "Search the web for current information using DuckDuckGo",
            "tool_type": "web_search",
            "config": {
                "provider": "duckduckgo"
            },
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query"
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of results",
                        "default": 5
                    }
                },
                "required": ["query"]
            }
        },
        {
            "name": "send_email",
            "description": "Send an email via SMTP",
            "tool_type": "email",
            "config": {
                "smtp_host": "",
                "smtp_port": 587,
                "username": "",
                "password": "",
                "from_email": ""
            },
            "input_schema": {
                "type": "object",
                "properties": {
                    "to": {
                        "type": "string",
                        "description": "Recipient email address"
                    },
                    "subject": {
                        "type": "string",
                        "description": "Email subject"
                    },
                    "body": {
                        "type": "string",
                        "description": "Email body"
                    }
                },
                "required": ["to", "subject", "body"]
            }
        },
        {
            "name": "fetch_url",
            "description": "Make HTTP request to a URL",
            "tool_type": "http_api",
            "config": {
                "method": "GET",
                "url": "",
                "headers": {},
                "timeout": 30
            },
            "input_schema": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "URL to fetch"
                    },
                    "query_params": {
                        "type": "object",
                        "description": "Query parameters"
                    }
                },
                "required": ["url"]
            }
        }
    ]
    
    created = []
    for tool_data in default_tools:
        # Check if exists
        result = await db.execute(select(Tool).where(Tool.name == tool_data["name"]))
        if result.scalar_one_or_none():
            continue
        
        tool = Tool(**tool_data)
        db.add(tool)
        created.append(tool.name)
    
    await db.commit()
    
    return {
        "created": created,
        "message": f"Created {len(created)} default tools"
    }
