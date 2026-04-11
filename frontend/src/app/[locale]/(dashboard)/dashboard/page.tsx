"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FireService } from "@/lib/api/client";
import { client } from "@/lib/api/client/client.gen";
import { Header } from "@/components/layout/dashboard/header";
import { Main } from "@/components/layout/dashboard/main";
import { ThemeSwitch } from "@/components/layout/dashboard/theme-switch";
import { NotificationsBell } from "@/components/notifications/notification-bell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Building2,
  Users,
  Ticket,
  CheckSquare,
  MapPin,
  BarChart2,
  Globe2,
  Network,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { KazakhstanMap } from "@/components/charts/kazakhstan-map";

// ─── Analytics types ──────────────────────────────────────────────────────────
type PriorityBucket = { priority: number; count: number };
type LanguageSlice = { language: string; count: number };
type RoutingMethodSlice = { method: string; count: number };
type TicketGeoPoint = {
  ticket_id: string;
  latitude: number;
  longitude: number;
  ai_priority?: number | null;
  client_city?: string | null;
  client_segment?: string | null;
};
type DashboardAnalyticsResponse = {
  geo_points: TicketGeoPoint[];
  priority_distribution: PriorityBucket[];
  language_distribution: LanguageSlice[];
  routing_method_distribution: RoutingMethodSlice[];
  total_tickets: number;
  total_managers: number;
  total_business_units: number;
  routed_count: number;
  unrouted_count: number;
};

// ─── Color helpers ────────────────────────────────────────────────────────────
function priorityBarColor(priority: number): string {
  if (priority <= 3) return "#22c55e";
  if (priority <= 6) return "#eab308";
  if (priority <= 8) return "#f97316";
  return "#ef4444";
}

const LANG_COLORS: Record<string, string> = {
  RU: "#3b82f6",
  KZ: "#06b6d4",
  ENG: "#8b5cf6",
};

const METHOD_COLORS: Record<string, string> = {
  geo_nearest: "#22c55e",
  geo_fallback_astana: "#3b82f6",
  geo_fallback_almaty: "#06b6d4",
  round_robin: "#8b5cf6",
  no_eligible_manager: "#f97316",
  skipped_spam: "#6b7280",
};

const METHOD_LABELS: Record<string, string> = {
  geo_nearest: "Гео (ближайший)",
  geo_fallback_astana: "Астана (fallback)",
  geo_fallback_almaty: "Алматы (fallback)",
  round_robin: "Round-robin",
  no_eligible_manager: "Нет менеджера",
  skipped_spam: "Спам",
};

