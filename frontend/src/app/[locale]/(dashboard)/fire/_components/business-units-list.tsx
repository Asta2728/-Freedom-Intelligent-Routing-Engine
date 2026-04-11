"use client";

import { useDataTable } from "@/hooks/use-datatable";
import { FireService, type BusinessUnitRead } from "@/lib/api/client";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { flexRender } from "@tanstack/react-table";
import { useMemo } from "react";
import { Building2, Loader2, MapPin, ArrowUpDown } from "lucide-react";
import { useBusinessUnitsQueryStates } from "../_hooks/use-fire-query-states";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkDeleteAction } from "./bulk-delete-action";

export function BusinessUnitsList() {
    const [queryState, setQueryState] = useBusinessUnitsQueryStates();

    const { data, isLoading } = useQuery({
        queryKey: ["business-units", queryState],
        queryFn: async () => {
            const response = await FireService.listBusinessUnitsApiV1FireBusinessUnitsGet({
                query: {
                    page: queryState.page,
                    page_size: queryState.pageSize,
                    sort_by: queryState.sortBy,
                    sort_dir: queryState.sortDir,
                    city: queryState.city,
                    country: queryState.country,
                }
            });
            return response.data;
        },
        staleTime: 0,
    });

    const columns = useMemo<ColumnDef<BusinessUnitRead>[]>(() => [
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
            accessorKey: "name",
            header: () => (
                <Button
                    variant="ghost"
                    onClick={() => setQueryState({
                        sortBy: "name",
                        sortDir: queryState.sortDir === "asc" ? "desc" : "asc"
                    })}
                >
                    Название офиса
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="font-medium">{row.original.name}</span>
                </div>
            )
        },
        {
            accessorKey: "city",
            header: "Город",
        },
        {
            accessorKey: "country",
            header: "Страна",
        },
        {
            accessorKey: "address",
            header: "Адрес",
            cell: ({ row }) => (
                <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="text-xs">{row.original.address}</span>
                </div>
            )
        },
        {
            id: "coordinates",
            header: "Координаты",
            cell: ({ row }) => {
                const latitude = row.original.latitude;
                const longitude = row.original.longitude;

                if (latitude == null || longitude == null) {
                    return <span className="text-xs text-muted-foreground">—</span>;
                }

                return (
                    <span className="font-mono text-[10px] text-muted-foreground">
                        {latitude.toFixed(4)}, {longitude.toFixed(4)}
                    </span>
                );
            }
        }
    ], [queryState.sortDir, setQueryState]);

    const table = useDataTable({
        data: (data?.items || []) as BusinessUnitRead[],
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
                            entityName="Business Unit"
                            queryKey={["business-units"]}
                            onSuccess={() => table.resetRowSelection()}
                            mutationFn={(ids) => FireService.bulkDeleteBusinessUnitsApiV1FireBusinessUnitsDelete({ body: { ids } })}
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
