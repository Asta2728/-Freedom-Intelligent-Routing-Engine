"use client";

import { AiChatDrawerPanel } from "@/components/chat/ai-chat-drawer-panel";
import { AiChatButton } from "@/components/chat/ai-chat-button";

export default function FireLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen w-full overflow-hidden">
            <div className="flex flex-1 flex-col overflow-hidden">
                {children}
            </div>
            <AiChatDrawerPanel />
            <AiChatButton />
        </div>
    );
}
