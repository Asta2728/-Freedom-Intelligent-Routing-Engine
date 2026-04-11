"use client";

import { useDataTable } from "@/hooks/use-datatable";
import { FireService, type TicketRead } from "@/lib/api/client";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { flexRender } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { Loader2, ArrowUpDown, User, FileText } from "lucide-react";
import { useTicketsQueryStates } from "../_hooks/use-fire-query-states";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { TicketDetailModal } from "./ticket-detail-modal";
import { BulkDeleteAction } from "./bulk-delete-action";
import { AdvancedExportButton } from "./advanced-export-button";

export function AiAnalyticsList() {
    const [queryState, setQueryState] = useTicketsQueryStates();
    const [selectedTicket, setSelectedTicket] = useState<TicketRead | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ["ai-analytics", queryState],
        queryFn: async () => {
            const response = await FireService.listTicketsApiV1FireTicketsGet({
                query: {
                    page: queryState.page,
                    page_size: queryState.pageSize,
                    sort_by: queryState.sortBy,
                    sort_dir: queryState.sortDir,
                    client_segment: queryState.client_segment,
                    assigned_manager_id: queryState.assigned_manager_id,
                    client_city: queryState.client_city,
                    ai_type: queryState.ai_type,
                    ai_tone: queryState.ai_tone,
                    ai_priority_min: queryState.ai_priority_min,
                    ai_priority_max: queryState.ai_priority_max,
                    ai_language: queryState.ai_language,
                }
            });
            return response.data;
        },
        staleTime: 0, // Always load fresh
    });

    const columns = useMemo<ColumnDef<TicketRead>[]>(() => [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: "id",
            header: () => (
                <Button
                    variant="ghost"
                    onClick={() => setQueryState({
                        sortBy: "id",
                        sortDir: queryState.sortDir === "asc" ? "desc" : "asc"
                    })}
                >
                    Номер обращения
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const ticket = row.original;
                return (
                    <HoverCard>
                        <HoverCardTrigger asChild>
                            <Button variant="outline" className="h-8 px-2 text-xs font-normal border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50">
                                <FileText className="mr-1 h-3 w-3 text-amber-600 dark:text-amber-400" />
                                {ticket.guid.substring(0, 12)}...
                            </Button>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80 border-amber-500/20 shadow-lg">
                            <div className="flex flex-col space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-400">Обращение клиента</h4>
                                    <Badge variant="outline" className="text-[10px]">{ticket.client_segment}</Badge>
                                </div>
                                <div className="text-sm text-foreground my-2 line-clamp-2 leading-snug">
                                    &quot;{ticket.description}&quot;
                                </div>
                                {ticket.ai_analysis?.ai_summary && (
                                    <div className="bg-primary/5 p-2 rounded text-xs leading-relaxed text-primary/80 border border-primary/10 line-clamp-3">
                                        <span className="font-semibold text-primary block mb-0.5 text-[10px] uppercase tracking-wider">Сводка AI</span>
                                        {ticket.ai_analysis.ai_summary}
                                    </div>
                                )}
                                <div className="flex flex-col gap-1 mt-2 text-xs text-muted-foreground border-t pt-2">
                                    <span><span className="font-semibold">ID:</span> {ticket.id}</span>
                                    <span><span className="font-semibold">GUID:</span> {ticket.guid}</span>
                                    {ticket.client_city && <span><span className="font-semibold">Location:</span> {ticket.client_city} {ticket.client_region ? `(${ticket.client_region})` : ""}</span>}
                                </div>
                            </div>
                        </HoverCardContent>
                    </HoverCard>
                );
            }
        },
        {
            id: "priority",
            header: () => (
                <Button
                    variant="ghost"
                    onClick={() => setQueryState({
                        sortBy: "ai_priority",
                        sortDir: queryState.sortDir === "asc" ? "desc" : "asc"
                    })}
                >
                    Приоритет
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            accessorFn: (row) => row.ai_analysis?.ai_priority,
            cell: ({ row }) => {
                const priority = row.original.ai_analysis?.ai_priority;
                if (priority === undefined || priority === null) return <span className="text-muted-foreground text-xs italic">Ожидает</span>;
                return (
                    <Badge variant={priority > 7 ? "destructive" : priority > 4 ? "default" : "secondary"}>
                        {priority}/10
                    </Badge>
                );
            }
        },
        {
            id: "type",
            header: "Классификация",
            accessorFn: (row) => row.ai_analysis?.ai_type,
            cell: ({ row }) => (
                <span className="text-sm font-medium">
                    {row.original.ai_analysis?.ai_type || "-"}
                </span>
            )
        },
        {
            id: "tone",
            header: "Тональность",
            accessorFn: (row) => row.ai_analysis?.ai_tone,
            cell: ({ row }) => (
                <Badge variant="outline" className="text-xs">
                    {row.original.ai_analysis?.ai_tone || "Неизвестно"}
                </Badge>
            )
        },
        {
            id: "language",
            header: "Язык",
            accessorFn: (row) => row.ai_analysis?.ai_language,
            cell: ({ row }) => (
                <span className="text-xs font-mono uppercase text-muted-foreground">
                    {row.original.ai_analysis?.ai_language || "-"}
                </span>
            )
        },
        {
            id: "manager",
            header: "Назначенный менеджер",
            accessorFn: (row) => row.assigned_manager?.full_name,
            cell: ({ row }) => {
                const manager = row.original.assigned_manager;
                if (!manager) return <span className="text-red-500/80 text-xs font-semibold">Не назначен / Блокировка</span>;
                return (
                    <HoverCard>
                        <HoverCardTrigger asChild>
                            <Button variant="outline" className="h-8 px-2 text-xs font-normal border-primary/20 bg-primary/5">
                                <User className="mr-1 h-3 w-3 text-primary" />
                                {manager.full_name}
                            </Button>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80">
                            <div className="flex justify-between space-x-4">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-semibold">{manager.full_name}</h4>
                                    <p className="text-sm text-muted-foreground">Role: {manager.role}</p>
                                    <div className="flex items-center pt-2">
                                        <span className="text-xs text-muted-foreground font-mono">
                                            Current Load: {manager.current_load} tickets
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </HoverCardContent>
                    </HoverCard>
                );
            }
        },
        {
            id: "summary",
            header: "Сводка AI",
            accessorFn: (row) => row.ai_analysis?.ai_summary,
            cell: ({ row }) => {
                const summary = row.original.ai_analysis?.ai_summary;
                if (!summary) {
                    return <span className="text-muted-foreground text-xs italic">Нет AI-сводки</span>;
                }
                return (
                    <span className="text-sm text-muted-foreground truncate max-w-[340px] inline-block" title={summary}>
                        {summary}
                    </span>
                );
            }
        },
        {
            id: "justification",
            header: "Обоснование назначения",
            cell: ({ row }) => {
                const rr = row.original.routing_result as
                    | ({ routing_error?: string | null } & Record<string, unknown>)
                    | null
                    | undefined;
                if (!rr) return <span className="text-muted-foreground text-xs italic">Маршрутизация не применялась</span>;

                if (rr.routing_error) {
                    return <span className="text-destructive text-xs truncate max-w-[200px] inline-block" title={rr.routing_error}>{rr.routing_error}</span>;
                }

                const justification =
                    (typeof rr.justification === "string" ? rr.justification : null) ||
                    "Назначено по стандартным правилам";
                return <span className="text-muted-foreground text-sm truncate max-w-[300px] inline-block" title={justification}>{justification}</span>;
            }
        }
    ], [queryState.sortDir, setQueryState]);

    const table = useDataTable({
        data: (data?.items || []) as TicketRead[],
        columns,
        manualPagination: true,
        pageCount: data?.total_pages || 0,
        paginationState: {
            pageIndex: queryState.page - 1,
            pageSize: queryState.pageSize,
        },
        onPaginationChange: (pagination) => {
            setQueryState({
                page: pagination.pageIndex + 1,
                pageSize: pagination.pageSize,
            });
        },
        sortingState: [{ id: queryState.sortBy, desc: queryState.sortDir === "desc" }],
        onSortingChange: (sorting) => {
            if (sorting.length > 0) {
                setQueryState({
                    sortBy: sorting[0].id,
                    sortDir: sorting[0].desc ? "desc" : "asc",
                });
            }
        },
    });

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const selectedRows = table.getFilteredSelectedRowModel().rows;
    const selectedIds = selectedRows.map(row => row.original.id);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    {selectedIds.length > 0 && (
                        <BulkDeleteAction
                            selectedIds={selectedIds}
                            entityName="Ticket"
                            queryKey={["ai-analytics"]}
                            onSuccess={() => table.resetRowSelection()}
                            mutationFn={(ids) => FireService.bulkDeleteTicketsApiV1FireTicketsDelete({ body: { ids } })}
                        />
                    )}
                </div>
                <AdvancedExportButton
                    data={table.getFilteredRowModel().rows.map(r => r.original)}
                    filename="fire-ai-analytics-export"
                />
            </div>

            <div className="rounded-md border-x border-b border-t">
                <ScrollArea className="h-[calc(100vh-400px)]">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                        className="cursor-pointer hover:bg-primary/5 border-b-primary/5 transition-colors"
                                        onClick={(e) => {
                                            if ((e.target as HTMLElement).closest('button')) return;
                                            setSelectedTicket(row.original);
                                            setIsModalOpen(true);
                                        }}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id} className="py-2.5">
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext()
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={columns.length}
                                        className="h-24 text-center"
                                    >
                                        Метрики пока не сформированы. Ожидание AI-воркера.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </div>

            <div className="p-4 pt-0">
                <DataTablePagination table={table} />
            </div>

            <TicketDetailModal
                ticket={selectedTicket}
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
            />
        </div>
    );
}
