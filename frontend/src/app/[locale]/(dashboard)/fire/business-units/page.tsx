"use client";

import { Header } from "@/components/layout/dashboard/header";
import { Main } from "@/components/layout/dashboard/main";
import { ThemeSwitch } from "@/components/layout/dashboard/theme-switch";
import { NotificationsBell } from "@/components/notifications/notification-bell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { BusinessUnitsList } from "../_components/business-units-list";
import { BusinessUnitFilters } from "../_components/business-unit-filters";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function BusinessUnitsPage() {
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
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">Бизнес-подразделения</h2>
                        <p className="text-muted-foreground">
                            Управление офисами и филиалами
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
                                    <Building2 className="h-5 w-5 text-primary" />
                                    Каталог офисов
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
                                <BusinessUnitFilters />
                            </CardContent>
                        </CollapsibleContent>
                        <CardContent className={isFilterOpen ? "pt-0" : ""}>
                            <BusinessUnitsList />
                        </CardContent>
                    </Card>
                </Collapsible>
            </Main>
        </>
    );
}
