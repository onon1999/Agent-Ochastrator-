from sqlalchemy import Column, String, Text, JSON, DateTime
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from backend.database import Base
from datetime import datetime
import uuid

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id = Column(String, nullable=False)
    messages = Column(SQLiteJSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.id:
            self.id = str(uuid.uuid4())
        if not self.messages:
            self.messages = []
