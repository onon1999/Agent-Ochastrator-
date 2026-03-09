import logging
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any
import httpx
from duckduckgo_search import DDGS

logger = logging.getLogger(__name__)

class ToolExecutor:
    """Executes various tool types."""
    
    async def execute(self, tool_name: str, tool_type: str, config: Dict, parameters: Dict) -> Dict[str, Any]:
        """
        Execute a tool and return results.
        
        Args:
            tool_name: Name of the tool
            tool_type: Type (web_search, email, http_api, etc.)
            config: Tool configuration (API keys, endpoints, etc.)
            parameters: Execution parameters from LLM
        
        Returns:
            Dict with 'success' (bool) and 'result' (any) or 'error' (str)
        """
        logger.info(f"Executing tool: {tool_name} (type: {tool_type})")
        
        try:
            if tool_type == "web_search":
                result = await self._web_search(config, parameters)
            elif tool_type == "email":
                result = await self._send_email(config, parameters)
            elif tool_type == "http_api":
                result = await self._http_api_call(config, parameters)
            elif tool_type == "calendar":
                result = await self._create_calendar_event(config, parameters)
            elif tool_type == "custom":
                result = await self._custom_tool(config, parameters)
            else:
                return {"success": False, "error": f"Unknown tool type: {tool_type}"}
            
            return {"success": True, "result": result}
        
        except Exception as e:
            logger.error(f"Tool execution failed: {e}", exc_info=True)
            return {"success": False, "error": str(e)}
    
    async def _web_search(self, config: Dict, params: Dict) -> Dict[str, Any]:
        """
        Perform web search using DuckDuckGo or Tavily.
        
        Config:
            provider: "duckduckgo" (default, free) or "tavily" (paid, faster)
            api_key: Only needed for Tavily
        
        Params:
            query: Search query (required)
            max_results: Number of results (default: 5)
        """
        query = params.get("query")
        if not query:
            raise ValueError("Search query is required")
        
        max_results = params.get("max_results", 5)
        provider = config.get("provider", "duckduckgo")
        
        if provider == "tavily":
            # Tavily search (faster, paid)
            api_key = config.get("api_key")
            if not api_key:
                raise ValueError("Tavily API key required")
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.tavily.com/search",
                    json={"query": query, "max_results": max_results},
                    headers={"Authorization": f"Bearer {api_key}"},
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                return {
                    "query": query,
                    "results": data.get("results", [])
                }
        
        else:
            # DuckDuckGo search (free, default)
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=max_results))
                return {
                    "query": query,
                    "results": [
                        {
                            "title": r.get("title", ""),
                            "url": r.get("href", ""),
                            "snippet": r.get("body", "")
                        }
                        for r in results
                    ]
                }
    
    async def _send_email(self, config: Dict, params: Dict) -> Dict[str, Any]:
        """
        Send email via SMTP.
        
        Config:
            smtp_host: SMTP server (e.g., smtp.gmail.com)
            smtp_port: SMTP port (default: 587)
            username: SMTP username
            password: SMTP password or app password
            from_email: Sender email address
        
        Params:
            to: Recipient email (required)
            subject: Email subject (required)
            body: Email body (required)
        """
        to_email = params.get("to")
        subject = params.get("subject")
        body = params.get("body")
        
        if not all([to_email, subject, body]):
            raise ValueError("Email requires: to, subject, body")
        
        smtp_host = config.get("smtp_host")
        smtp_port = config.get("smtp_port", 587)
        username = config.get("username")
        password = config.get("password")
        from_email = config.get("from_email", username)
        
        if not all([smtp_host, username, password]):
            raise ValueError("SMTP config incomplete (need host, username, password)")
        
        # Create message
        msg = MIMEMultipart()
        msg['From'] = from_email
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))
        
        # Send email
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(username, password)
            server.send_message(msg)
        
        return {
            "sent": True,
            "to": to_email,
            "subject": subject
        }
    
    async def _http_api_call(self, config: Dict, params: Dict) -> Dict[str, Any]:
        """
        Make HTTP API call.
        
        Config:
            method: GET, POST, PUT, DELETE
            url: Base URL (can be overridden by params)
            headers: Default headers (dict)
            timeout: Request timeout in seconds (default: 30)
        
        Params:
            url: Override base URL (optional)
            query_params: Query parameters (dict)
            body: Request body (dict, for POST/PUT)
            headers: Additional headers (dict)
        """
        method = config.get("method", "GET").upper()
        base_url = config.get("url", "")
        url = params.get("url", base_url)
        
        if not url:
            raise ValueError("URL is required")
        
        # Merge headers
        headers = {**config.get("headers", {}), **params.get("headers", {})}
        
        # Query params
        query_params = params.get("query_params", {})
        
        # Request body
        body = params.get("body")
        
        timeout = config.get("timeout", 30)
        
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=method,
                url=url,
                params=query_params,
                json=body if body else None,
                headers=headers,
                timeout=timeout
            )
            
            return {
                "status_code": response.status_code,
                "headers": dict(response.headers),
                "body": response.text,
                "json": response.json() if response.headers.get("content-type", "").startswith("application/json") else None
            }
    
    async def _create_calendar_event(self, config: Dict, params: Dict) -> Dict[str, Any]:
        """
        Create calendar event (Google Calendar placeholder).
        
        TODO: Implement Google Calendar API integration
        """
        return {
            "message": "Calendar integration not yet implemented",
            "event": params
        }
    
    async def _custom_tool(self, config: Dict, params: Dict) -> Dict[str, Any]:
        """
        Execute custom code (placeholder for Phase 4).
        
        TODO: Implement sandboxed code execution
        """
        return {
            "message": "Custom tools not yet implemented",
            "params": params
        }


# Singleton instance
tool_executor = ToolExecutor()
