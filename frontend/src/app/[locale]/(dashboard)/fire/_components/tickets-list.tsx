"use client";

import { useDataTable } from "@/hooks/use-datatable";
import { FireService, type TicketRead } from "@/lib/api/client";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { flexRender } from "@tanstack/react-table";
import { useMemo } from "react";
import { Loader2, ArrowUpDown, FileText } from "lucide-react";
import { useTicketsQueryStates } from "../_hooks/use-fire-query-states";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { BulkDeleteAction } from "./bulk-delete-action";
import { AdvancedExportButton } from "./advanced-export-button";

export function TicketsList() {
    const [queryState, setQueryState] = useTicketsQueryStates();

    const { data, isLoading } = useQuery({
        queryKey: ["tickets", queryState],
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
        staleTime: 0,
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
                            <Button variant="outline" className="h-8 px-2 text-xs font-normal border-primary/20 bg-primary/5 hover:bg-primary/10">
                                <FileText className="mr-1 h-3 w-3 text-primary" />
                                {ticket.guid.substring(0, 12)}...
                            </Button>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80 shadow-lg" side="right">
                            <div className="flex flex-col space-y-3">
                                <div className="flex items-center justify-between border-b pb-2">
                                    <h4 className="text-sm font-semibold flex items-center gap-1">
                                        <FileText className="h-4 w-4 text-primary" />
                                        Данные клиента
                                    </h4>
                                    <Badge variant="secondary" className="text-[10px]">{ticket.client_segment}</Badge>
                                </div>

                                <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">GUID</span>
                                        <span className="font-mono">{ticket.guid}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">ID</span>
                                        <span className="font-mono text-[10px]">{ticket.id}</span>
                                    </div>

                                    {(ticket.client_gender || ticket.client_dob) && (
                                        <div className="flex justify-between border-t pt-1 mt-1">
                                            <span className="text-muted-foreground">Profile</span>
                                            <span className="font-medium text-right flex flex-col items-end">
                                                {ticket.client_gender && <span>{ticket.client_gender}</span>}
                                                {ticket.client_dob && <span>{format(new Date(ticket.client_dob), "PP")}</span>}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex flex-col border-t pt-1 mt-1 gap-0.5">
                                        <span className="text-muted-foreground mb-0.5">Location</span>
                                        <span className="text-right font-medium">
                                            {[ticket.client_country, ticket.client_region, ticket.client_city].filter(Boolean).join(", ")}
                                        </span>
                                        <span className="text-right text-[10px] text-muted-foreground">
                                            {[ticket.client_street, ticket.client_building].filter(Boolean).join(", ")}
                                        </span>
                                        {(ticket.latitude && ticket.longitude) && (
                                            <span className="text-right text-[10px] font-mono opacity-50">
                                                Lat: {ticket.latitude.toFixed(4)}, Lon: {ticket.longitude.toFixed(4)}
                                            </span>
                                        )}
                                    </div>

                                    {ticket.attachment_path && (
                                        <div className="flex justify-between border-t pt-1 mt-1 items-center">
                                            <span className="text-muted-foreground">Attachments</span>
                                            <Badge variant="outline" className="text-[9px]">Included</Badge>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </HoverCardContent>
                    </HoverCard>
                );
            }
        },
        {
            accessorKey: "client_segment",
            header: "Сегмент",
            cell: ({ row }) => (
                <Badge variant="outline">
                    {row.original.client_segment}
                </Badge>
            )
        },
        {
            accessorKey: "description",
            header: "Описание",
            cell: ({ row }) => (
                <div className="max-w-[300px] truncate" title={row.original.description}>
                    {row.original.description}
                </div>
            )
        },
        {
            id: "ai_summary",
            header: "Сводка AI",
            accessorFn: (row) => row.ai_analysis?.ai_summary,
            cell: ({ row }) => {
                const summary = row.original.ai_analysis?.ai_summary;
                if (!summary) {
                    return <span className="text-xs italic text-muted-foreground">Нет AI-сводки</span>;
                }
                return (
                    <span className="inline-block max-w-[320px] truncate text-sm text-muted-foreground" title={summary}>
                        {summary}
                    </span>
                );
            },
        },
        {
            id: "assigned_manager",
            header: "Назначенный менеджер",
            accessorFn: (row) => row.assigned_manager?.full_name,
            cell: ({ row }) => {
                const managerName = row.original.assigned_manager?.full_name;
                if (!managerName) {
                    return <span className="text-xs italic text-muted-foreground">Не назначен</span>;
                }
                return <span className="text-sm">{managerName}</span>;
            },
        },
        {
            accessorKey: "created_at",
            header: () => (
                <Button
                    variant="ghost"
                    onClick={() => setQueryState({
                        sortBy: "created_at",
                        sortDir: queryState.sortDir === "asc" ? "desc" : "asc"
                    })}
                >
                    Создано
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => format(new Date(row.original.created_at), "PPp")
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
                            queryKey={["tickets"]}
                            onSuccess={() => table.resetRowSelection()}
                            mutationFn={(ids) => FireService.bulkDeleteTicketsApiV1FireTicketsDelete({ body: { ids } })}
                        />
                    )}
                </div>
                <AdvancedExportButton
                    data={table.getFilteredRowModel().rows.map(r => r.original)}
                    filename="fire-tickets-export"
                />
            </div>

            <div className="rounded-md border">
                <ScrollArea className="h-[calc(100vh-400px)]">
                    <Table>
                        <TableHeader>
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
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id}>
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
                                        Нет данных.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </div>
            <DataTablePagination table={table} />
        </div>
    );
}
