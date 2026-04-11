"use client";

import { useState } from "react";

import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ResizableDrawer } from "@/components/ui/resizable-drawer";
import { useChatStore } from "@/store/chat-store";

interface AiChatDrawerPanelProps {
    suggestions?: string[];
}

export function AiChatDrawerPanel({ suggestions }: AiChatDrawerPanelProps) {
    const { isOpen, setOpen, toggleOpen } = useChatStore();
    const [width, setWidth] = useState(() => {
        if (typeof window === "undefined") {
            return 460;
        }
        const stored = window.localStorage.getItem("chat-drawer-width");
        if (!stored) {
            return 460;
        }
        const parsed = Number.parseInt(stored, 10);
        return Number.isNaN(parsed) ? 460 : Math.min(760, Math.max(360, parsed));
    });

    const handleWidthChange = (nextWidth: number) => {
        setWidth(nextWidth);
        if (typeof window !== "undefined") {
            window.localStorage.setItem("chat-drawer-width", String(nextWidth));
        }
    };

    return (
        <ResizableDrawer
            open={isOpen}
            side="right"
            width={width}
            minWidth={360}
            maxWidth={760}
            onWidthChange={handleWidthChange}
            className="shrink-0"
        >
            <ChatSidebar
                suggestions={suggestions}
                isOpen={isOpen}
                onClose={() => setOpen(false)}
                onToggle={toggleOpen}
            />
        </ResizableDrawer>
    );
}
