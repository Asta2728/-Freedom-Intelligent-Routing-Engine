"""Assistant agent with PydanticAI.

The main conversational agent that can be extended with custom tools.
"""

import logging
import re
from dataclasses import dataclass, field
from typing import Any

from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import (
    ModelRequest,
    ModelResponse,
    SystemPromptPart,
    TextPart,
    UserPromptPart,
    ImageUrl,
)
from typing import Union
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.settings import ModelSettings

from app.agents.prompts import DEFAULT_SYSTEM_PROMPT
from app.agents.tools import get_current_datetime
from app.core.config import settings

logger = logging.getLogger(__name__)


def _resolve_provider_and_model(requested_model: str | None = None) -> tuple[str, str | None, str | None, str]:
    provider = "openai"
    api_key = settings.OPENAI_API_KEY
    base_url = settings.OPENAI_BASE_URL
    default_model = settings.AGENT_MODEL or "gpt-4o-mini"

    model_name = (requested_model or settings.AGENT_MODEL or default_model).strip()

    if not api_key:
        logger.warning("OPENAI_API_KEY is empty; assistant agent calls will fail until it is set.")

    return provider, api_key, base_url, model_name


@dataclass
class Deps:
    """Dependencies for the assistant agent.

    These are passed to tools via RunContext.
    """

    user_id: str | None = None
    user_name: str | None = None
    db: Any = None # AsyncSession from sqlalchemy.ext.asyncio
    metadata: dict[str, Any] = field(default_factory=dict)


