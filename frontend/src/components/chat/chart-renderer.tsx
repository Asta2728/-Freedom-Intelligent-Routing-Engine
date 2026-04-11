"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import {
    BarChart,
    Bar,
    PieChart,
    Pie,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    ResponsiveContainer,
    Cell
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export interface ChartDataPayload {
    type: "bar" | "pie" | "line";
    title: string;
    description?: string;
    data: Array<Record<string, string | number | null>>;
}

const COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
];

export function ChartRenderer({ rawJson }: { rawJson: string }) {
    const payload = useMemo(() => {
        try {
            const parsed = JSON.parse(rawJson.trim()) as ChartDataPayload;
            if (!parsed.data || !Array.isArray(parsed.data)) {
                return null;
            }
            return parsed;
        } catch (e) {
            console.error("Failed to parse chart JSON:", e);
            return null;
        }
    }, [rawJson]);

    if (!payload) return null;

    const renderChart = () => {
        const { type, data } = payload;
        const xKey = Object.keys(data[0] || {}).find(k => k.toLowerCase().includes('name') || k === Object.keys(data[0])[0]) || "name";
        const valKeys = Object.keys(data[0] || {}).filter(k => k !== xKey);

        switch (type) {
            case "bar":
                return (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                            <XAxis dataKey={xKey} fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis fontSize={12} tickLine={false} axisLine={false} />
                            <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            {valKeys.length > 1 && <Legend />}
                            {valKeys.map((k, i) => (
                                <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={650} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                );
            case "pie":
                const valKey = valKeys[0] || "value";
                return (
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Legend />
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey={valKey}
                                nameKey={xKey}
                                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                isAnimationActive
                                animationDuration={700}
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                );
            case "line":
                return (
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                            <XAxis dataKey={xKey} fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis fontSize={12} tickLine={false} axisLine={false} />
                            <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            {valKeys.length > 1 && <Legend />}
                            {valKeys.map((k, i) => (
                                <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} isAnimationActive animationDuration={700} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                );
            default:
                return <div className="p-4 text-sm text-muted-foreground flex items-center justify-center">Unsupported chart type: {type}</div>;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
        >
        <Card className="my-4 overflow-hidden border-primary/20 bg-background/50 backdrop-blur shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-base text-foreground font-semibold flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    {payload.title}
                </CardTitle>
                {payload.description && <CardDescription className="text-xs">{payload.description}</CardDescription>}
            </CardHeader>
            <CardContent className="pt-4 pb-2 px-2">
                {renderChart()}
            </CardContent>
        </Card>
        </motion.div>
    );
}
