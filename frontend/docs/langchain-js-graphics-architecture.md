# LangChain + Graphics (Production JS Blueprint)

## Recommended Stack

- Agent orchestration: `langchain` + `@langchain/langgraph`
- LLM provider adapters: OpenAI / Anthropic via LangChain model wrappers
- Typed tool contracts: `zod`
- Streaming chat transport: `@ai-sdk/react` + server SSE route
- Chart rendering: `recharts` (already in project)
- UX animation: `motion` (already in project)

## Why This Stack

- `LangGraph` provides durable stateful agent workflows (multi-step planning + retries).
- `LangChain` tools map naturally to your FIRE analytics functions.
- `zod` keeps tool input/output contracts aligned with backend schemas.
- `recharts` + `motion` gives production-ready animated dashboards with good SSR/client compatibility in Next.js.

## Implementation Plan

1. Create JS agent runtime (Next.js server route)
   - File: `src/app/api/agent/langgraph/route.ts`
   - Build graph nodes:
     - intent classification
     - tool planner
     - tool execution
     - response synthesis

2. Add typed tools mapped to FIRE tables
   - `tickets`: ai_type, ai_tone, ai_language, client_city, segment
   - `managers`: role, skills, current_load, business_unit
   - `business_units`: office stats
   - `routing_results`: assignment_method, errors

3. Add chart-spec output contract
   - Agent always returns either:
     - plain explanation, or
     - chart spec `{type,title,data[]}`
   - Frontend renders through `ChartRenderer`.

4. Add reliability controls
   - tool timeout + retry policy
   - response size limits
   - fallback answer when chart data invalid

5. Add production observability
   - request ID propagation
   - structured logs per graph node
   - timing metrics (tool latency, total latency)

## Minimal First Deliverable

- One LangGraph flow for analytics questions only
- Three tools:
  - `get_ticket_analytics`
  - `get_manager_workload`
  - `analyze_business_units`
- Render chart + summary in chat with current components

## Nice-to-have Next

- Natural language filter parser (`city=...`, `segment=...`) into typed `zod` tool inputs
- Cached analytics snapshots for fast repeated chart queries
- Agent memory per conversation for follow-up chart refinement
