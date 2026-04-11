import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/dashboard/header";
import { Main } from "@/components/layout/dashboard/main";
import { ThemeSwitch } from "@/components/layout/dashboard/theme-switch";
import { NotificationsBell } from "@/components/notifications/notification-bell";
import { AiAnalyticsList } from "../_components/ai-analytics-list";
import { TicketFilters } from "../_components/ticket-filters";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrainCircuit, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export async function generateMetadata() {
    return {
        title: "AI Analytics Output | Datasaur FIRE",
        description: "Review automated AI categorization, priority, and routing results",
    };
}

export default async function AiAnalyticsPage() {
    await getTranslations("Dashboard");

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
                <div className="flex items-center gap-2">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <BrainCircuit className="h-6 w-6 text-primary" />
                            AI-аналитика
                        </h2>
                        <p className="text-muted-foreground">
                            Просмотр AI-классификации, анализа тона и правил маршрутизации.
                        </p>
                    </div>
                </div>

                {/* We re-use the exact same TicketFilters component since the endpoints take the exact same filtering parameters */}
                <div className="space-y-4">
                    <Collapsible className="space-y-2">
                        <Card>
                            <CardHeader className="pb-3 border-b border-primary/10">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-xl font-semibold">
                                            Лента аналитики
                                        </CardTitle>
                                    </div>
                                    <CollapsibleTrigger asChild>
                                        <Button variant="outline" size="sm">
                                            <ChevronDown className="mr-2 h-4 w-4" />
                                            Фильтры
                                        </Button>
                                    </CollapsibleTrigger>
                                </div>
                            </CardHeader>
                            <CollapsibleContent>
                                <CardContent className="pt-4 pb-4 border-b border-primary/10 border-dashed">
                                    <TicketFilters />
                                </CardContent>
                            </CollapsibleContent>
                            <CardContent className="pt-0 p-0">
                                <AiAnalyticsList />
                            </CardContent>
                        </Card>
                    </Collapsible>
                </div>
            </Main>
        </>
    );
}
