"use client";

import { useDataTable } from "@/hooks/use-datatable";
import { FireService, type BackgroundTaskRead } from "@/lib/api/client";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { flexRender } from "@tanstack/react-table";
import { useMemo } from "react";
import { CheckSquare, Loader2, AlertCircle, Clock, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";
import { useTasksQueryStates } from "../_hooks/use-fire-query-states";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/routing";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkDeleteAction } from "./bulk-delete-action";

export function TasksList() {
    const [queryState, setQueryState] = useTasksQueryStates();
    const router = useRouter();

    const { data, isLoading } = useQuery({
        queryKey: ["tasks", queryState],
        queryFn: async () => {
            const response = await FireService.listTasksApiV1FireTasksGet({
                query: {
                    page: queryState.page,
                    page_size: queryState.pageSize,
                    sort_by: queryState.sortBy,
                    sort_dir: queryState.sortDir,
                    status: queryState.status,
                    task_name: queryState.task_name,
                    ticket_id: queryState.ticket_id,
                }
            });
            return response.data;
        },
        staleTime: 0,
    });

    const columns = useMemo<ColumnDef<BackgroundTaskRead>[]>(() => [
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
                <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                        aria-label="Select row"
                    />
                </div>
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: "task_name",
            header: () => (
                <Button
                    variant="ghost"
                    onClick={() => setQueryState({
                        sortBy: "task_name",
                        sortDir: queryState.sortDir === "asc" ? "desc" : "asc"
                    })}
                >
                    Название задачи
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-primary" />
                    <span className="font-medium">{row.original.task_name}</span>
                </div>
            )
        },
        {
            accessorKey: "status",
            header: "Статус",
            cell: ({ row }) => {
                const status = row.original.status;
                return (
                    <Badge variant={status === "COMPLETED" ? "default" : status === "FAILED" ? "destructive" : "secondary"}>
                        {status}
                    </Badge>
                );
            }
        },
        {
            accessorKey: "id",
            header: "ID",
            cell: ({ row }) => <span className="font-mono text-[10px] text-muted-foreground">{row.original.id.slice(0, 8)}</span>
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
                    Запущено
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(row.original.created_at), "PPp")}
                </div>
            )
        },
        {
            accessorKey: "error_message",
            header: "Ошибка",
            cell: ({ row }) => row.original.error_message ? (
                <div className="flex items-center gap-1 text-xs text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    {row.original.error_message}
                </div>
            ) : "-"
        }
    ], [queryState.sortDir, setQueryState]);

    const table = useDataTable({
        data: (data?.items || []) as BackgroundTaskRead[],
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
                            entityName="Task"
                            queryKey={["tasks"]}
                            onSuccess={() => table.resetRowSelection()}
                            mutationFn={(ids) => FireService.bulkDeleteTasksApiV1FireTasksDelete({ body: { ids } })}
                        />
                    )}
                </div>
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
                                        className="cursor-pointer"
                                        onClick={() => router.push(`/fire/tasks/${row.original.id}`)}
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
                                        Задачи не найдены.
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
