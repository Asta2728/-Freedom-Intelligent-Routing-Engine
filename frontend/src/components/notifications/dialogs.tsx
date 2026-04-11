"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { UseDialogControlProps } from "@/hooks/use-dialog-control";
import { useDialogControl } from "@/hooks/use-dialog-control";
import type { NotificationRead } from "@/lib/api/client";
import {
    getNotificationFeedApiV1NotificationsFeedGetOptions,
    markAllNotificationsReadApiV1NotificationsReadAllPostMutation,
    markNotificationReadApiV1NotificationsNotificationIdReadPostMutation,
} from "@/lib/api/client/@tanstack/react-query.gen";
import { cn } from "@/lib/utils";
import { useNotificationStore } from "@/store/notification-store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Bell, Loader2 } from "lucide-react";
import { useCallback, useEffect } from "react";

function getPayloadString(payload: NotificationRead["payload"], key: string): string | null {
    if (!payload || typeof payload !== "object") {
        return null;
    }
    const value = payload[key];
    return typeof value === "string" && value.trim() ? value : null;
}

// ---------- Notification Detail Dialog ----------
interface NotificationDetailDialogProps {
    control: UseDialogControlProps<NotificationRead | null>;
}

export function NotificationDetailDialog({ control }: NotificationDetailDialogProps) {
    const queryClient = useQueryClient();

    const markReadMutation = useMutation({
        ...markNotificationReadApiV1NotificationsNotificationIdReadPostMutation(),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: getNotificationFeedApiV1NotificationsFeedGetOptions().queryKey,
            });
        },
    });

    // Auto-mark as read when opening an unread notification
    useEffect(() => {
        const n = control.data;
        if (control.isVisible && n && !n.is_read) {
            markReadMutation.mutate({ path: { notification_id: n.id } });
        }
    }, [control.isVisible, control.data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const notification = control.data;
    if (!notification) return null;

    const level = getPayloadString(notification.payload, "level");
    const verb = getPayloadString(notification.payload, "verb");
    const targetType = getPayloadString(notification.payload, "target_type");
    const targetId = getPayloadString(notification.payload, "target_id");

    return (
        <Dialog
            open={control.isVisible}
            onOpenChange={(v) => (v ? control.show(notification) : control.hide())}
        >
            <DialogContent className="w-[95vw] max-w-3xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {notification.title}
                        {!notification.is_read && (
                            <Badge variant="default" className="ml-2">New</Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="flex-1 -mx-6 px-6 pb-4">
                    <div className="space-y-4 py-4">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground mb-2">Message</p>
                            <p className="text-sm whitespace-pre-wrap">{notification.body || "No message provided."}</p>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            {level && (
                                <div>
                                    <p className="font-medium text-muted-foreground mb-1">Level</p>
                                    <Badge variant="outline">{level}</Badge>
                                </div>
                            )}
                            <div>
                                <p className="font-medium text-muted-foreground mb-1">Type</p>
                                <p className="text-muted-foreground">{notification.type}</p>
                            </div>
                            {verb && (
                                <div>
                                    <p className="font-medium text-muted-foreground mb-1">Verb</p>
                                    <p className="text-muted-foreground">{verb}</p>
                                </div>
                            )}
                            <div>
                                <p className="font-medium text-muted-foreground mb-1">Created</p>
                                <p className="text-muted-foreground">
                                    {format(new Date(notification.created_at), "MMM dd, yyyy HH:mm")}
                                </p>
                            </div>
                            {notification.updated_at && notification.is_read && (
                                <div>
                                    <p className="font-medium text-muted-foreground mb-1">Read</p>
                                    <p className="text-muted-foreground">
                                        {format(new Date(notification.updated_at), "MMM dd, yyyy HH:mm")}
                                    </p>
                                </div>
                            )}
                        </div>

                        {(targetType || targetId) && (
                            <>
                                <Separator />
                                <div className="text-sm">
                                    <p className="font-medium text-muted-foreground mb-1">Related to</p>
                                    <div className="space-y-1">
                                        {targetType && (
                                            <p className="text-muted-foreground">
                                                Type:{" "}
                                                <span className="font-mono">{targetType}</span>
                                            </p>
                                        )}
                                        {targetId && (
                                            <p className="text-muted-foreground">
                                                ID:{" "}
                                                <span className="font-mono">{targetId}</span>
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter>
                    <Button variant="outline" onClick={control.hide}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---------- Notifications List Dialog ----------
interface NotificationsListDialogProps {
    control: UseDialogControlProps<void>;
}

export function NotificationsListDialog({ control }: NotificationsListDialogProps) {
    const queryClient = useQueryClient();
    const { setUnreadCount } = useNotificationStore();
    const detailDialog = useDialogControl<NotificationRead | null>(null);

    // List query — lazy: only fetches when the dialog is open.
    // Uses a unique query key separate from the bell's feed query.
    const { data, isLoading } = useQuery({
        ...getNotificationFeedApiV1NotificationsFeedGetOptions(),
        enabled: control.isVisible,
        staleTime: 5_000,
    });

    useEffect(() => {
        if (data?.unread_count !== undefined) {
            setUnreadCount(data.unread_count);
        }
    }, [data?.unread_count, setUnreadCount]);

    const markAllReadMutation = useMutation({
        ...markAllNotificationsReadApiV1NotificationsReadAllPostMutation(),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: getNotificationFeedApiV1NotificationsFeedGetOptions().queryKey,
            });
        },
    });

    const handleNotificationClick = useCallback(
        (notification: NotificationRead) => detailDialog.show(notification),
        [detailDialog],
    );

    const unreadCount = data?.unread_count ?? 0;
    const notifications = data?.items ?? [];

    return (
        <Dialog
            open={control.isVisible}
            onOpenChange={(v) => (v ? control.show() : control.hide())}
        >
            <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between pr-4">
                        <span className="flex items-center gap-2">
                            <Bell className="h-5 w-5" />
                            Notifications
                            {unreadCount > 0 && (
                                <Badge variant="destructive">
                                    {unreadCount > 99 ? "99+" : unreadCount} unread
                                </Badge>
                            )}
                        </span>
                        {unreadCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAllReadMutation.mutate({})}
                                disabled={markAllReadMutation.isPending}
                            >
                                Mark all as read
                            </Button>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="flex-1 -mx-6 px-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                            No notifications
                        </div>
                    ) : (
                        <div className="space-y-2 py-2">
                            {notifications.map((n) => (
                                <div
                                    key={n.id}
                                    role="button"
                                    tabIndex={0}
                                    className={cn(
                                        "flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                        !n.is_read && "bg-muted/30 border-primary/20",
                                    )}
                                    onClick={() => handleNotificationClick(n)}
                                    onKeyDown={(e) => e.key === "Enter" && handleNotificationClick(n)}
                                >
                                    <div className="flex w-full items-start justify-between gap-2">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium leading-none">
                                                    {n.title}
                                                </p>
                                                {!n.is_read && (
                                                    <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                                                )}
                                            </div>
                                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                                                {n.body || "No message provided."}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-muted-foreground">
                                            {format(new Date(n.created_at), "MMM dd, yyyy HH:mm")}
                                        </p>
                                        {getPayloadString(n.payload, "level") && (
                                            <Badge variant="outline" className="text-xs">
                                                {getPayloadString(n.payload, "level")}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>

            <NotificationDetailDialog control={detailDialog} />
        </Dialog>
    );
}