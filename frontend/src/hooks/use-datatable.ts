"use client";

import {
    type ColumnDef,
    type ColumnFiltersState,
    getCoreRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    type SortingState,
    useReactTable,
    type VisibilityState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";

type UseDataTableProps<TData, TValue> = {
    data: TData[];
    columns: ColumnDef<TData, TValue>[];
    enableRowSelection?: boolean;
    getRowId?: (row: TData, index: number) => string;
    // Manual state props
    manualPagination?: boolean;
    pageCount?: number;
    paginationState?: {
        pageIndex: number;
        pageSize: number;
    };
    onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void;
    manualSorting?: boolean;
    sortingState?: SortingState;
    onSortingChange?: (sorting: SortingState) => void;
};

export function useDataTable<TData, TValue>({
    data,
    columns,
    enableRowSelection = true,
    getRowId,
    manualPagination,
    pageCount,
    paginationState,
    onPaginationChange,
    manualSorting,
    sortingState,
    onSortingChange,
}: UseDataTableProps<TData, TValue>) {
    const [rowSelection, setRowSelection] = useState({});
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

    // Internal states if not controlled
    const [_internalSorting, _setInternalSorting] = useState<SortingState>([]);
    const [_internalPagination, _setInternalPagination] = useState({
        pageIndex: 0,
        pageSize: 10,
    });

    const usedSorting = sortingState ?? _internalSorting;
    const usedPagination = paginationState ?? _internalPagination;

    const usedGetRowId = useMemo(() => {
        if (getRowId) {
            return getRowId;
        } else {
            return (row: TData, index: number) => {
                if (!row) return undefined;
                if ((row as any).id) return (row as any).id.toString();
                if ((row as any)._id) return (row as any)._id.toString();
                return index.toString();
            };
        }
    }, [getRowId]);

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting: usedSorting,
            columnVisibility,
            rowSelection,
            columnFilters,
            pagination: usedPagination,
        },
        enableRowSelection,
        getRowId: usedGetRowId,
        manualPagination,
        pageCount: pageCount ?? -1,
        manualSorting,
        onRowSelectionChange: setRowSelection,
        onSortingChange: (updater) => {
            if (onSortingChange) {
                const updated = typeof updater === "function" ? updater(usedSorting) : updater;
                onSortingChange(updated);
            } else {
                _setInternalSorting(updater);
            }
        },
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onPaginationChange: (updater) => {
            if (onPaginationChange) {
                const updated = typeof updater === "function" ? updater(usedPagination) : updater;
                onPaginationChange(updated);
            } else {
                _setInternalPagination(updater);
            }
        },
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
    });

    return table;
}
