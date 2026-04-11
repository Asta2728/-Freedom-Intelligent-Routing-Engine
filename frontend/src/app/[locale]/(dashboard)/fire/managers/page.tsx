"use client";

import { Header } from "@/components/layout/dashboard/header";
import { Main } from "@/components/layout/dashboard/main";
import { ThemeSwitch } from "@/components/layout/dashboard/theme-switch";
import { NotificationsBell } from "@/components/notifications/notification-bell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { ManagersList } from "../_components/managers-list";
import { ManagerFilters } from "../_components/manager-filters";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function ManagersPage() {
    const [isFilterOpen, setIsFilterOpen] = useState(false);

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
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">Менеджеры</h2>
                        <p className="text-muted-foreground">
                            Список активных менеджеров системы
                        </p>
                    </div>
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
                                    <Users className="h-5 w-5 text-primary" />
                                    Список менеджеров
                                </CardTitle>
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
                        </CardHeader>
                        <CollapsibleContent>
                            <CardContent className="border-t pt-4">
                                <ManagerFilters />
                            </CardContent>
                        </CollapsibleContent>
                        <CardContent className={isFilterOpen ? "pt-0" : ""}>
                            <ManagersList />
                        </CardContent>
                    </Card>
                </Collapsible>
            </Main>
        </>
    );
}
