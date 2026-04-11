import logging
import traceback
from typing import Any, Literal, List, Optional, Union
from uuid import UUID
import json

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import StreamingResponse
from pydantic_ai import (
    Agent,
    FinalResultEvent,
    FunctionToolCallEvent,
    FunctionToolResultEvent,
    PartDeltaEvent,
    PartStartEvent,
    TextPartDelta,
    ToolCallPartDelta,
)
from pydantic_ai.messages import (
    ModelRequest,
    ModelResponse,
    SystemPromptPart,
    TextPart,
    UserPromptPart,
    ImageUrl,
)
from pydantic import BaseModel, Field

from app.agents.assistant import Deps, get_agent
from app.api.deps import get_conversation_service, get_current_user_ws
from app.db.models.user import User
from app.db.session import get_db_context
from app.schemas.conversation import (
    ConversationCreate,
    MessageCreate,
)
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


class AgentConnectionManager:
    """WebSocket connection manager for AI agent."""

    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and store a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Agent WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a WebSocket connection."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(
            f"Agent WebSocket disconnected. Total connections: {len(self.active_connections)}"
        )

    async def send_event(self, websocket: WebSocket, event_type: str, data: Any) -> bool:
        """Send a JSON event to a specific WebSocket client.

        Returns True if sent successfully, False if connection is closed.
        """
        try:
            await websocket.send_json({"type": event_type, "data": data})
            return True
        except (WebSocketDisconnect, RuntimeError):
            # Connection already closed
            return False


# =============================================================================
# UI Message Schemas (AI SDK Protocol)
# =============================================================================

class TextUIPart(BaseModel):
    type: Literal["text"] = "text"
    text: str

class FileUIPart(BaseModel):
    type: Literal["file"] = "file"
    mediaType: str
    filename: Optional[str] = None
    url: str

class DataUIPart(BaseModel):
    type: str
    id: Optional[str] = None
    data: Any

UIMessagePart = Union[TextUIPart, FileUIPart, DataUIPart]

class UIMessageInput(BaseModel):
    id: Optional[str] = None
    role: Literal["user", "assistant", "system", "data"]
    parts: List[dict] # Use dict for flexibility with and discriminatory parsing later

def build_message_history(messages: List[UIMessageInput]) -> List[ModelRequest | ModelResponse]:
    """Convert UI messages to PydanticAI message format."""
    model_history: List[ModelRequest | ModelResponse] = []

    for msg in messages:
        prompt_parts = []
        for p in msg.parts:
            # Simple discriminatory parsing
            p_type = p.get("type")
            if p_type == "text":
                prompt_parts.append(p.get("text", ""))
            elif p_type == "file" and p.get("mediaType", "").startswith("image/"):
                prompt_parts.append(ImageUrl(url=p.get("url", "")))
        
        if not prompt_parts:
            continue

        if msg.role == "user":
            model_history.append(ModelRequest(parts=[UserPromptPart(content=prompt_parts if len(prompt_parts) > 1 else prompt_parts[0])]))
        elif msg.role == "assistant":
            # assistant messages in history only support text in this mapping for now
            text_content = " ".join([p for p in prompt_parts if isinstance(p, str)])
            model_history.append(ModelResponse(parts=[TextPart(content=text_content)]))
        elif msg.role == "system":
            text_content = " ".join([p for p in prompt_parts if isinstance(p, str)])
            model_history.append(ModelRequest(parts=[SystemPromptPart(content=text_content)]))

    return model_history

manager = AgentConnectionManager()


