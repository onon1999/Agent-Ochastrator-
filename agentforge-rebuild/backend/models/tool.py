from sqlalchemy import Column, String, Text, Boolean, JSON
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from backend.database import Base
import uuid

class Tool(Base):
    __tablename__ = "tools"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)
    description = Column(Text, nullable=False)
    tool_type = Column(String, nullable=False)  # web_search, email, http_api, calendar, custom
    config = Column(SQLiteJSON, default=dict)  # API keys, endpoints, etc.
    input_schema = Column(SQLiteJSON, default=dict)  # JSON schema for parameters
    is_enabled = Column(Boolean, default=True)
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.id:
            self.id = str(uuid.uuid4())
        if not self.config:
            self.config = {}
        if not self.input_schema:
            self.input_schema = {}
