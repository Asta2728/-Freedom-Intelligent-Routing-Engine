"use client";

import {
    parseAsInteger,
    parseAsString,
    parseAsStringEnum,
    useQueryStates,
} from "nuqs";
import {
    ClientSegment,
    TicketType,
    TicketTone,
    TicketLanguage,
    TaskStatus,
    TaskAction
} from "@/lib/api/client";

// Common pagination and sorting
export const paginationParams = {
    page: parseAsInteger.withDefault(1),
    pageSize: parseAsInteger.withDefault(10),
};

export const sortingParams = {
    sortBy: parseAsString.withDefault("created_at"),
    sortDir: parseAsStringEnum(["asc", "desc"]).withDefault("desc"),
};

export function useTicketsQueryStates() {
    return useQueryStates({
        ...paginationParams,
        ...sortingParams,
        client_segment: parseAsStringEnum<ClientSegment>(["Mass", "VIP", "Priority"]),
        assigned_manager_id: parseAsString,
        client_city: parseAsString,
        ai_type: parseAsStringEnum<TicketType>(["Жалоба", "Смена данных", "Консультация", "Претензия", "Неработоспособность приложения", "Мошеннические действия", "Спам"]),
        ai_tone: parseAsStringEnum<TicketTone>(["Позитивный", "Нейтральный", "Негативный"]),
        ai_language: parseAsStringEnum<TicketLanguage>(["KZ", "ENG", "RU"]),
        ai_priority_min: parseAsInteger,
        ai_priority_max: parseAsInteger,
    }, {
        shallow: false,
        history: "push",
    });
}

export function useManagersQueryStates() {
    return useQueryStates({
        ...paginationParams,
        ...sortingParams,
        role: parseAsString,
        business_unit_id: parseAsString,
        current_load_min: parseAsInteger,
        current_load_max: parseAsInteger,
        skill: parseAsString,
    }, {
        shallow: false,
        history: "push",
    });
}

export function useBusinessUnitsQueryStates() {
    return useQueryStates({
        ...paginationParams,
        ...sortingParams,
        city: parseAsString,
        country: parseAsString,
    }, {
        shallow: false,
        history: "push",
    });
}

export function useTasksQueryStates() {
    return useQueryStates({
        ...paginationParams,
        ...sortingParams,
        status: parseAsStringEnum<TaskStatus>(["PENDING", "RUNNING", "COMPLETED", "FAILED"]),
        task_name: parseAsString,
        ticket_id: parseAsString,
    }, {
        shallow: false,
        history: "push",
    });
}

export function useTaskLogsQueryStates() {
    return useQueryStates({
        ...paginationParams,
        action: parseAsStringEnum<TaskAction>(["START", "INFO", "WARN", "SUCCESS", "ERROR", "AI_ENRICHED", "GEOCODED", "ROUTED"]),
    }, {
        shallow: false,
        history: "push",
    });
}
