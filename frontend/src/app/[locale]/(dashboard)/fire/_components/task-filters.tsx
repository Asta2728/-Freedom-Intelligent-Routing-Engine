"use client";

import { useTasksQueryStates } from "../_hooks/use-fire-query-states";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FilterX, Search } from "lucide-react";
import { TaskStatus } from "@/lib/api/client";

export function TaskFilters() {
    const [queryState, setQueryState] = useTasksQueryStates();

    const resetFilters = () => {
        setQueryState({
            status: null,
            task_name: null,
            ticket_id: null,
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
                <Label>Статус</Label>
                <Select
                    value={queryState.status || "ALL"}
                    onValueChange={(v) => setQueryState({ status: v === "ALL" ? null : v as TaskStatus, page: 1 })}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Все статусы" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Все статусы</SelectItem>
                        <SelectItem value="PENDING">Ожидание</SelectItem>
                        <SelectItem value="RUNNING">Выполняется</SelectItem>
                        <SelectItem value="COMPLETED">Завершено</SelectItem>
                        <SelectItem value="FAILED">Ошибка</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Название задачи</Label>
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Поиск задачи..."
                        className="pl-9"
                        value={queryState.task_name || ""}
                        onChange={(e) => setQueryState({ task_name: e.target.value || null, page: 1 })}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label>ID обращения</Label>
                <Input
                    placeholder="Ticket ID..."
                    value={queryState.ticket_id || ""}
                    onChange={(e) => setQueryState({ ticket_id: e.target.value || null, page: 1 })}
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
