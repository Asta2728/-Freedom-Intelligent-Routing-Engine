"use client";

import { useManagersQueryStates } from "../_hooks/use-fire-query-states";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FilterX, Search } from "lucide-react";
import ComboBox2 from "@/components/ui/combobox2";
import { FireService } from "@/lib/api/client";
import { useQuery } from "@tanstack/react-query";

export function ManagerFilters() {
    const [queryState, setQueryState] = useManagersQueryStates();

    const rolesQuery = useQuery({
        queryKey: ["manager-roles"],
        queryFn: async () => {
            const response = await FireService.listManagersApiV1FireManagersGet({
                query: { page: 1, page_size: 1000 },
            });
            const roles = Array.from(
                new Set(
                    (response.data?.items ?? [])
                        .map((manager) => manager.role)
                        .filter((role): role is string => Boolean(role))
                )
            );
            return roles.sort((first, second) => first.localeCompare(second));
        },
    });

    const resetFilters = () => {
        setQueryState({
            role: null,
            business_unit_id: null,
            current_load_min: null,
            current_load_max: null,
            skill: null,
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
                <Label>Роль</Label>
                <Select
                    value={queryState.role || "ALL"}
                    onValueChange={(v) => setQueryState({ role: v === "ALL" ? null : v, page: 1 })}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Все роли" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Все роли</SelectItem>
                        {(rolesQuery.data ?? []).map((role) => (
                            <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Бизнес-подразделение</Label>
                <ComboBox2
                    title="Выбрать офис..."
                    value={queryState.business_unit_id ? { id: queryState.business_unit_id, name: "Selected Office" } : undefined}
                    valueKey="id"
                    multiple={false}
                    renderText={(bu) => bu.name}
                    onChange={(val) => setQueryState({ business_unit_id: val?.id || null, page: 1 })}
                    searchFn={async (query) => {
                        const res = await FireService.listBusinessUnitsApiV1FireBusinessUnitsGet({
                            query: { city: query ? query : undefined } // Can be upgraded to full name search later
                        });
                        return res.data?.items || [];
                    }}
                />
            </div>

            <div className="space-y-2">
                <Label>Навык</Label>
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Поиск навыка..."
                        className="pl-9"
                        value={queryState.skill || ""}
                        onChange={(e) => setQueryState({ skill: e.target.value || null, page: 1 })}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Мин. нагрузка ({queryState.current_load_min || 0})</Label>
                <Input
                    type="number"
                    min={0}
                    max={100}
                    value={queryState.current_load_min || ""}
                    onChange={(e) => setQueryState({ current_load_min: e.target.value ? parseInt(e.target.value) : null, page: 1 })}
                />
            </div>

            <div className="space-y-2">
                <Label>Макс. нагрузка ({queryState.current_load_max || 100})</Label>
                <Input
                    type="number"
                    min={0}
                    max={100}
                    value={queryState.current_load_max || ""}
                    onChange={(e) => setQueryState({ current_load_max: e.target.value ? parseInt(e.target.value) : null, page: 1 })}
                />
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
