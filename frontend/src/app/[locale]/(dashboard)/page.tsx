"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FireService } from "@/lib/api/client";
import { Header } from "@/components/layout/dashboard/header";
import { Main } from "@/components/layout/dashboard/main";
import { ThemeSwitch } from "@/components/layout/dashboard/theme-switch";
import { NotificationsBell } from "@/components/notifications/notification-bell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, Users, Ticket, CheckSquare, BrainCircuit } from "lucide-react";

type DashboardStats = {
  tickets: number;
  managers: number;
  businessUnits: number;
  activeTasks: number;
};

const recommendedAnalytics = [
  "Ticket type distribution by city",
  "Sentiment split by business unit",
  "Language mix (RU/ENG/KZ)",
  "Routing failures and root causes",
  "Top overloaded managers",
  "VIP/Priority handling compliance",
];

export default function DashboardPage() {
  const statsQuery = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async (): Promise<DashboardStats> => {
      const [ticketsRes, managersRes, businessUnitsRes, pendingRes, runningRes] = await Promise.all([
        FireService.listTicketsApiV1FireTicketsGet({ query: { page: 1, page_size: 1 } }),
        FireService.listManagersApiV1FireManagersGet({ query: { page: 1, page_size: 1 } }),
        FireService.listBusinessUnitsApiV1FireBusinessUnitsGet({ query: { page: 1, page_size: 1 } }),
        FireService.listTasksApiV1FireTasksGet({ query: { page: 1, page_size: 1, status: "PENDING" } }),
        FireService.listTasksApiV1FireTasksGet({ query: { page: 1, page_size: 1, status: "RUNNING" } }),
      ]);

      return {
        tickets: ticketsRes.data.total,
        managers: managersRes.data.total,
        businessUnits: businessUnitsRes.data.total,
        activeTasks: pendingRes.data.total + runningRes.data.total,
      };
    },
    staleTime: 10_000,
  });

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
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h2>
          <p className="text-muted-foreground">Main actions and system snapshot loaded from backend.</p>
        </div>

        {statsQuery.isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Tickets</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-2xl font-bold">{statsQuery.data?.tickets ?? 0}</span>
                <Ticket className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Managers</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-2xl font-bold">{statsQuery.data?.managers ?? 0}</span>
                <Users className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Business Units</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-2xl font-bold">{statsQuery.data?.businessUnits ?? 0}</span>
                <Building2 className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Active Tasks</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-2xl font-bold">{statsQuery.data?.activeTasks ?? 0}</span>
                <CheckSquare className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Main Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild><Link href="/fire/tasks">Open Tasks</Link></Button>
              <Button asChild variant="outline"><Link href="/fire/tickets">Open Tickets</Link></Button>
              <Button asChild variant="outline"><Link href="/fire/ai-analytics">AI Analytics</Link></Button>
              <Button asChild variant="outline"><Link href="/fire/managers">Managers</Link></Button>
              <Button asChild variant="outline"><Link href="/fire/business-units">Business Units</Link></Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-primary" />
                Suggested Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {recommendedAnalytics.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  );
}
