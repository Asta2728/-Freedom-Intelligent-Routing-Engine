"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { useEffect } from "react";
import { useNotificationStore } from "@/store/notification-store";
import { useAuthStore } from "@/store/auth-store";
import { useQuery } from "@tanstack/react-query";
import { useDialogControl } from "@/hooks/use-dialog-control";
import { getNotificationFeedApiV1NotificationsFeedGetOptions } from "@/lib/api/client/@tanstack/react-query.gen";
import type { NotificationRead } from "@/lib/api/client";
import { NotificationsListDialog } from "./dialogs";


export function NotificationsBell() {
    const listDialog = useDialogControl<void>(undefined);
    const { unreadCount, setUnreadCount } = useNotificationStore();
    const { isAuthenticated } = useAuthStore();

    // Feed query: runs on page load, polls every 30s — used only for the unread badge count.
    const { data } = useQuery({
        ...getNotificationFeedApiV1NotificationsFeedGetOptions(),
        enabled: isAuthenticated,
        refetchInterval: 30_000,
        staleTime: 10_000,
    });

    useEffect(() => {
        if (data?.unread_count !== undefined) {
            setUnreadCount(data.unread_count);
        }
    }, [data?.unread_count, setUnreadCount]);

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => listDialog.show()}
                aria-label="Open notifications"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <Badge
                        variant="destructive"
                        className="absolute -right-1 -top-1 h-5 min-w-5 px-1 text-xs"
                    >
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </Badge>
                )}
                <span className="sr-only">Notifications</span>
            </Button>

            <NotificationsListDialog control={listDialog} />
        </>
    );
}