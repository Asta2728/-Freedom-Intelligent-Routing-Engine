import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ChatThread {
    id: string;
    name: string;
    updatedAt: number;
}

interface ChatState {
    prompt: string;
    setPrompt: (prompt: string) => void;
    currentChat: ChatThread | null;
    setCurrentChat: (chat: ChatThread) => void;
    clearCurrentChat: () => void;
    isOpen: boolean;
    setOpen: (open: boolean) => void;
    toggleOpen: () => void;
}

export const useChatStore = create<ChatState>()(
    persist(
        (set) => ({
            prompt: "",
            setPrompt: (prompt) => set({ prompt }),
            currentChat: null,
            setCurrentChat: (chat) => set({ currentChat: chat }),
            clearCurrentChat: () => set({ currentChat: null }),
            isOpen: false,
            setOpen: (isOpen) => set({ isOpen }),
            toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
        }),
        {
            name: "chat-storage",
            // Only persist currentChat, not the ephemeral prompt
            partialize: (state) => ({
                currentChat: state.currentChat,
                isOpen: state.isOpen,
            }),
        }
    )
);
