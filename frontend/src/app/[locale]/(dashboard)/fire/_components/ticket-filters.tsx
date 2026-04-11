"use client";

import { useTicketsQueryStates } from "../_hooks/use-fire-query-states";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FilterX, Search } from "lucide-react";
import { ClientSegment, TicketType, TicketTone, TicketLanguage } from "@/lib/api/client";
import ComboBox2 from "@/components/ui/combobox2";
import { FireService } from "@/lib/api/client";

export function TicketFilters() {
    const [queryState, setQueryState] = useTicketsQueryStates();

    const resetFilters = () => {
        setQueryState({
            client_segment: null,
            assigned_manager_id: null,
            client_city: null,
            ai_type: null,
            ai_tone: null,
            ai_language: null,
            ai_priority_min: null,
            ai_priority_max: null,
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
                <Label>Сегмент</Label>
                <Select
                    value={queryState.client_segment || "ALL"}
                    onValueChange={(v) => setQueryState({ client_segment: v === "ALL" ? null : v as ClientSegment, page: 1 })}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Все сегменты" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Все сегменты</SelectItem>
                        <SelectItem value="Mass">Mass</SelectItem>
                        <SelectItem value="VIP">VIP</SelectItem>
                        <SelectItem value="Priority">Priority</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Тип</Label>
                <Select
                    value={queryState.ai_type || "ALL"}
                    onValueChange={(v) => setQueryState({ ai_type: v === "ALL" ? null : v as TicketType, page: 1 })}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Все типы</SelectItem>
                        <SelectItem value="Жалоба">Жалоба</SelectItem>
                        <SelectItem value="Смена данных">Смена данных</SelectItem>
                        <SelectItem value="Консультация">Консультация</SelectItem>
                        <SelectItem value="Претензия">Претензия</SelectItem>
                        <SelectItem value="Неработоспособность приложения">Неработоспособность приложения</SelectItem>
                        <SelectItem value="Мошеннические действия">Мошеннические действия</SelectItem>
                        <SelectItem value="Спам">Спам</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Тональность</Label>
                <Select
                    value={queryState.ai_tone || "ALL"}
                    onValueChange={(v) => setQueryState({ ai_tone: v === "ALL" ? null : v as TicketTone, page: 1 })}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Все тональности" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Все тональности</SelectItem>
                        <SelectItem value="Позитивный">Позитивный</SelectItem>
                        <SelectItem value="Нейтральный">Нейтральный</SelectItem>
                        <SelectItem value="Негативный">Негативный</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Язык</Label>
                <Select
                    value={queryState.ai_language || "ALL"}
                    onValueChange={(v) => setQueryState({ ai_language: v === "ALL" ? null : v as TicketLanguage, page: 1 })}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Все языки" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Все языки</SelectItem>
                        <SelectItem value="KZ">Казахский (KZ)</SelectItem>
                        <SelectItem value="RU">Русский (RU)</SelectItem>
                        <SelectItem value="ENG">Английский (ENG)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Город</Label>
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Поиск по городу..."
                        className="pl-9"
                        value={queryState.client_city || ""}
                        onChange={(e) => setQueryState({ client_city: e.target.value || null, page: 1 })}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Ответственный менеджер</Label>
                <ComboBox2
                    title="Выбрать менеджера"
                    value={queryState.assigned_manager_id ? { id: queryState.assigned_manager_id, full_name: "Selected Manager" } : undefined}
                    valueKey="id"
                    multiple={false}
                    renderText={(m) => m.full_name}
                    onChange={(val) => setQueryState({ assigned_manager_id: val?.id || null, page: 1 })}
                    searchFn={async (query) => {
                        const res = await FireService.listManagersApiV1FireManagersGet({
                            query: { skill: query ? query : undefined } // Can be upgraded to better search
                        });
                        return res.data?.items || [];
                    }}
                />
            </div>

            <div className="space-y-2">
                <Label>Мин. приоритет ({queryState.ai_priority_min || 0})</Label>
                <Input
                    type="number"
                    min={0}
                    max={10}
                    value={queryState.ai_priority_min || ""}
                    onChange={(e) => setQueryState({ ai_priority_min: e.target.value ? parseInt(e.target.value) : null, page: 1 })}
                />
            </div>

            <div className="space-y-2">
                <Label>Макс. приоритет ({queryState.ai_priority_max || 10})</Label>
                <Input
                    type="number"
                    min={0}
                    max={10}
                    value={queryState.ai_priority_max || ""}
                    onChange={(e) => setQueryState({ ai_priority_max: e.target.value ? parseInt(e.target.value) : null, page: 1 })}
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
