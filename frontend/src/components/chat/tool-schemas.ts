import { z } from "zod";

export const currentDatetimeInputSchema = z.object({});
export const currentDatetimeOutputSchema = z.object({
  value: z.string(),
});

export const searchTicketsInputSchema = z.object({
  client_city: z.string().optional(),
  client_segment: z.string().optional(),
  ai_type: z.string().optional(),
  ai_tone: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(5),
});
export const searchTicketsOutputSchema = z.object({
  result: z.string(),
});

export const managerWorkloadInputSchema = z.object({});
export const managerWorkloadOutputSchema = z.object({
  workload: z.string(),
});

export const analyzeBusinessUnitsInputSchema = z.object({});
export const analyzeBusinessUnitsOutputSchema = z.object({
  stats: z.string(),
});

export const executeReadQueryInputSchema = z.object({
  query: z.string().min(1),
});
export const executeReadQueryOutputSchema = z.object({
  result: z.string(),
});

export const ticketAnalyticsInputSchema = z.object({
  group_by: z
    .enum([
      "ai_type",
      "ai_tone",
      "ai_language",
      "client_city",
      "client_segment",
      "assignment_method",
      "manager",
      "business_unit",
    ])
    .default("ai_type"),
  metric: z.enum(["count", "avg_priority"]).default("count"),
  city: z.string().optional(),
  segment: z.string().optional(),
  language: z.string().optional(),
  tone: z.string().optional(),
  assignment_method: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export const ticketAnalyticsOutputSchema = z.object({
  result: z.string(),
});

export type TicketAnalyticsInput = z.infer<typeof ticketAnalyticsInputSchema>;

export type AnalyticsRow = {
  name: string;
  value: number;
};

export const parseAnalyticsRowsFromText = (text: string): AnalyticsRow[] => {
  const lines = text.split("\n").map((line) => line.trim());
  const rows: AnalyticsRow[] = [];

  for (const line of lines) {
    if (!line.startsWith("- ")) {
      continue;
    }

    const body = line.slice(2);
    const separatorIndex = body.lastIndexOf(":");
    if (separatorIndex < 0) {
      continue;
    }

    const label = body.slice(0, separatorIndex).trim();
    const rawValue = body.slice(separatorIndex + 1).trim();
    const numeric = Number.parseFloat(rawValue.replace(/,/g, ""));

    if (!label || Number.isNaN(numeric)) {
      continue;
    }

    rows.push({
      name: label,
      value: numeric,
    });
  }

  return rows;
};
