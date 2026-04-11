"use client";

import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { parseAnalyticsRowsFromText } from "./tool-schemas";

type ToolPart = ToolUIPart | DynamicToolUIPart;

const isToolPart = (part: unknown): part is ToolPart => {
  if (!part || typeof part !== "object") {
    return false;
  }

  const candidate = part as { type?: unknown };
  return typeof candidate.type === "string" && (candidate.type.startsWith("tool-") || candidate.type === "dynamic-tool");
};

const getToolName = (part: ToolPart): string => {
  if (part.type === "dynamic-tool") {
    return part.toolName;
  }

  return part.type.replace("tool-", "");
};

const getOutputText = (part: ToolPart): string => {
  if (!part.output) {
    return "";
  }

  if (typeof part.output === "string") {
    return part.output;
  }

  if (typeof part.output === "object" && part.output && "result" in part.output) {
    const result = (part.output as { result?: unknown }).result;
    return typeof result === "string" ? result : "";
  }

  return "";
};

const AnalyticsToolOutput = ({ part }: { part: ToolPart }) => {
  const [chartMode, setChartMode] = useState<"bar" | "pie" | "line">("bar");
  const text = getOutputText(part);
  const rows = parseAnalyticsRowsFromText(text);

  if (!rows.length) {
    return <ToolOutput errorText={part.errorText} output={part.output} />;
  }

  const total = rows.reduce((acc, row) => acc + row.value, 0);
  const top = rows[0];
  const chartColors = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Card className="bg-card/60">
          <CardHeader className="pb-1 pt-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent className="pb-3 text-lg font-semibold">{total.toLocaleString()}</CardContent>
        </Card>
        <Card className="bg-card/60">
          <CardHeader className="pb-1 pt-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Top Bucket</CardTitle>
          </CardHeader>
          <CardContent className="pb-3 text-sm font-semibold">{top?.name ?? "-"}</CardContent>
        </Card>
        <Card className="bg-card/60">
          <CardHeader className="pb-1 pt-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">Top Value</CardTitle>
          </CardHeader>
          <CardContent className="pb-3 text-lg font-semibold">{top ? top.value.toLocaleString() : "0"}</CardContent>
        </Card>
      </div>

      <Card className="border-primary/20 bg-card/60">
        <CardHeader className="pb-2 pt-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">Analytics Distribution</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={chartMode === "bar" ? "default" : "outline"}
                className="h-7 px-2 text-xs"
                onClick={() => setChartMode("bar")}
              >
                Bar
              </Button>
              <Button
                size="sm"
                variant={chartMode === "pie" ? "default" : "outline"}
                className="h-7 px-2 text-xs"
                onClick={() => setChartMode("pie")}
              >
                Pie
              </Button>
              <Button
                size="sm"
                variant={chartMode === "line" ? "default" : "outline"}
                className="h-7 px-2 text-xs"
                onClick={() => setChartMode("line")}
              >
                Line
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="h-[280px] pb-3">
          {chartMode === "bar" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip cursor={{ fill: "var(--accent)" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {rows.map((row, index) => (
                    <Cell key={row.name} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {chartMode === "pie" && (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip />
                <Legend />
                <Pie
                  data={rows}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label
                >
                  {rows.map((row, index) => (
                    <Cell key={row.name} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}

          {chartMode === "line" && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--chart-1)"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {rows.slice(0, 6).map((row) => (
          <Badge key={row.name} variant="secondary" className="text-xs">
            {row.name}: {row.value}
          </Badge>
        ))}
      </div>
    </div>
  );
};

export const ToolResultRenderer = ({ part, className }: { part: unknown; className?: string }) => {
  if (!isToolPart(part)) {
    return null;
  }

  const toolName = getToolName(part);

  return (
    <Tool className={cn("w-full", className)} defaultOpen={part.state === "output-available"}>
      {part.type === "dynamic-tool" ? (
        <ToolHeader type={part.type} state={part.state} toolName={part.toolName} />
      ) : (
        <ToolHeader type={part.type} state={part.state} />
      )}
      <ToolContent>
        <ToolInput input={part.input} />
        {toolName === "get_ticket_analytics" ? (
          <AnalyticsToolOutput part={part} />
        ) : (
          <ToolOutput errorText={part.errorText} output={part.output} />
        )}
      </ToolContent>
    </Tool>
  );
};