@router.websocket("/ws/agent")
async def agent_websocket(
    websocket: WebSocket,
    user: User = Depends(get_current_user_ws),
) -> None:
    """WebSocket endpoint for AI agent with full event streaming.

    Uses PydanticAI iter() to stream all agent events including:
    - user_prompt: When user input is received
    - model_request_start: When model request begins
    - text_delta: Streaming text from the model
    - tool_call_delta: Streaming tool call arguments
    - tool_call: When a tool is called (with full args)
    - tool_result: When a tool returns a result
    - final_result: When the final result is ready
    - complete: When processing is complete
    - error: When an error occurs

    Expected input message format:
    {
        "message": "user message here",
        "history": [{"role": "user|assistant|system", "content": "..."}],
        "conversation_id": "optional-uuid-to-continue-existing-conversation"
    }

    Authentication: Requires a valid JWT token passed as a query parameter or header.

    Persistence: Set 'conversation_id' to continue an existing conversation.
    If not provided, a new conversation is created. The conversation_id is
    returned in the 'conversation_created' event.
    """

    await manager.connect(websocket)

    # Conversation state per connection
    conversation_history: list[dict[str, str]] = []
    deps = Deps()
    current_conversation_id: str | None = None

    try:
        while True:
            # Receive user message
            data = await websocket.receive_json()
            user_message = data.get("message", "")
            # Optionally accept history from client (or use server-side tracking)
            if "history" in data:
                conversation_history = data["history"]

            if not user_message:
                await manager.send_event(websocket, "error", {"message": "Empty message"})
                continue

            # Handle conversation persistence
            try:
                async with get_db_context() as db:
                    conv_service = get_conversation_service(db)

                    # Get or create conversation
                    requested_conv_id = data.get("conversation_id")
                    if requested_conv_id:
                        current_conversation_id = requested_conv_id
                        # Verify conversation exists
                        await conv_service.get_conversation(
                            UUID(requested_conv_id),
                            user_id=user.id,
                        )
                    elif not current_conversation_id:
                        # Create new conversation
                        conv_data = ConversationCreate(
                            user_id=user.id,
                            title=user_message[:50] if len(user_message) > 50 else user_message,
                        )
                        conversation = await conv_service.create_conversation(conv_data)
                        current_conversation_id = str(conversation.id)
                        await manager.send_event(
                            websocket,
                            "conversation_created",
                            {"conversation_id": current_conversation_id},
                        )

                    # Save user message
                    await conv_service.add_message(
                        UUID(current_conversation_id),
                        MessageCreate(role="user", content=user_message),
                        user_id=user.id,
                    )
            except Exception as e:
                logger.warning(f"Failed to persist conversation: {e}")
                # Continue without persistence

            await manager.send_event(websocket, "user_prompt", {"content": user_message})

            try:
                async with get_db_context() as agent_db:
                    assistant = get_agent()
                    model_history = build_message_history(conversation_history)
                    runtime_deps = Deps(
                        db=agent_db,
                        user_id=str(user.id),
                        user_name=user.full_name,
                    )

                    # Use iter() on the underlying PydanticAI agent to stream all events
                    async with assistant.agent.iter(
                        user_message,
                        deps=runtime_deps,
                        message_history=model_history,
                    ) as agent_run:
                        async for node in agent_run:
                            if Agent.is_user_prompt_node(node):
                                await manager.send_event(
                                    websocket,
                                    "user_prompt_processed",
                                    {"prompt": node.user_prompt},
                                )

                            elif Agent.is_model_request_node(node):
                                await manager.send_event(websocket, "model_request_start", {})

                                async with node.stream(agent_run.ctx) as request_stream:
                                    async for event in request_stream:
                                        if isinstance(event, PartStartEvent):
                                            await manager.send_event(
                                                websocket,
                                                "part_start",
                                                {
                                                    "index": event.index,
                                                    "part_type": type(event.part).__name__,
                                                },
                                            )
                                            # Send initial content from TextPart if present
                                            if isinstance(event.part, TextPart) and event.part.content:
                                                await manager.send_event(
                                                    websocket,
                                                    "text_delta",
                                                    {
                                                        "index": event.index,
                                                        "content": event.part.content,
                                                    },
                                                )

                                        elif isinstance(event, PartDeltaEvent):
                                            if isinstance(event.delta, TextPartDelta):
                                                await manager.send_event(
                                                    websocket,
                                                    "text_delta",
                                                    {
                                                        "index": event.index,
                                                        "content": event.delta.content_delta,
                                                    },
                                                )
                                            elif isinstance(event.delta, ToolCallPartDelta):
                                                await manager.send_event(
                                                    websocket,
                                                    "tool_call_delta",
                                                    {
                                                        "index": event.index,
                                                        "args_delta": event.delta.args_delta,
                                                    },
                                                )

                                        elif isinstance(event, FinalResultEvent):
                                            await manager.send_event(
                                                websocket,
                                                "final_result_start",
                                                {"tool_name": event.tool_name},
                                            )

                            elif Agent.is_call_tools_node(node):
                                await manager.send_event(websocket, "call_tools_start", {})

                                async with node.stream(agent_run.ctx) as handle_stream:
                                    async for event in handle_stream:
                                        if isinstance(event, FunctionToolCallEvent):
                                            await manager.send_event(
                                                websocket,
                                                "tool_call",
                                                {
                                                    "tool_name": event.part.tool_name,
                                                    "args": event.part.args,
                                                    "tool_call_id": event.part.tool_call_id,
                                                },
                                            )

                                        elif isinstance(event, FunctionToolResultEvent):
                                            await manager.send_event(
                                                websocket,
                                                "tool_result",
                                                {
                                                    "tool_call_id": event.tool_call_id,
                                                    "content": str(event.result.content),
                                                },
                                            )

                            elif Agent.is_end_node(node) and agent_run.result is not None:
                                await manager.send_event(
                                    websocket,
                                    "final_result",
                                    {"output": agent_run.result.output},
                                )

                    # Update conversation history
                    conversation_history.append({"role": "user", "content": user_message})
                    if agent_run.result:
                        conversation_history.append(
                            {"role": "assistant", "content": agent_run.result.output}
                        )

                    # Save assistant response to database
                    if current_conversation_id and agent_run.result:
                        try:
                            conv_service = get_conversation_service(agent_db)
                            await conv_service.add_message(
                                UUID(current_conversation_id),
                                MessageCreate(
                                    role="assistant",
                                    content=agent_run.result.output,
                                    model_name=assistant.model_name
                                    if hasattr(assistant, "model_name")
                                    else None,
                                ),
                                user_id=user.id,
                            )
                        except Exception as e:
                            logger.warning(f"Failed to persist assistant response: {e}")

                    await manager.send_event(
                        websocket,
                        "complete",
                        {
                            "conversation_id": current_conversation_id,
                        },
                    )

            except WebSocketDisconnect:
                # Client disconnected during processing - this is normal
                logger.info("Client disconnected during agent processing")
                break
            except Exception as e:
                logger.exception(f"Error processing agent request: {e}")
                # Try to send error, but don't fail if connection is closed
                await manager.send_event(websocket, "error", {"message": str(e)})

    except WebSocketDisconnect:
        pass  # Normal disconnect
    finally:
        manager.disconnect(websocket)

        

