"use client";

import { formatDistanceToNow } from "date-fns";
import { MessageSquare, PlusCircle, Trash2, X } from "lucide-react";
import { useChatStore } from "@/store/chat-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ConversationRead, ConversationsService } from "@/lib/api/client";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface ChatThreadListProps {
    onNewChat: () => void;
    onClose: () => void;
}

export function ChatThreadList({ onNewChat, onClose }: ChatThreadListProps) {
    const { setCurrentChat } = useChatStore();
    const queryClient = useQueryClient();

    const { data: conversations, isLoading } = useQuery({
        queryKey: ["conversations"],
        queryFn: async () => {
            const res = await ConversationsService.listConversationsApiV1ConversationsGet({
                query: { skip: 0, limit: 50 },
            });
            return res.data;
        },
        staleTime: 0,
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) =>
            ConversationsService.deleteConversationApiV1ConversationsConversationIdDelete({
                path: { conversation_id: id },
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            toast.success("Conversation deleted");
        },
    });

    const rawThreads = Array.isArray(conversations)
        ? conversations
        : (conversations?.items ?? []);
    const threads = rawThreads as ConversationRead[];

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-3 shrink-0">
                <h2 className="font-semibold text-sm">Conversations</h2>
                <div className="flex items-center gap-1">
                    <Button onClick={onNewChat} size="sm" variant="ghost" className="gap-1.5 h-7 px-2">
                        <PlusCircle className="size-3.5" />
                        New
                    </Button>
                    <Button onClick={onClose} size="icon" variant="ghost" className="h-7 w-7">
                        <X className="size-3.5" />
                    </Button>
                </div>
            </div>
            <Separator />
            <ScrollArea className="flex-1">
                {isLoading ? (
                    <div className="flex flex-col gap-1 p-2">
                        {[...Array(4)].map((_, i) => (
                            <Skeleton key={i} className="h-14 w-full rounded-md" />
                        ))}
                    </div>
                ) : threads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 px-4 text-center">
                        <MessageSquare className="size-8 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">No conversations yet.</p>
                        <p className="text-xs text-muted-foreground/70">Start a new chat to get going.</p>
                    </div>
                ) : (
                    <div className="py-1">
                        {threads.map((thread) => {
                            const threadDate = thread.updated_at ?? thread.created_at ?? new Date().toISOString();

                            return (
                            <div
                                key={thread.id}
                                className="group w-full text-left flex items-center justify-between gap-2 px-4 py-3 hover:bg-muted/60 transition-colors cursor-pointer"
                                onClick={() => setCurrentChat({
                                    id: thread.id,
                                    name: thread.title || "Untitled",
                                    updatedAt: new Date(threadDate).getTime(),
                                })}
                            >
                                <div className="flex flex-col gap-0.5 min-w-0">
                                    <span className="text-sm font-medium truncate">{thread.title || "Untitled"}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(threadDate), { addSuffix: true })}
                                    </span>
                                </div>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteMutation.mutate(thread.id);
                                    }}
                                >
                                    <Trash2 className="size-3" />
                                </Button>
                            </div>
                            );
                        })}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
