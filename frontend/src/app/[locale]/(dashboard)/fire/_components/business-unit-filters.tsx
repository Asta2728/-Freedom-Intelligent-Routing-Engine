"use client";

import { useBusinessUnitsQueryStates } from "../_hooks/use-fire-query-states";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterX, Search } from "lucide-react";

export function BusinessUnitFilters() {
    const [queryState, setQueryState] = useBusinessUnitsQueryStates();

    const resetFilters = () => {
        setQueryState({
            city: null,
            country: null,
            page: 1,
        });
    };

    const hasFilters = Object.entries(queryState).some(([key, value]) => {
        if (["page", "pageSize", "sortBy", "sortDir"].includes(key)) return false;
        return value !== null && value !== "";
    });

    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
                <Label>Город</Label>
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Поиск по городу..."
                        className="pl-9"
                        value={queryState.city || ""}
                        onChange={(e) => setQueryState({ city: e.target.value || null, page: 1 })}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Страна</Label>
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Поиск по стране..."
                        className="pl-9"
                        value={queryState.country || ""}
                        onChange={(e) => setQueryState({ country: e.target.value || null, page: 1 })}
                    />
                </div>
            </div>

            <div className="flex items-end space-x-2">
                {hasFilters && (
                    <Button variant="ghost" onClick={resetFilters} className="w-full">
                        <FilterX className="mr-2 h-4 w-4" />
                        Сбросить
                    </Button>
                )}
            </div>
        </div>
    );
}
