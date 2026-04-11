"use client";

import { useTaskLogsQueryStates } from "../_hooks/use-fire-query-states";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { RotateCcw, Filter } from "lucide-react";
import { TaskAction } from "@/lib/api/client";

export function TaskLogFilters() {
    const [queryState, setQueryState] = useTaskLogsQueryStates();

    const resetFilters = () => {
        setQueryState({
            action: null,
            page: 1,
        });
    };

    const actions: (TaskAction | "ALL")[] = [
        "ALL",
        "START",
        "INFO",
        "WARN",
        "SUCCESS",
        "ERROR",
        "AI_ENRICHED",
        "GEOCODED",
        "ROUTED",
    ];

    return (
        <div className="flex flex-wrap items-center gap-4 py-4">
            <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filter Logs:</span>
            </div>

            <Select
                value={queryState.action || "ALL"}
                onValueChange={(value) =>
                    setQueryState({
                        action: value === "ALL" ? null : (value as TaskAction),
                        page: 1,
                    })
                }
            >
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Action Type" />
                </SelectTrigger>
                <SelectContent>
                    {actions.map((action) => (
                        <SelectItem key={action} value={action}>
                            {action === "ALL" ? "All Actions" : action}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Button
                variant="ghost"
                onClick={resetFilters}
                className="h-8 px-2 lg:px-3"
            >
                Reset
                <RotateCcw className="ml-2 h-4 w-4" />
            </Button>
        </div>
    );
}
