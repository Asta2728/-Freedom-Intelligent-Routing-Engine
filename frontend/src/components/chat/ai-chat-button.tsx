"use client";

import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useChatStore } from "@/store/chat-store";
import { cn } from "@/lib/utils";

export function AiChatButton() {
    const { toggleOpen, isOpen } = useChatStore();

    return (
        <Button
            variant="default"
            size="icon"
            className={cn(
                "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg transition-all duration-300 hover:scale-110",
                isOpen && "opacity-0 pointer-events-none"
            )}
            onClick={toggleOpen}
            title="Open AI Chat"
        >
            <Sparkles className="h-6 w-6" />
        </Button>
    );
}
