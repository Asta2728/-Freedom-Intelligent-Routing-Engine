import { tool } from "ai";
import {
    analyzeBusinessUnitsInputSchema,
    analyzeBusinessUnitsOutputSchema,
    currentDatetimeInputSchema,
    currentDatetimeOutputSchema,
    executeReadQueryInputSchema,
    executeReadQueryOutputSchema,
    managerWorkloadInputSchema,
    managerWorkloadOutputSchema,
    searchTicketsInputSchema,
    searchTicketsOutputSchema,
    ticketAnalyticsInputSchema,
    ticketAnalyticsOutputSchema,
} from "./tool-schemas";

/**
 * Tool to get the current date and time.
 */
export const createCurrentDatetimeTool = () => tool({
    description: "Get the current date and time.",
    inputSchema: currentDatetimeInputSchema,
    execute: async () => {
        return currentDatetimeOutputSchema.parse({ value: new Date().toLocaleString() });
    }
});

/**
 * Tool to search for service tickets using various filters.
 */
export const createSearchTicketsTool = () => tool({
    description: "Search for service tickets using various filters (city, segment, type, tone).",
    inputSchema: searchTicketsInputSchema,
    execute: async (params) => {
        return searchTicketsOutputSchema.parse({
            result: `Search results for ${JSON.stringify(params)}`,
        });
    }
});

/**
 * Tool to retrieve the current workload for all managers.
 */
export const createGetManagerWorkloadTool = () => tool({
    description: "Retrieve the current workload (number of active tickets) for all managers.",
    inputSchema: managerWorkloadInputSchema,
    execute: async () => {
        return managerWorkloadOutputSchema.parse({ workload: "Manager workload data fetched." });
    }
});

/**
 * Tool to get summary statistics for business units (offices).
 */
export const createAnalyzeBusinessUnitsTool = () => tool({
    description: "Get summary statistics for business units (offices).",
    inputSchema: analyzeBusinessUnitsInputSchema,
    execute: async () => {
        return analyzeBusinessUnitsOutputSchema.parse({ stats: "Business unit statistics analyzed." });
    }
});

/**
 * Tool to execute a raw SQL select query.
 */
export const createExecuteReadQueryTool = () => tool({
    description: "Execute a raw SQL select query against the database (SELECT only).",
    inputSchema: executeReadQueryInputSchema,
    execute: async ({ query }: { query: string }) => {
        return executeReadQueryOutputSchema.parse({ result: `Execution result for query: ${query}` });
    }
});

/**
 * Tool to aggregate ticket analytics by NLP/routing dimensions.
 */
export const createGetTicketAnalyticsTool = () => tool({
    description: "Aggregate ticket analytics by type/tone/language/city/segment/routing dimensions.",
    inputSchema: ticketAnalyticsInputSchema,
    execute: async (params) => {
        return ticketAnalyticsOutputSchema.parse({
            result: [
                `Ticket analytics by '${params.group_by}' (${params.metric}):`,
                "- Консультация: 41",
                "- Жалоба: 23",
                "- Претензия: 11",
                "- Спам: 4",
            ].join("\n"),
        });
    }
});
