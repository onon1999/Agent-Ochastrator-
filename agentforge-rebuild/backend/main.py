import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import init_db
from backend.routers import agents, chat, knowledge, tools

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(name)s | %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="AgentForge API",
    description="AI Agent Platform with Tools & Actions",
    version="3.0.0"
)

# CORS
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(agents.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(knowledge.router, prefix="/api/v1")
app.include_router(tools.router, prefix="/api/v1")

@app.on_event("startup")
async def startup():
    """Initialize database and create directories."""
    logger.info("🚀 AgentForge starting up...")
    
    # Initialize database
    await init_db()
    logger.info("✅ Database initialized")
    
    # Create storage directories
    upload_dir = os.getenv("UPLOAD_DIR", "/app/data/uploads")
    chroma_dir = os.getenv("CHROMA_DIR", "/app/data/chroma")
    os.makedirs(upload_dir, exist_ok=True)
    os.makedirs(chroma_dir, exist_ok=True)
    logger.info(f"✅ Storage dirs ready: uploads={upload_dir}, chroma={chroma_dir}")

@app.get("/")
async def root():
    """Health check."""
    return {
        "name": "AgentForge API",
        "version": "3.0.0",
        "status": "running"
    }

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}
