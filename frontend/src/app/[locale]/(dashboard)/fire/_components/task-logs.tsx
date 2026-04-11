"use client";

import { useQuery } from "@tanstack/react-query";
import { FireService, type TaskLogRead } from "@/lib/api/client";
import { useTaskLogsQueryStates } from "../_hooks/use-fire-query-states";
import { format } from "date-fns";
import { Loader2, Terminal as TerminalIcon } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

interface TaskLogsProps {
    taskId: string;
}

export function TaskLogs({ taskId }: TaskLogsProps) {
    const [queryState] = useTaskLogsQueryStates();

    const listQuery = useQuery({
        queryKey: ["task-logs", taskId, queryState],
        queryFn: async () => {
            const response = await FireService.getTaskLogsApiV1FireTasksTaskIdLogsGet({
                path: { task_id: taskId },
                query: {
                    page: queryState.page,
                    page_size: 100, // Show more logs in terminal
                    action: queryState.action,
                }
            });
            return response.data;
        },
        refetchInterval: 3000, // Polling every 3 seconds for "streaming" effect
    });

    const logs = listQuery.data;
    const defaultOpenItems = useMemo(
        () => (logs?.items ?? []).slice(-3).map((log) => String(log.id)),
        [logs?.items]
    );

    if (listQuery.isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const resolvedLogs = logs!;

    const actionBadgeClass = (action: TaskLogRead["action"]) => {
        if (action === "ERROR") return "bg-destructive/15 text-destructive border-destructive/30";
        if (action === "SUCCESS") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
        if (action === "START") return "bg-sky-500/15 text-sky-400 border-sky-500/30";
        if (action === "WARN") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
        if (action === "AI_ENRICHED") return "bg-purple-500/15 text-purple-300 border-purple-500/30";
        return "bg-muted text-muted-foreground border-border";
    };

    const messageClass = (action: TaskLogRead["action"]) => {
        if (action === "ERROR") return "text-destructive";
        if (action === "SUCCESS") return "text-emerald-400";
        if (action === "WARN") return "text-amber-400";
        return "text-foreground";
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-2 py-1 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                <TerminalIcon className="h-3 w-3" />
                Live Execution Logs
            </div>
            <div className="rounded-lg border bg-card p-3 font-mono text-xs shadow-sm">
                <div
                    className="h-[500px] overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    {resolvedLogs.items.length > 0 ? (
                        <Accordion type="multiple" defaultValue={defaultOpenItems} className="space-y-1">
                            {resolvedLogs.items.map((log) => (
                                <AccordionItem key={log.id} value={String(log.id)} className="rounded-md border border-border/70 px-2">
                                    <AccordionTrigger className="py-2 hover:no-underline">
                                        <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                                            <span className="shrink-0 text-[10px] text-muted-foreground">
                                                {format(new Date(log.created_at), "HH:mm:ss")}
                                            </span>
                                            <Badge
                                                variant="outline"
                                                className={cn("h-5 px-1.5 text-[9px] uppercase font-semibold tracking-wider", actionBadgeClass(log.action))}
                                            >
                                                {log.action}
                                            </Badge>
                                            <span className={cn("line-clamp-1 break-all text-[11px] font-medium", messageClass(log.action))}>
                                                {log.message}
                                            </span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pb-2">
                                        <div className="space-y-1 rounded-md border border-border/60 bg-muted/30 p-2">
                                            <div className="text-[10px] text-muted-foreground">
                                                {format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss")}
                                            </div>
                                            <div className={cn("text-[11px] leading-relaxed break-all", messageClass(log.action))}>
                                                {log.message}
                                            </div>
                                            {log.data && (
                                                <pre className="max-h-56 overflow-auto rounded bg-background/80 p-2 text-[10px] text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                                    {JSON.stringify(log.data, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                        <div className="py-12 text-center text-muted-foreground italic flex flex-col items-center gap-2">
                            <TerminalIcon className="h-6 w-6 opacity-30" />
                            <span>Waiting for logs to stream...</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