@router.post("/chat")
async def chat_streaming(
    request: Request,
    user: User = Depends(get_current_user),
) -> Any:
    """Streaming HTTP endpoint for AI agent compatible with Vercel AI SDK Data Stream Protocol.
    
    Streams text deltas using the standard Vercel AI SDK text-stream format:
      0:"Hello "\\n
      0:"world"\\n
      d:{"finishReason":"stop"}\\n
    """
    import json
    import traceback as tb_module
    from uuid import UUID
    from app.schemas.conversation import ConversationCreate, MessageCreate
    from app.db.session import get_db_context
    from fastapi.responses import StreamingResponse
    
    # Get request JSON
    try:
        data = await request.json()
    except Exception as e:
        logger.error(f"Failed to parse request body: {e}")
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=400, content={"error": {"code": "BAD_REQUEST", "message": str(e)}})

    # @ai-sdk/react useChat sends: {id, messages: [{role, parts: [{type, text}], id}], trigger}
    # We extract the last user message and build history from prior messages
    raw_messages = data.get("messages", [])
    
    def extract_text(msg: dict) -> str:
        """Extract plain text from an ai-sdk message with parts array."""
        # Try parts array first (ai-sdk format)
        parts = msg.get("parts", [])
        text_parts = [p.get("text", "") for p in parts if p.get("type") == "text"]
        if text_parts:
            return " ".join(text_parts)
        # Fallback: plain content string
        return msg.get("content", "")

    # @ai-sdk/react useChat sends: {messages: UIMessage[], ...}
    messages_data = data.get("messages", [])
    try:
        ui_messages = [UIMessageInput(**m) for m in messages_data]
    except Exception as e:
        logger.error(f"Failed to parse messages: {e}")
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=400, content={"error": {"code": "BAD_REQUEST", "message": f"Invalid message format: {e}"}})

    if not ui_messages:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=400, content={"error": {"code": "BAD_REQUEST", "message": "No messages found"}})

    # Last message is current prompt
    last_ui_msg = ui_messages[-1]
    
    # Extract prompt for PydanticAI (can be a sequence of str | ImageUrl)
    prompt_parts = []
    for p in last_ui_msg.parts:
        if p.get("type") == "text":
            prompt_parts.append(p.get("text", ""))
        elif p.get("type") == "file" and p.get("mediaType", "").startswith("image/"):
            prompt_parts.append(ImageUrl(url=p.get("url", "")))
    
    if not prompt_parts:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=400, content={"error": {"code": "BAD_REQUEST", "message": "Last message has no text or image parts"}})

    final_prompt = prompt_parts if len(prompt_parts) > 1 else prompt_parts[0]
    
    # History is everything before the last message
    model_history = build_message_history(ui_messages[:-1])

    # For persistence, we still need a plain text version
    user_message_text = " ".join([p for p in prompt_parts if isinstance(p, str)])
    if not user_message_text and any(isinstance(p, ImageUrl) for p in prompt_parts):
        user_message_text = "[Image]"

    requested_conv_id = data.get("conversation_id")
    
    import uuid as _uuid

    def sse(payload: dict) -> str:
        """Format a single SSE event as `data: {...}\n\n`"""
        return f"data: {json.dumps(payload)}\n\n"

    async def stream_generator():
        try:
            async with get_db_context() as db:
                from app.api.deps import get_conversation_service
                conv_service = get_conversation_service(db)

                # Handle conversation persistence
                conv_id = requested_conv_id
                conv = None
                
                # Check if conversation exists if ID provided
                if conv_id:
                    try:
                        conv = await conv_service.get_conversation(
                            UUID(conv_id),
                            user_id=user.id,
                        )
                    except Exception:
                        conv = None
                
                # Create if doesn't exist or ID was missing
                if not conv:
                    conv_data = ConversationCreate(
                        user_id=user.id,
                        title=user_message_text[:50] if len(user_message_text) > 50 else user_message_text,
                    )
                    conv = await conv_service.create_conversation(conv_data)
                    conv_id = str(conv.id)

                # Save user message (plain text) if it has content
                if user_message_text.strip():
                    await conv_service.add_message(
                        UUID(conv_id),
                        MessageCreate(role="user", content=user_message_text),
                        user_id=user.id,
                    )

                deps = Deps(db=db, user_id=str(user.id), user_name=user.full_name)

                assistant = get_agent()
                full_response = ""

                # AI SDK v6 UIMessage Stream Protocol:
                # https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol#data-stream-protocol
                msg_id = str(_uuid.uuid4())
                text_part_id = str(_uuid.uuid4())

                # 1. Message start (creates the assistant message bubble in the UI)
                yield sse({"type": "start", "messageId": msg_id})
                # 2. Step start
                yield sse({"type": "start-step"})
                # 3. Text part start
                yield sse({"type": "text-start", "id": text_part_id})

                # 4. Emit conversation_id as a data part so frontend can read it
                yield sse({"type": "data-conversation", "id": str(_uuid.uuid4()), "data": {"conversation_id": conv_id}})

                # 5. Stream text deltas from pydantic-ai
                async with assistant.agent.run_stream(
                    final_prompt,
                    deps=deps,
                    message_history=model_history,
                ) as result:
                    async for text_chunk in result.stream_text(delta=True):
                        full_response += text_chunk
                        yield sse({"type": "text-delta", "id": text_part_id, "delta": text_chunk})

                # 6. Text part end
                yield sse({"type": "text-end", "id": text_part_id})
                # 7. Step finish
                yield sse({"type": "finish-step"})
                # 8. Message finish
                yield sse({"type": "finish"})
                # 9. Stream termination
                yield "data: [DONE]\n\n"

                # Persist assistant response
                if full_response:
                    try:
                        await conv_service.add_message(
                            UUID(conv_id),
                            MessageCreate(role="assistant", content=full_response),
                            user_id=user.id,
                        )
                    except Exception as save_err:
                        logger.warning(f"Could not persist assistant response: {save_err}")

        except Exception as e:
            import sys
            print(f"\n{'='*60}\nCHAT STREAMING ERROR: {type(e).__name__}: {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            print(f"{'='*60}\n", file=sys.stderr)
            logger.exception(f"Error in chat streaming: {e}")
            # Emit error as a stream event
            yield sse({"type": "error", "errorText": f"{type(e).__name__}: {str(e)}"})
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={
            # AI SDK v6 requires this specific header
            "x-vercel-ai-ui-message-stream": "v1",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
