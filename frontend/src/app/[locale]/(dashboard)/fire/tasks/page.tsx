"use client";

import { Header } from "@/components/layout/dashboard/header";
import { Main } from "@/components/layout/dashboard/main";
import { ThemeSwitch } from "@/components/layout/dashboard/theme-switch";
import { NotificationsBell } from "@/components/notifications/notification-bell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckSquare, Plus, ChevronDown, ChevronUp, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { IngestDialog } from "../_components/ingest-dialog";
import { TasksList } from "../_components/tasks-list";
import { TaskFilters } from "../_components/task-filters";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQueryClient } from "@tanstack/react-query";

export default function TasksPage() {
    const [isIngestOpen, setIsIngestOpen] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const queryClient = useQueryClient();

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await queryClient.invalidateQueries({ queryKey: ["tasks"] });
        // Small delay to make animation visible if it's too fast
        setTimeout(() => setIsRefreshing(false), 500);
    };

    return (
        <>
            <Header fixed>
                <div className="flex-1" />
                <div className="flex items-center space-x-4">
                    <NotificationsBell />
                    <ThemeSwitch />
                </div>
            </Header>

            <Main className="flex flex-1 flex-col gap-4 sm:gap-6">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">Фоновые задачи</h2>
                        <p className="text-muted-foreground">
                            Мониторинг фоновых процессов и задач загрузки
                        </p>
                    </div>
                    <Button onClick={() => setIsIngestOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Начать загрузку
                    </Button>
                </div>

                <Collapsible
                    open={isFilterOpen}
                    onOpenChange={setIsFilterOpen}
                    className="space-y-2"
                >
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                                    <CheckSquare className="h-5 w-5 text-primary" />
                                    Монитор задач
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleRefresh}
                                        disabled={isRefreshing}
                                    >
                                        <RefreshCcw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                                        Обновить
                                    </Button>
                                    <CollapsibleTrigger asChild>
                                        <Button variant="outline" size="sm">
                                            {isFilterOpen ? (
                                                <>
                                                    <ChevronUp className="mr-2 h-4 w-4" />
                                                    Скрыть фильтры
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronDown className="mr-2 h-4 w-4" />
                                                    Показать фильтры
                                                </>
                                            )}
                                        </Button>
                                    </CollapsibleTrigger>
                                </div>
                            </div>
                        </CardHeader>
                        <CollapsibleContent>
                            <CardContent className="border-t pt-4">
                                <TaskFilters />
                            </CardContent>
                        </CollapsibleContent>
                        <CardContent className={isFilterOpen ? "pt-0" : ""}>
                            <TasksList />
                        </CardContent>
                    </Card>
                </Collapsible>

                <IngestDialog open={isIngestOpen} onOpenChange={setIsIngestOpen} />
            </Main>
        </>
    );
}