class AssistantAgent:
    """Assistant agent wrapper for conversational AI.

    Encapsulates agent creation and execution with tool support.
    """

    def __init__(
        self,
        model: str | Any | None = None,
        temperature: float | None = None,
        system_prompt: str | None = None,
    ):
        self.model = model or settings.AGENT_MODEL or "gpt-4o-mini"
        self.temperature = temperature or settings.AI_TEMPERATURE
        self.system_prompt = system_prompt or DEFAULT_SYSTEM_PROMPT
        self._agent: Agent[Deps, str] | None = None

    def _create_agent(self) -> Agent[Deps, str]:
        """Create and configure the PydanticAI agent."""

        logger.debug(
            f"Creating assistant agent with model={self.model}, temperature={self.temperature}, system_prompt_length={len(self.system_prompt)}",
            extra={
                "model": str(self.model),
                "temperature": self.temperature,
            },
        )
        # If a string is passed, default to OpenAIChatModel with optional VercelProvider
        if isinstance(self.model, str):
            _, api_key, base_url, resolved_model = _resolve_provider_and_model(self.model)
            logger.info("Assistant OpenAI model resolved: %s", resolved_model)

            model = OpenAIChatModel(
                resolved_model,
                provider=OpenAIProvider(api_key=api_key, base_url=base_url),
            )
        else:
            model = self.model

        agent = Agent[Deps, str](
            model=model,
            model_settings=ModelSettings(temperature=self.temperature),
            system_prompt=self.system_prompt,
        )

        self._register_tools(agent)

        return agent

    def _register_tools(self, agent: Agent[Deps, str]) -> None:
        """Register all tools on the agent."""

        @agent.tool
        async def current_datetime(ctx: RunContext[Deps]) -> str:
            """Get the current date and time.

            Use this tool when you need to know the current date or time.
            """
            return get_current_datetime()

        @agent.tool
        async def start_requirements_task(
            ctx: RunContext[Deps],
            scope: str = "full",
            focus_area: str | None = None,
            include_estimates: bool = True,
        ) -> str:
            """Create a structured FIRE implementation checklist to start execution.

            Use this when the user asks to "start task", "create plan", or
            wants a robust step-by-step implementation roadmap.
            """
            normalized_scope = (scope or "full").strip().lower()
            focus = (focus_area or "all areas").strip()

            if normalized_scope not in {"full", "backend", "frontend", "agent", "infra"}:
                return "Error: Invalid scope. Use one of: full, backend, frontend, agent, infra"

            estimates = {
                "P0": "1-2 days",
                "P1": "2-4 days",
                "P2": "1-2 days",
            }

            lines = [
                "FIRE Requirements Task Plan",
                f"- Scope: {normalized_scope}",
                f"- Focus: {focus}",
                "",
                "P0 — Critical",
                "1) Validate NLP + routing correctness against production samples",
                "2) Enforce chart-output contract for assistant responses",
                "3) Add regression checks for geocoding fallback and manager assignment",
                "",
                "P1 — Important",
                "4) Add analytics-ready endpoints for grouped distributions",
                "5) Improve agent SQL guardrails and query templates",
                "6) Add UI interaction presets for main table filters",
                "",
                "P2 — Quality",
                "7) Add richer chart variants + UX polish",
                "8) Add performance dashboard for <=10s SLA tracking",
                "9) Add runbook/docs for incident triage and data quality",
            ]

            if include_estimates:
                lines.extend(
                    [
                        "",
                        "Estimated effort:",
                        f"- P0: {estimates['P0']}",
                        f"- P1: {estimates['P1']}",
                        f"- P2: {estimates['P2']}",
                    ]
                )

            return "\n".join(lines)

        @agent.tool
        async def get_fire_pipeline_health(ctx: RunContext[Deps]) -> str:
            """Summarize FIRE pipeline health using DB-level counts.

            Use this to quickly assess ingestion/analysis/routing completeness.
            """
            from sqlalchemy import select, func
            from app.db.models.fire import Ticket, TicketAIAnalysis, RoutingResult

            if not ctx.deps.db:
                return "Error: No database connection"

            total_tickets = (await ctx.deps.db.execute(select(func.count(Ticket.id)))).scalar() or 0
            analyzed = (
                await ctx.deps.db.execute(select(func.count(TicketAIAnalysis.id)))
            ).scalar() or 0
            routed = (
                await ctx.deps.db.execute(select(func.count(RoutingResult.id)))
            ).scalar() or 0
            geocoded = (
                await ctx.deps.db.execute(
                    select(func.count(Ticket.id)).where(Ticket.latitude.is_not(None), Ticket.longitude.is_not(None))
                )
            ).scalar() or 0

            def pct(value: int) -> float:
                return (value / total_tickets * 100.0) if total_tickets else 0.0

            out = ["FIRE Pipeline Health:"]
            out.append(f"- Tickets total: {total_tickets}")
            out.append(f"- AI analyzed: {analyzed} ({pct(analyzed):.1f}%)")
            out.append(f"- Geocoded: {geocoded} ({pct(geocoded):.1f}%)")
            out.append(f"- Routing results: {routed} ({pct(routed):.1f}%)")

            if total_tickets and (analyzed < total_tickets or routed < total_tickets):
                out.append("- Status: Partial completion detected; inspect task logs for bottlenecks.")
            else:
                out.append("- Status: Pipeline appears complete for current ticket set.")

            return "\n".join(out)

        @agent.tool
        async def search_tickets(
            ctx: RunContext[Deps],
            client_city: str | None = None,
            client_segment: str | None = None,
            ai_type: str | None = None,
            ai_tone: str | None = None,
            limit: int = 5
        ) -> str:
            """Search for service tickets using various filters.
            
            Use this to find specific tickets or groups of tickets (e.g. 'Show me complaints in Almaty').
            """
            from sqlalchemy import select
            from app.db.models.fire import Ticket, TicketAIAnalysis
            
            if not ctx.deps.db: return "Error: No database connection"
            
            query = select(Ticket).join(Ticket.ai_analysis)
            if client_city:
                query = query.where(Ticket.client_city.ilike(f"%{client_city}%"))
            if client_segment:
                query = query.where(Ticket.client_segment == client_segment)
            if ai_type:
                query = query.where(TicketAIAnalysis.ai_type == ai_type)
            if ai_tone:
                query = query.where(TicketAIAnalysis.ai_tone == ai_tone)
                
            query = query.limit(limit)
            result = await ctx.deps.db.execute(query)
            tickets = result.scalars().all()
            
            if not tickets: return "No tickets found matching the criteria."
            
            out = []
            for t in tickets:
                out.append(f"- [{t.client_city}] Ticket {t.id}: {t.description[:60]}... [Segment: {t.client_segment}]")
            return "\n".join(out)

        @agent.tool
        async def get_manager_workload(ctx: RunContext[Deps]) -> str:
            """Retrieve the current workload (number of active tickets) for all managers.
            
            Use this to answer questions about manager capacity or identifying busy specialists.
            """
            from sqlalchemy import select, func
            from app.db.models.fire import Manager, BusinessUnit
            
            if not ctx.deps.db: return "Error: No database connection"
            
            query = select(Manager).join(Manager.business_unit)
            result = await ctx.deps.db.execute(query)
            managers = result.scalars().all()
            
            if not managers: return "No managers found."
            
            out = ["Current Manager Workload:"]
            for m in managers:
                out.append(f"- {m.full_name} ({m.role}) at {m.business_unit.name}: {m.current_load} tickets")
            return "\n".join(out)

        @agent.tool
        async def get_ticket_analytics(
            ctx: RunContext[Deps],
            group_by: str = "ai_type",
            metric: str = "count",
            city: str | None = None,
            segment: str | None = None,
            language: str | None = None,
            tone: str | None = None,
            assignment_method: str | None = None,
            limit: int = 20,
        ) -> str:
            """Return grouped FIRE analytics for tickets and NLP/routing attributes.

            Use this for natural-language analytics such as:
            - distribution of ticket types by city
            - sentiment/language breakdown
            - routing method statistics
            - average AI priority by group
            """
            from sqlalchemy import select, func
            from app.db.models.fire import Ticket, TicketAIAnalysis, RoutingResult, Manager, BusinessUnit

            if not ctx.deps.db:
                return "Error: No database connection"

            group_by_map = {
                "ai_type": TicketAIAnalysis.ai_type,
                "ai_tone": TicketAIAnalysis.ai_tone,
                "ai_language": TicketAIAnalysis.ai_language,
                "client_city": Ticket.client_city,
                "client_segment": Ticket.client_segment,
                "assignment_method": RoutingResult.assignment_method,
                "manager": Manager.full_name,
                "business_unit": BusinessUnit.name,
            }

            if group_by not in group_by_map:
                return (
                    "Error: Invalid group_by value. "
                    "Use one of: " + ", ".join(group_by_map.keys())
                )

            metric = (metric or "count").lower().strip()
            if metric not in {"count", "avg_priority"}:
                return "Error: Invalid metric. Use one of: count, avg_priority"

            safe_limit = max(1, min(limit, 100))
            group_col = group_by_map[group_by]

            if metric == "count":
                metric_col = func.count(Ticket.id).label("value")
            else:
                metric_col = func.avg(TicketAIAnalysis.ai_priority).label("value")

            query = (
                select(group_col.label("group"), metric_col)
                .select_from(Ticket)
                .outerjoin(TicketAIAnalysis, TicketAIAnalysis.ticket_id == Ticket.id)
                .outerjoin(RoutingResult, RoutingResult.ticket_id == Ticket.id)
                .outerjoin(Manager, Manager.id == Ticket.assigned_manager_id)
                .outerjoin(BusinessUnit, BusinessUnit.id == Manager.business_unit_id)
            )

            if city:
                query = query.where(Ticket.client_city.ilike(f"%{city}%"))
            if segment:
                query = query.where(Ticket.client_segment.ilike(segment))
            if language:
                query = query.where(TicketAIAnalysis.ai_language.ilike(language))
            if tone:
                query = query.where(TicketAIAnalysis.ai_tone.ilike(tone))
            if assignment_method:
                query = query.where(RoutingResult.assignment_method.ilike(assignment_method))

            query = (
                query.group_by(group_col)
                .order_by(func.count(Ticket.id).desc())
                .limit(safe_limit)
            )

            result = await ctx.deps.db.execute(query)
            rows = result.all()

            if not rows:
                return "No analytics data found for the specified filters."

            out = [f"Ticket analytics by '{group_by}' ({metric}):"]
            for group_value, value in rows:
                label = str(group_value) if group_value is not None else "Unknown"
                if metric == "avg_priority" and value is not None:
                    out.append(f"- {label}: {float(value):.2f}")
                else:
                    out.append(f"- {label}: {value}")

            return "\n".join(out)

        @agent.tool
        async def analyze_business_units(ctx: RunContext[Deps]) -> str:
            """Get summary statistics for business units (offices).
            
            Use this to analyze regional performance or ticket distributions across offices.
            """
            from sqlalchemy import select, func
            from app.db.models.fire import BusinessUnit, Ticket
            
            if not ctx.deps.db: return "Error: No database connection"
            
            # Count tickets per BU
            query = select(BusinessUnit.name, func.count(Ticket.id)).join(Ticket, Ticket.assigned_manager_id != None).join(BusinessUnit, BusinessUnit.id == BusinessUnit.id).group_by(BusinessUnit.name)
            # Actually, to be accurate we should join properly through assigned_manager
            from app.db.models.fire import Manager
            query = select(BusinessUnit.name, func.count(Ticket.id))\
                .join(Manager, Manager.business_unit_id == BusinessUnit.id)\
                .join(Ticket, Ticket.assigned_manager_id == Manager.id)\
                .group_by(BusinessUnit.name)
                
            result = await ctx.deps.db.execute(query)
            stats = result.all()
            
            if not stats: return "No distribution data available."
            
            out = ["Regional Ticket Distribution:"]
            for name, count in stats:
                out.append(f"- {name}: {count} tickets")
            return "\n".join(out)

        @agent.tool
        async def execute_read_query(ctx: RunContext[Deps], query: str) -> str:
            """Execute a raw SQL select query against the PostgreSQL database.
            
            Use this tool to extract dynamic insights, aggregations, or specific stats 
            that don't have dedicated tools (e.g. JOINs across tables, GROUP BY operations).
            
            ONLY SELECT operations are permitted.
            """
            import logging
            from sqlalchemy import text
            from sqlalchemy.exc import SQLAlchemyError
            logger = logging.getLogger(__name__)

            if not ctx.deps.db: 
                return "Error: No database connection"

            normalized = (query or "").strip()
            if not normalized:
                return "Error: Empty query."

            if normalized.rstrip().endswith(";"):
                normalized = normalized.rstrip()[:-1].rstrip()

            if ";" in normalized:
                return "Error: Multiple statements are not allowed. Provide a single SELECT query."

            if not re.match(r"^(select|with)\b", normalized, flags=re.IGNORECASE):
                return "Error: Only SELECT/CTE read queries are permitted."

            if re.search(
                r"\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|execute|call|copy)\b",
                normalized,
                flags=re.IGNORECASE,
            ):
                return "Error: Read-only access violation. Only SELECT statements are permitted."

            try:
                # Need to use the async session's execute wrapper
                result = await ctx.deps.db.execute(text(normalized))
                rows = result.fetchall()
                keys = result.keys()
                
                if not rows:
                    return "Query executed successfully, but returned 0 rows."
                
                out = [f"Result: {len(rows)} rows"]
                out.append(" | ".join(str(k) for k in keys))
                out.append("-" * 50)
                
                for row in rows[:100]: # limit output to prevent massive context explosion
                    out.append(" | ".join(str(v) for v in row))
                    
                if len(rows) > 100:
                    out.append("... (truncated at 100 rows)")
                    
                return "\n".join(out)
            except SQLAlchemyError as e:
                err = str(e)
                logger.error(f"SQL Execution error details: {err}")

                lowered = err.lower()
                if "ai_priority" in lowered and ("does not exist" in lowered or "undefinedcolumn" in lowered):
                    return (
                        "SQL Error: `ai_priority` is not in `tickets`; it belongs to `ticket_ai_analyses`. "
                        "Use a JOIN, for example: "
                        "SELECT t.client_city, AVG(a.ai_priority) "
                        "FROM tickets t JOIN ticket_ai_analyses a ON a.ticket_id = t.id "
                        "GROUP BY t.client_city;"
                    )

                return f"SQL Error executing query: {err}. Please try adjusting your syntax or column names."

    @property
    def agent(self) -> Agent[Deps, str]:
        """Get or create the agent instance."""
        if self._agent is None:
            self._agent = self._create_agent()
        return self._agent

    async def run(
        self,
        user_input: Union[str, list[Union[str, ImageUrl]]],
        history: list[dict[str, Any]] | None = None,
        deps: Deps | None = None,
    ) -> tuple[str, list[Any], Deps]:
        """Run agent and return the output along with tool call events.

        Args:
            user_input: User's message (text or multi-part).
            history: Conversation history.
            deps: Optional dependencies.

        Returns:
            Tuple of (output_text, tool_events, deps).
        """
        model_history: list[ModelRequest | ModelResponse] = []

        for msg in history or []:
            role = msg.get("role")
            content = msg.get("content", "")
            if role == "user":
                model_history.append(ModelRequest(parts=[UserPromptPart(content=content)]))
            elif role == "assistant":
                model_history.append(ModelResponse(parts=[TextPart(content=content)]))
            elif role == "system":
                model_history.append(ModelRequest(parts=[SystemPromptPart(content=content)]))

        agent_deps = deps if deps is not None else Deps()

        logger.info(f"Running agent with user input: {user_input[:100]}...")
        result = await self.agent.run(user_input, deps=agent_deps, message_history=model_history)

        tool_events: list[Any] = []
        for message in result.all_messages():
            if hasattr(message, "parts"):
                for part in message.parts:
                    if hasattr(part, "tool_name"):
                        tool_events.append(part)

        logger.info(f"Agent run complete. Output length: {len(result.output)} chars")

        return result.output, tool_events, agent_deps

    async def iter(
        self,
        user_input: Union[str, list[Union[str, ImageUrl]]],
        history: list[dict[str, Any]] | None = None,
        deps: Deps | None = None,
    ):
        """Stream agent execution with full event access.

        Args:
            user_input: User's message (text or multi-part).
            history: Conversation history.
            deps: Optional dependencies.

        Yields:
            Agent events for streaming responses.
        """
        model_history: list[ModelRequest | ModelResponse] = []

        for msg in history or []:
            role = msg.get("role")
            content = msg.get("content", "")
            if role == "user":
                model_history.append(ModelRequest(parts=[UserPromptPart(content=content)]))
            elif role == "assistant":
                model_history.append(ModelResponse(parts=[TextPart(content=content)]))
            elif role == "system":
                model_history.append(ModelRequest(parts=[SystemPromptPart(content=content)]))

        agent_deps = deps if deps is not None else Deps()

        async with self.agent.iter(
            user_input,
            deps=agent_deps,
            message_history=model_history,
        ) as run:
            async for event in run:
                yield event


def get_agent(model: Any | None = None) -> AssistantAgent:
    """Factory function to create an AssistantAgent.

    Returns:
        Configured AssistantAgent instance.
    """
    return AssistantAgent(model=model)


async def run_agent(
    user_input: str,
    history: list[dict[str, str]],
    deps: Deps | None = None,
) -> tuple[str, list[Any], Deps]:
    """Run agent and return the output along with tool call events.

    This is a convenience function for backwards compatibility.

    Args:
        user_input: User's message.
        history: Conversation history.
        deps: Optional dependencies.

    Returns:
        Tuple of (output_text, tool_events, deps).
    """
    agent = get_agent()
    return await agent.run(user_input, history, deps)