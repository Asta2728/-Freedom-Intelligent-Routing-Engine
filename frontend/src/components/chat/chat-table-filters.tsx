"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MainTable = "tickets" | "managers" | "business_units" | "routing_results";

interface TableFilterPreset {
  label: string;
  prompt: string;
}

const PRESETS: Record<MainTable, TableFilterPreset[]> = {
  tickets: [
    {
      label: "VIP in Almaty",
      prompt:
        "Use main table filters: table=tickets, client_segment=VIP, client_city=Алматы. Show distribution by ai_type and include a pie chart.",
    },
    {
      label: "Negative tones",
      prompt:
        "Use main table filters: table=tickets, ai_tone=Негативный. Show top cities and required actions.",
    },
    {
      label: "ENG tickets",
      prompt:
        "Use main table filters: table=tickets, ai_language=ENG. Show manager assignment coverage and risks.",
    },
  ],
  managers: [
    {
      label: "High workload",
      prompt:
        "Use main table filters: table=managers, current_load>=10. Show busiest managers and balancing proposals.",
    },
    {
      label: "VIP skill",
      prompt:
        "Use main table filters: table=managers, skills contains VIP. Compare by business_unit.",
    },
  ],
  business_units: [
    {
      label: "Office load compare",
      prompt:
        "Use main table filters: table=business_units. Compare ticket volume and average priority per office.",
    },
    {
      label: "Nearest office quality",
      prompt:
        "Use main table filters: table=business_units. Evaluate geo routing quality and fallback usage.",
    },
  ],
  routing_results: [
    {
      label: "Fallback usage",
      prompt:
        "Use main table filters: table=routing_results, assignment_method like geo_fallback%. Show ratio by city.",
    },
    {
      label: "Failed routing",
      prompt:
        "Use main table filters: table=routing_results, routing_error is not null. Summarize root causes and fixes.",
    },
  ],
};

interface ChatTableFiltersProps {
  onApply: (prompt: string) => void;
}

export function ChatTableFilters({ onApply }: ChatTableFiltersProps) {
  const [table, setTable] = useState<MainTable>("tickets");

  const presets = useMemo(() => PRESETS[table], [table]);

  return (
    <div className="mb-3 rounded-md border bg-card/60 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">Main Tables</Badge>
          <span className="text-xs text-muted-foreground">Apply table-based filters</span>
        </div>
        <Select value={table} onValueChange={(value) => setTable(value as MainTable)}>
          <SelectTrigger size="sm" className="h-7 min-w-40">
            <SelectValue placeholder="Select table" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tickets">tickets</SelectItem>
            <SelectItem value="managers">managers</SelectItem>
            <SelectItem value="business_units">business_units</SelectItem>
            <SelectItem value="routing_results">routing_results</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onApply(preset.prompt)}
          >
            {preset.label}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          className="h-7 text-xs"
          onClick={() =>
            onApply(
              "Start requirements task: map missing FIRE backend/agent features, prioritize P0/P1, and produce an implementation checklist with owners and ETA."
            )
          }
        >
          Start Requirements Task
        </Button>
      </div>
    </div>
  );
}
