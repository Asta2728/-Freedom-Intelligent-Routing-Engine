"use client";

import { useEffect } from "react";
import { nanoid } from "nanoid";
import { useChatStore } from "@/store/chat-store";
import { ChatThreadList } from "./chat-thread-list";
import { ChatView } from "./chat-view";

interface ChatSidebarProps {
    suggestions?: string[];
    isOpen: boolean;
    onClose: () => void;
    onToggle: () => void;
}

export function ChatSidebar({ suggestions, isOpen, onClose, onToggle }: ChatSidebarProps) {
    const { currentChat, setCurrentChat } = useChatStore();

    // Global keyboard shortcut: Cmd+I / Ctrl+I to toggle sidebar
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (
                (event.metaKey || event.ctrlKey) &&
                !event.altKey &&
                !event.shiftKey &&
                event.key.toLowerCase() === "i"
            ) {
                event.preventDefault();
                onToggle();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onToggle]);

    const handleNewChat = () => {
        setCurrentChat({
            id: nanoid(),
            name: "New Chat",
            updatedAt: Date.now(),
        });
    };

    return (
        <div className="flex flex-col h-full w-full">
            {currentChat ? (
                <ChatView suggestions={suggestions} isOpen={isOpen} onClose={onClose} />
            ) : (
                <ChatThreadList onNewChat={handleNewChat} onClose={onClose} />
            )}
        </div>
    );
}
