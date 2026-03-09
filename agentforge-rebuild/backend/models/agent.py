from sqlalchemy import Column, String, Text, JSON
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from backend.database import Base
import uuid

class Agent(Base):
    __tablename__ = "agents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text)
    persona = Column(Text, nullable=False)
    agent_type = Column(String, default="custom")
    
    # LLM Configuration
    llm_config = Column(SQLiteJSON, default=dict)
    
    # Workflow
    workflow_steps = Column(SQLiteJSON, default=list)
    
    # Behavior
    behavior = Column(SQLiteJSON, default=dict)
    
    # Tools - CRITICAL: This must be a list of tool IDs
    enabled_tools = Column(SQLiteJSON, default=list)
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.id:
            self.id = str(uuid.uuid4())
        if not self.llm_config:
            self.llm_config = {
                "provider": "ollama",
                "model": "gemma2:2b",
                "temperature": 0.7,
                "max_tokens": 1000
            }
        if not self.workflow_steps:
            self.workflow_steps = []
        if not self.behavior:
            self.behavior = {
                "fallback_message": "I'm not sure how to help with that.",
                "escalate_keywords": [],
                "max_turns": 20,
                "greeting_message": "",
                "collect_fields": []
            }
        if not self.enabled_tools:
            self.enabled_tools = []
