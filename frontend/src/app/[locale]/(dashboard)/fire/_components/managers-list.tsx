"use client";

import { useDataTable } from "@/hooks/use-datatable";
import { FireService, type ManagerRead } from "@/lib/api/client";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { flexRender } from "@tanstack/react-table";
import { useMemo } from "react";
import { Loader2, User, Building2, ArrowUpDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useManagersQueryStates } from "../_hooks/use-fire-query-states";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkDeleteAction } from "./bulk-delete-action";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

export function ManagersList() {
    const [queryState, setQueryState] = useManagersQueryStates();

    const { data, isLoading } = useQuery({
        queryKey: ["managers", queryState],
        queryFn: async () => {
            const response = await FireService.listManagersApiV1FireManagersGet({
                query: {
                    page: queryState.page,
                    page_size: queryState.pageSize,
                    sort_by: queryState.sortBy,
                    sort_dir: queryState.sortDir,
                    role: queryState.role,
                    business_unit_id: queryState.business_unit_id,
                    current_load_min: queryState.current_load_min,
                    current_load_max: queryState.current_load_max,
                    skill: queryState.skill,
                }
            });
            return response.data;
        },
        staleTime: 0,
    });

    const columns = useMemo<ColumnDef<ManagerRead>[]>(() => [
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
            accessorKey: "full_name",
            header: () => (
                <Button
                    variant="ghost"
                    onClick={() => setQueryState({
                        sortBy: "full_name",
                        sortDir: queryState.sortDir === "asc" ? "desc" : "asc"
                    })}
                >
                    ФИО
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-medium">{row.original.full_name}</span>
                </div>
            )
        },
        {
            accessorKey: "role",
            header: "Должность",
            cell: ({ row }) => <Badge variant="secondary">{row.original.role}</Badge>
        },
        {
            id: "load",
            header: () => (
                <Button
                    variant="ghost"
                    onClick={() => setQueryState({
                        sortBy: "current_load",
                        sortDir: queryState.sortDir === "asc" ? "desc" : "asc"
                    })}
                >
                    Текущая нагрузка
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            accessorFn: (row) => row.current_load,
            cell: ({ row }) => {
                const load = row.original.current_load;
                return (
                    <div className="w-[120px] space-y-1">
                        <Progress value={load} className="h-2" />
                        <span className="text-[10px] text-muted-foreground">{load}%</span>
                    </div>
                );
            }
        },
        {
            id: "business_unit",
            header: "Офис",
            accessorFn: (row) => row.business_unit?.name,
            cell: ({ row }) => {
                const bu = row.original.business_unit;
                if (!bu) return <span className="text-muted-foreground text-sm">Не назначен</span>;
                return (
                    <HoverCard>
                        <HoverCardTrigger asChild>
                            <Button variant="outline" className="h-8 px-2 text-xs font-normal">
                                <Building2 className="mr-1 h-3 w-3 text-muted-foreground" />
                                {bu.name}
                            </Button>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80">
                            <div className="flex justify-between space-x-4">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-semibold">{bu.name}</h4>
                                    <p className="text-sm text-muted-foreground">Город: {bu.city}</p>
                                    <div className="flex items-center pt-2">
                                        <span className="text-xs text-muted-foreground">
                                            Адрес: {bu.address}
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
            accessorKey: "skills",
            header: "Навыки",
            cell: ({ row }) => (
                <div className="flex flex-wrap gap-1">
                    {row.original.skills.map((skill) => (
                        <Badge key={skill} variant="outline" className="text-[10px]">
                            {skill}
                        </Badge>
                    ))}
                </div>
            )
        }
    ], [queryState.sortDir, setQueryState]);

    const table = useDataTable({
        data: (data?.items || []) as ManagerRead[],
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
                            entityName="Manager"
                            queryKey={["managers"]}
                            onSuccess={() => table.resetRowSelection()}
                            mutationFn={(ids) => FireService.bulkDeleteManagersApiV1FireManagersDelete({ body: { ids } })}
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
