import logging
import json
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.models.agent import Agent
from backend.models.tool import Tool
from backend.models.conversation import Conversation
from backend.services.llm import llm_service
from backend.services.tool_executor import tool_executor

logger = logging.getLogger(__name__)

class AgentRuntime:
    """Orchestrates agent execution with RAG, tools, and workflows."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def run(
        self,
        agent: Agent,
        user_message: str,
        conversation_id: str = None,
    ) -> Dict[str, Any]:
        """
        Run agent with message, handling tools and workflows.
        
        Returns:
            Dict with 'message', 'conversation_id', 'tool_calls' (optional)
        """
        logger.info(f"Running agent {agent.id} ({agent.name})")
        
        # Build conversation history
        messages = await self._build_messages(agent, user_message, conversation_id)
        
        # Load enabled tools
        tools = await self._load_tools(agent)
        tools_dict = {tool["function"]["name"]: tool for tool in tools} if tools else {}
        
        # Call LLM (possibly with tool support)
        llm_response = await llm_service.complete(
            messages=messages,
            llm_config=agent.llm_config,
            tools=tools if tools else None
        )
        
        # Check if LLM wants to use tools
        if llm_response.get("tool_calls"):
            tool_results = []
            
            # Execute each tool call
            for tool_call in llm_response["tool_calls"]:
                func_name = tool_call["function"]["name"]
                func_args = json.loads(tool_call["function"]["arguments"])
                
                logger.info(f"Executing tool: {func_name} with args: {func_args}")
                
                # Find tool in database
                result = await self.db.execute(
                    select(Tool).where(Tool.name == func_name)
                )
                tool = result.scalar_one_or_none()
                
                if not tool:
                    tool_results.append({
                        "tool": func_name,
                        "success": False,
                        "error": f"Tool {func_name} not found"
                    })
                    continue
                
                # Execute tool
                exec_result = await tool_executor.execute(
                    tool_name=tool.name,
                    tool_type=tool.tool_type,
                    config=tool.config,
                    parameters=func_args
                )
                
                tool_results.append({
                    "tool": func_name,
                    **exec_result
                })
            
            # Feed tool results back to LLM
            messages.append({
                "role": "assistant",
                "content": json.dumps({"tool_calls": llm_response["tool_calls"]})
            })
            messages.append({
                "role": "user",
                "content": f"Tool results:\n{json.dumps(tool_results, indent=2)}\n\nNow provide your final response to the user based on these results."
            })
            
            # Get final response from LLM
            final_response = await llm_service.complete(
                messages=messages,
                llm_config=agent.llm_config,
                tools=None  # No more tool calls
            )
            
            response_text = final_response.get("content", "I used tools but couldn't generate a response.")
        else:
            response_text = llm_response.get("content", "No response generated.")
        
        # Save conversation
        conversation_id = await self._save_conversation(
            agent_id=agent.id,
            conversation_id=conversation_id,
            user_message=user_message,
            assistant_message=response_text
        )
        
        return {
            "message": response_text,
            "conversation_id": conversation_id,
            "tool_calls": llm_response.get("tool_calls") if llm_response.get("tool_calls") else None
        }
    
    async def _build_messages(
        self,
        agent: Agent,
        user_message: str,
        conversation_id: str = None
    ) -> List[Dict[str, str]]:
        """Build message history with system persona."""
        messages = []
        
        # System prompt
        messages.append({
            "role": "system",
            "content": agent.persona
        })
        
        # Load conversation history if exists
        if conversation_id:
            result = await self.db.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            conversation = result.scalar_one_or_none()
            if conversation:
                messages.extend(conversation.messages[-10:])  # Last 10 messages
        
        # Add current user message
        messages.append({
            "role": "user",
            "content": user_message
        })
        
        return messages
    
    async def _load_tools(self, agent: Agent) -> List[Dict]:
        """Load enabled tools for this agent in OpenAI function calling format."""
        if not agent.enabled_tools:
            return []
        
        result = await self.db.execute(
            select(Tool).where(Tool.id.in_(agent.enabled_tools))
        )
        tools = result.scalars().all()
        
        # Convert to OpenAI function calling format
        return [
            {
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": tool.input_schema or {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                }
            }
            for tool in tools
        ]
    
    async def _save_conversation(
        self,
        agent_id: str,
        conversation_id: str,
        user_message: str,
        assistant_message: str
    ) -> str:
        """Save conversation to database."""
        if conversation_id:
            # Update existing
            result = await self.db.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            conversation = result.scalar_one_or_none()
            
            if conversation:
                conversation.messages.append({"role": "user", "content": user_message})
                conversation.messages.append({"role": "assistant", "content": assistant_message})
                await self.db.commit()
                return conversation_id
        
        # Create new conversation
        conversation = Conversation(
            agent_id=agent_id,
            messages=[
                {"role": "user", "content": user_message},
                {"role": "assistant", "content": assistant_message}
            ]
        )
        self.db.add(conversation)
        await self.db.commit()
        await self.db.refresh(conversation)
        
        return conversation.id


def get_agent_runtime(db: AsyncSession) -> AgentRuntime:
    """Factory function to create AgentRuntime."""
    return AgentRuntime(db)
