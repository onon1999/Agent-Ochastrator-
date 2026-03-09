import os
import logging
from typing import List, Dict, Any, Optional
import ollama
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self):
        self.grok_key = os.getenv("GROK_API_KEY")
        self.openai_key = os.getenv("OPENAI_API_KEY")
    
    def _get_ollama(self):
        """Get Ollama client (connects to ollama container)."""
        return ollama.AsyncClient(host="http://ollama:11434")
    
    def _get_grok(self):
        """Get Grok client."""
        if not self.grok_key:
            raise ValueError("GROK_API_KEY not set")
        return AsyncOpenAI(
            api_key=self.grok_key,
            base_url="https://api.x.ai/v1"
        )
    
    def _get_openai(self):
        """Get OpenAI client."""
        if not self.openai_key:
            raise ValueError("OPENAI_API_KEY not set")
        return AsyncOpenAI(api_key=self.openai_key)
    
    async def complete(
        self,
        messages: List[Dict[str, str]],
        llm_config: Dict[str, Any],
        tools: Optional[List[Dict]] = None,
    ) -> Dict[str, Any]:
        """
        Complete a conversation with optional tool calling support.
        
        Returns:
            Dict with 'content' (str or None) and optional 'tool_calls' (list)
        """
        provider = llm_config.get("provider", "ollama")
        
        if provider == "ollama":
            result = await self._ollama_complete(messages, llm_config, tools)
        elif provider == "grok":
            result = await self._grok_complete(messages, llm_config, tools)
        elif provider == "openai":
            result = await self._openai_complete(messages, llm_config, tools)
        else:
            raise ValueError(f"Unknown provider: {provider}")
        
        # Normalize response format
        if isinstance(result, str):
            return {"content": result, "tool_calls": None}
        elif isinstance(result, dict):
            return result
        else:
            return {"content": str(result), "tool_calls": None}
    
    async def _ollama_complete(
        self,
        messages: List[Dict[str, str]],
        llm_config: Dict[str, Any],
        tools: Optional[List[Dict]] = None,
    ) -> Dict[str, Any]:
        """Ollama completion with prompt-based tool calling."""
        client = self._get_ollama()
        model = llm_config.get("model", "gemma2:2b")
        temperature = llm_config.get("temperature", 0.7)

        await self._ensure_model_exists(model)

        logger.info(f"Ollama: model={model}, messages={len(messages)}, tools={len(tools) if tools else 0}")

        # Prompt-based tool calling for Ollama
        if tools:
            tool_descriptions = "\n".join([
                f"- {t['function']['name']}: {t['function']['description']}"
                for t in tools
            ])
            
            tool_instruction = f"\n\n### Available Tools:\n{tool_descriptions}\n\nTo use a tool, respond ONLY with JSON in this exact format:\n{{\"tool\": \"tool_name\", \"parameters\": {{\"key\": \"value\"}}}}\n\nIf you don't need a tool, respond normally in plain text."
            
            # Inject into system message
            if messages and messages[0]["role"] == "system":
                messages[0]["content"] += tool_instruction
            else:
                messages.insert(0, {
                    "role": "system",
                    "content": "You are a helpful assistant." + tool_instruction
                })

        response = await client.chat(
            model=model,
            messages=messages,
            options={
                "temperature": temperature,
                "num_predict": llm_config.get("max_tokens", 500),
            }
        )

        response_text = response.message.content or ""
        
        # Check if response is a tool call (JSON format)
        if tools and response_text.strip().startswith('{'):
            try:
                import json
                tool_call = json.loads(response_text.strip())
                if "tool" in tool_call and "parameters" in tool_call:
                    # Return in OpenAI function calling format
                    logger.info(f"Ollama tool call detected: {tool_call['tool']}")
                    return {
                        "content": None,
                        "tool_calls": [{
                            "id": "ollama-1",
                            "function": {
                                "name": tool_call["tool"],
                                "arguments": json.dumps(tool_call["parameters"])
                            }
                        }]
                    }
            except json.JSONDecodeError:
                pass  # Not valid JSON, treat as normal response

        return {"content": response_text, "tool_calls": None}

    async def _ensure_model_exists(self, model: str):
        """Auto-pull Ollama model if not present."""
        try:
            client = self._get_ollama()
            models = await client.list()
            model_names = [m.model for m in models.models]
            
            if model not in model_names:
                logger.info(f"Model {model} not found, pulling...")
                await client.pull(model)
                logger.info(f"Model {model} pulled successfully")
        except Exception as e:
            logger.warning(f"Could not ensure model exists: {e}")

    async def _grok_complete(
        self,
        messages: List[Dict[str, str]],
        llm_config: Dict[str, Any],
        tools: Optional[List[Dict]] = None,
    ) -> Dict[str, Any]:
        """Grok completion with native function calling."""
        client = self._get_grok()
        model = llm_config.get("model", "grok-2-1212")
        
        logger.info(f"Grok: model={model}, messages={len(messages)}, tools={len(tools) if tools else 0}")
        
        params = {
            "model": model,
            "messages": messages,
            "temperature": llm_config.get("temperature", 0.7),
            "max_tokens": llm_config.get("max_tokens", 1000),
        }
        
        if tools:
            params["tools"] = tools
            params["tool_choice"] = "auto"
        
        response = await client.chat.completions.create(**params)
        
        # Check if LLM wants to call tools
        if response.choices[0].message.tool_calls:
            return {
                "content": response.choices[0].message.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments
                        }
                    }
                    for tc in response.choices[0].message.tool_calls
                ]
            }
        
        return {"content": response.choices[0].message.content or "", "tool_calls": None}
    
    async def _openai_complete(
        self,
        messages: List[Dict[str, str]],
        llm_config: Dict[str, Any],
        tools: Optional[List[Dict]] = None,
    ) -> Dict[str, Any]:
        """OpenAI completion with native function calling."""
        client = self._get_openai()
        model = llm_config.get("model", "gpt-4o-mini")
        
        logger.info(f"OpenAI: model={model}, messages={len(messages)}, tools={len(tools) if tools else 0}")
        
        params = {
            "model": model,
            "messages": messages,
            "temperature": llm_config.get("temperature", 0.7),
            "max_tokens": llm_config.get("max_tokens", 1000),
        }
        
        if tools:
            params["tools"] = tools
            params["tool_choice"] = "auto"
        
        response = await client.chat.completions.create(**params)
        
        if response.choices[0].message.tool_calls:
            return {
                "content": response.choices[0].message.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments
                        }
                    }
                    for tc in response.choices[0].message.tool_calls
                ]
            }
        
        return {"content": response.choices[0].message.content or "", "tool_calls": None}


# Singleton instance
llm_service = LLMService()
