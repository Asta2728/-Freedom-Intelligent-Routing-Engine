"use client";

import { useCallback, useMemo } from "react";
import { Header } from "@/components/layout/dashboard/header";
import { Main } from "@/components/layout/dashboard/main";
import { ThemeSwitch } from "@/components/layout/dashboard/theme-switch";
import { NotificationsBell } from "@/components/notifications/notification-bell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, Terminal, Activity, Clock, FileIcon, ExternalLink, FileText as FileTextIcon } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { useParams } from "next/navigation";
import { TaskLogs } from "../../_components/task-logs";
import { TaskLogFilters } from "../../_components/task-log-filters";
import { useQuery } from "@tanstack/react-query";
import { FireService } from "@/lib/api/client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth-store";
import { env } from "@/env";
import { PayloadImageGallery } from "@/components/PayloadImageGallery";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];

function isValidImageType(path: string): boolean {
    const lowerPath = path.toLowerCase();
    return IMAGE_EXTENSIONS.some((ext) => lowerPath.endsWith(ext));
}

export default function TaskDetailPage() {
    const router = useRouter();
    const params = useParams();
    const taskId = params.taskId as string;
    const { token } = useAuthStore();

    const { data: task } = useQuery({
        queryKey: ["task", taskId],
        queryFn: async () => {
            const response = await FireService.getTaskApiV1FireTasksTaskIdGet({
                path: { task_id: taskId }
            });
            return response.data;
        },
        enabled: Boolean(taskId),
    });

    const handleOpenFile = useCallback(async (filePath: string) => {
        try {
            const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/media/${filePath}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) throw new Error("Failed to fetch file");

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");

            // Clean up the URL after some time
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (error) {
            console.error("Error opening file:", error);
        }
    }, [token]);

    const handleImageOpen = useCallback((path: string) => {
        console.log("Opening:", path);
    }, []);

    const payloadFiles = useMemo(() => {
        if (!task?.payload) {
            return [];
        }

        return Object.entries(task.payload)
            .filter(([, value]) => typeof value === "string" && (value.includes("/") || value.endsWith(".csv")))
            .map(([key, value]) => ({
                label: key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
                path: value as string,
            }));
    }, [task?.payload]);

    const imageFiles = useMemo(
        () => payloadFiles.filter((file) => isValidImageType(file.path)),
        [payloadFiles]
    );

    const otherFiles = useMemo(
        () => payloadFiles.filter((file) => !isValidImageType(file.path)),
        [payloadFiles]
    );

    const taskIdPreview = useMemo(() => taskId.slice(0, 8), [taskId]);

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
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.back()}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">Task Details</h2>
                        <p className="text-muted-foreground">
                            Viewing execution history and logs for task {taskIdPreview}
                        </p>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="md:col-span-1 border-primary/20 bg-primary/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-sm font-medium">
                                <Activity className="h-4 w-4 text-primary" />
                                Task Info
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Task Name</span>
                                    <span className="font-medium">{task?.task_name || "Loading..."}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Status</span>
                                    {task ? (
                                        <Badge variant={task.status === "COMPLETED" ? "default" : task.status === "FAILED" ? "destructive" : "secondary"}>
                                            {task.status}
                                        </Badge>
                                    ) : "Loading..."}
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Started At</span>
                                    <div className="flex items-center gap-1 text-sm text-foreground">
                                        <Clock className="h-3 w-3 text-muted-foreground" />
                                        {task ? format(new Date(task.created_at), "PPp") : "Loading..."}
                                    </div>
                                </div>
                                {task?.error_message && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs text-destructive uppercase font-bold tracking-tighter">Error</span>
                                        <span className="text-sm text-destructive font-mono text-[11px] whitespace-pre-wrap">{task.error_message}</span>
                                    </div>
                                )}
                            </div>

                            {payloadFiles.length > 0 && (
                                <div className="space-y-3 pt-4 border-t border-primary/10">
                                    {/* Image Gallery */}
                                    {imageFiles.length > 0 && (
                                        <div>
                                            <PayloadImageGallery 
                                                images={imageFiles}
                                                apiUrl={env.NEXT_PUBLIC_API_URL}
                                                onImageOpen={handleImageOpen}
                                            />
                                        </div>
                                    )}

                                    {/* Other Files */}
                                    {otherFiles.length > 0 && (
                                        <div className="space-y-3">
                                            <span className="text-xs text-primary uppercase font-bold tracking-tighter flex items-center gap-1">
                                                <FileTextIcon className="h-3 w-3" />
                                                Other Files
                                            </span>
                                            <div className="flex flex-col gap-2">
                                                {otherFiles.map((file) => (
                                                    <Button
                                                        key={file.path}
                                                        variant="ghost"
                                                        size="sm"
                                                        className="justify-between h-9 px-3 bg-muted/50 hover:bg-primary/10 hover:text-primary transition-all border border-transparent hover:border-primary/20"
                                                        onClick={() => handleOpenFile(file.path)}
                                                    >
                                                        <div className="flex items-center gap-2 truncate">
                                                            <FileIcon className="h-4 w-4 shrink-0 text-primary/60" />
                                                            <span className="truncate text-xs font-medium">{file.label}</span>
                                                        </div>
                                                        <ExternalLink className="h-3 w-3 shrink-0 opacity-40" />
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="md:col-span-2">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm font-medium">
                                <Terminal className="h-4 w-4 text-primary" />
                                Monitor
                            </CardTitle>
                            <TaskLogFilters />
                        </CardHeader>
                        <CardContent>
                            <TaskLogs taskId={taskId} />
                        </CardContent>
                    </Card>
                </div>
            </Main>
        </>
    );
}