function sliceColor(map: Record<string, string>, key: string, idx: number): string {
  const fallbacks = ["#64748b", "#94a3b8", "#cbd5e1", "#e2e8f0"];
  return map[key] ?? fallbacks[idx % fallbacks.length];
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const analyticsQuery = useQuery({
    queryKey: ["dashboard-analytics"],
    queryFn: async (): Promise<DashboardAnalyticsResponse> => {
      const res = await client.get({ url: "/api/v1/fire/analytics" });
      const data: unknown = res.data;
      return data as DashboardAnalyticsResponse;
    },
    staleTime: 30_000,
  });

  const activeTasksQuery = useQuery({
    queryKey: ["dashboard-active-tasks"],
    queryFn: async () => {
      const [pendingRes, runningRes] = await Promise.all([
        FireService.listTasksApiV1FireTasksGet({ query: { page: 1, page_size: 1, status: "PENDING" } }),
        FireService.listTasksApiV1FireTasksGet({ query: { page: 1, page_size: 1, status: "RUNNING" } }),
      ]);
      return pendingRes.data.total + runningRes.data.total;
    },
    staleTime: 15_000,
  });

  const analytics = analyticsQuery.data;
  const isLoading = analyticsQuery.isLoading;

  const priorityData = useMemo(
    () => analytics?.priority_distribution ?? [],
    [analytics?.priority_distribution]
  );

  const languageData = useMemo(
    () =>
      (analytics?.language_distribution ?? []).map((d) => ({
        ...d,
        name: d.language,
      })),
    [analytics?.language_distribution]
  );

  const routingData = useMemo(
    () =>
      (analytics?.routing_method_distribution ?? []).map((d) => ({
        ...d,
        name: METHOD_LABELS[d.method] ?? d.method,
      })),
    [analytics?.routing_method_distribution]
  );

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
        {/* ── Page title ── */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Главная</h2>
          <p className="text-muted-foreground">Обзор системы и аналитика обращений.</p>
        </div>

        {/* ── Stats row ── */}
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Обращения</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-2xl font-bold">{analytics?.total_tickets ?? 0}</span>
                <Ticket className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Менеджеры</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-2xl font-bold">{analytics?.total_managers ?? 0}</span>
                <Users className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Бизнес-подразделения</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-2xl font-bold">{analytics?.total_business_units ?? 0}</span>
                <Building2 className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Активные задачи</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-2xl font-bold">{activeTasksQuery.data ?? 0}</span>
                <CheckSquare className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Action buttons ── */}
        <Card>
          <CardHeader>
            <CardTitle>Основные действия</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/fire/tasks">Задачи</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/fire/tickets">Обращения</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/fire/ai-analytics">AI-аналитика</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/fire/managers">Менеджеры</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/fire/business-units">Бизнес-подразделения</Link>
            </Button>
          </CardContent>
        </Card>

        {/* ── Kazakhstan map — full width ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              География обращений — Казахстан
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80 p-3">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <KazakhstanMap points={analytics?.geo_points ?? []} className="h-full" />
            )}
          </CardContent>
        </Card>

        {/* ── Charts row: Priority histogram + Language pie + Routing donut ── */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Priority distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <BarChart2 className="h-4 w-4 text-primary" />
                Распределение приоритетов
              </CardTitle>
            </CardHeader>
            <CardContent className="h-60">
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : priorityData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center pt-10">Нет данных</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                    <XAxis dataKey="priority" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value) => [Number(value ?? 0), "Количество"]}
                      labelFormatter={(v) => `Приоритет ${v}`}
                    />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                      {priorityData.map((entry) => (
                        <Cell key={entry.priority} fill={priorityBarColor(entry.priority)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Language distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Globe2 className="h-4 w-4 text-primary" />
                Язык обращений
              </CardTitle>
            </CardHeader>
            <CardContent className="h-60">
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : languageData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center pt-10">Нет данных</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={languageData}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                    >
                      {languageData.map((entry, idx) => (
                        <Cell key={entry.language} fill={sliceColor(LANG_COLORS, entry.language, idx)} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [Number(value ?? 0), String(name)]} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Routing method distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Network className="h-4 w-4 text-primary" />
                Методы маршрутизации
              </CardTitle>
            </CardHeader>
            <CardContent className="h-60">
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : routingData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center pt-10">Нет данных</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={routingData}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                    >
                      {routingData.map((entry, idx) => (
                        <Cell
                          key={entry.method}
                          fill={sliceColor(
                            METHOD_COLORS,
                            analytics?.routing_method_distribution[idx]?.method ?? "",
                            idx
                          )}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [Number(value ?? 0), String(name)]} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Routing summary strip ── */}
        {analytics && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Маршрутизовано</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-2xl font-bold text-green-500">{analytics.routed_count}</span>
                <div className="text-xs text-muted-foreground text-right">
                  {analytics.total_tickets > 0
                    ? `${Math.round((analytics.routed_count / analytics.total_tickets) * 100)}% от всех`
                    : "—"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Не маршрутизовано</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-2xl font-bold text-orange-500">{analytics.unrouted_count}</span>
                <div className="text-xs text-muted-foreground text-right">
                  {analytics.total_tickets > 0
                    ? `${Math.round((analytics.unrouted_count / analytics.total_tickets) * 100)}% от всех`
                    : "—"}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </Main>
    </>
  );
}
