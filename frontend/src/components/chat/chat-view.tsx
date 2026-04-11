"use client";

import type { PromptInputProps } from "@/components/ai-elements/prompt-input";
import { useChat } from "@ai-sdk/react";
import { useQuery } from "@tanstack/react-query";
import type { UIMessage, TextUIPart, FileUIPart, InferUITool } from "ai";
import { z } from "zod";
import {
    createCurrentDatetimeTool,
    createSearchTicketsTool,
    createGetManagerWorkloadTool,
    createAnalyzeBusinessUnitsTool,
    createExecuteReadQueryTool,
    createGetTicketAnalyticsTool,
} from "./tools";
import { DefaultChatTransport, isToolUIPart } from "ai";
import { ArrowLeft, Copy, Trash, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useChatStore } from "@/store/chat-store";
import { useAuthStore } from "@/store/auth-store";
import { client } from "@/lib/api/client/client.gen";
import { listMessagesApiV1ConversationsConversationIdMessagesGetOptions } from "@/lib/api/client/@tanstack/react-query.gen";
import { cn } from "@/lib/utils";

// ai-elements
import {
    Attachment,
    AttachmentPreview,
    AttachmentRemove,
    Attachments,
} from "@/components/ai-elements/attachments";
import {
    Conversation,
    ConversationContent,
    ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
    Message,
    MessageContent,
    MessageResponse,
} from "@/components/ai-elements/message";
import { Reasoning, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import {
    PromptInput,
    PromptInputBody,
    PromptInputFooter,
    PromptInputHeader,
    PromptInputProvider,
    PromptInputSubmit,
    PromptInputTextarea,
    usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Plus } from "lucide-react";

// shadcn
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import { ChartRenderer } from "./chart-renderer";
import { ChatTableFilters } from "./chat-table-filters";
import { ToolResultRenderer } from "./tool-result-renderer";

const isUUID = (id?: string) => {
    if (!id) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
};

const PromptInputAttachmentsDisplay = () => {
    const attachments = usePromptInputAttachments();
    if (attachments.files.length === 0) return null;
    return (
        <Attachments variant="inline">
            {attachments.files.map((attachment) => (
                <Attachment
                    data={attachment}
                    key={attachment.id}
                    onRemove={() => attachments.remove(attachment.id)}
                >
                    <AttachmentPreview />
                    <AttachmentRemove />
                </Attachment>
            ))}
        </Attachments>
    );
};

const FileUploadButton = () => {
    const attachments = usePromptInputAttachments();
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    className="h-8 w-8 rounded-full"
                    onClick={(e) => {
                        e.preventDefault();
                        attachments.openFileDialog();
                    }}
                    size="icon"
                    variant="ghost"
                >
                    <Plus className="size-4" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Attach files or images</TooltipContent>
        </Tooltip>
    );
};

const ChatThinkingLoader = () => {
    return (
        <Message from="assistant" className="max-w-[92%]">
            <MessageContent>
                <Reasoning className="mb-0" defaultOpen isStreaming>
                    <ReasoningTrigger />
                </Reasoning>
            </MessageContent>
        </Message>
    );
};

function parseTextWithCharts(text: string) {
    const regex = /```\s*chart\s*\r?\n([\s\S]*?)```/gi;
    const parts: Array<{ type: "text" | "chart"; content: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
        }
        parts.push({ type: 'chart', content: match[1].trim() });
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        parts.push({ type: 'text', content: text.substring(lastIndex) });
    }

    const hasChartBlock = parts.some((part) => part.type === "chart");
    if (!hasChartBlock) {
        const autoChart = buildChartFromAsciiDistribution(text);
        if (autoChart) {
            return [{ type: "chart", content: autoChart }] as Array<{ type: "text" | "chart"; content: string }>;
        }
    }

    return parts.length > 0 ? parts : [{ type: 'text', content: text }];
}

function buildChartFromAsciiDistribution(text: string): string | null {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) {
        return null;
    }

    const rows: Array<{ name: string; value: number }> = [];
    const rowRegex = /^\|?\s*([^|()]+?)\s*\((\d+(?:\.\d+)?)%\)\s*\|?$/;

    for (const line of lines) {
        const match = line.match(rowRegex);
        if (!match) {
            continue;
        }
        const name = match[1].trim();
        const value = Number.parseFloat(match[2]);
        if (!name || Number.isNaN(value)) {
            continue;
        }
        rows.push({ name, value });
    }

    if (rows.length < 3) {
        return null;
    }

    const title = lines.find((line) => !line.startsWith("|") && !line.startsWith("-")) || "Distribution";
    return JSON.stringify(
        {
            type: "pie",
            title,
            data: rows,
        },
        null,
        2
    );
}

interface ChatViewProps {
    suggestions?: string[];
    isOpen: boolean;
    onClose: () => void;
}

// =============================================================================
// Custom UI Message Types (Strictly Typed)
// =============================================================================

export const messageMetadataSchema = z.object({
    createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

export type ChatTools = {
    current_datetime: InferUITool<ReturnType<typeof createCurrentDatetimeTool>>;
    search_tickets: InferUITool<ReturnType<typeof createSearchTicketsTool>>;
    get_manager_workload: InferUITool<ReturnType<typeof createGetManagerWorkloadTool>>;
    analyze_business_units: InferUITool<ReturnType<typeof createAnalyzeBusinessUnitsTool>>;
    execute_read_query: InferUITool<ReturnType<typeof createExecuteReadQueryTool>>;
    get_ticket_analytics: InferUITool<ReturnType<typeof createGetTicketAnalyticsTool>>;
};

export type UIChatMessage = UIMessage<MessageMetadata, Record<string, never>, ChatTools>;

const EN_TRANSLATION_SUFFIX =
    "\n\nТакже добавь перевод ответа на английский язык: сначала основной ответ, затем отдельный блок с заголовком 'English translation'.";

export function ChatView({
    suggestions = [
        "Start FIRE requirements task list and gap analysis",
        "Show ticket type distribution by city as a pie chart",
        "Compare sentiment (tone) split by business unit",
        "Show language mix (RU/ENG/KZ) as a bar chart",
        "Find routing failures and explain root causes",
        "Show top overloaded managers and balancing suggestions",
        "Summarize VIP/Priority handling compliance",
        "Create a quick action plan for missing backend agent features",
    ],
    isOpen,
    onClose,
}: ChatViewProps) {
    const { currentChat, clearCurrentChat, prompt, setPrompt } = useChatStore();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [localPrompt, setLocalPrompt] = useState("");
    const [providerKey, setProviderKey] = useState(0);
    const [translateToEnglish, setTranslateToEnglish] = useState(false);
    const { token } = useAuthStore();

    const enrichPromptWithTranslation = (text: string) => {
        if (!translateToEnglish) {
            return text;
        }
        if (/english translation|английск/i.test(text)) {
            return text;
        }
        return `${text}${EN_TRANSLATION_SUFFIX}`;
    };

    const currentChatIdRef = useRef(currentChat?.id);
    useEffect(() => {
        currentChatIdRef.current = currentChat?.id;
    }, [currentChat?.id]);

    const { setCurrentChat } = useChatStore(); // Ensure we have access to the setter

    const { messages, sendMessage, status, setMessages, stop } = useChat<UIChatMessage>({
        onError: (error) => {
            console.log("[ChatView] onError", error);
            toast.error(error.message);
        },
        transport: new DefaultChatTransport({
            api: `${client.getConfig().baseUrl}/api/v1/chat`,
            headers: token ? {
                Authorization: `Bearer ${token}`
            } : undefined,
        }),
        onFinish: () => {
            // After stream finishes, we might have additional data to process
        },
        onData: (data) => {
            // The data argument can be an array or a single object depending on the SDK version/state
            const dataItems = Array.isArray(data) ? data : [data];

            type ConversationStreamEvent = {
                type: "data-conversation";
                data?: {
                    conversation_id?: string;
                };
            };

            // Peek for conversation_id in the data stream (from backend's custom JSON SSE type)
            const convData = dataItems.find((item): item is ConversationStreamEvent => {
                if (!item || typeof item !== "object") {
                    return false;
                }

                const event = item as { type?: unknown };
                return event.type === "data-conversation";
            });
            if (convData?.data?.conversation_id) {
                const liveId = convData.data.conversation_id;
                if (isUUID(liveId) && (!currentChat || currentChat.id !== liveId)) {
                    setCurrentChat({
                        id: liveId,
                        name: currentChat?.name ?? "New Chat",
                        updatedAt: Date.now(),
                    });
                }
            }
        },
        ...(currentChat?.id && isUUID(currentChat.id) ? { id: currentChat.id } : {}),
    });

    // Sync external prompt
    useEffect(() => {
        if (prompt && prompt !== localPrompt) {
            const timer = setTimeout(() => {
                setLocalPrompt(prompt);
                setProviderKey((prev) => prev + 1);
            }, 0);

            return () => clearTimeout(timer);
        }
    }, [prompt, localPrompt]);

    // Load existing messages when currentChat changes using TanStack Query
    const { data: messageData } = useQuery({
        ...listMessagesApiV1ConversationsConversationIdMessagesGetOptions({
            path: {
                conversation_id: currentChat?.id as string,
            },
        }),
        enabled: !!currentChat?.id && isUUID(currentChat.id),
        staleTime: 5000,
    });

    useEffect(() => {
        if (messageData?.items) {
            const mappedMessages: UIChatMessage[] = messageData.items.map((msg) => ({
                id: msg.id,
                role: msg.role as UIChatMessage["role"],
                content: msg.content,
                parts: [{ type: "text", text: msg.content } as TextUIPart],
                annotations: [],
            }));
            setMessages(mappedMessages);
        } else if (!currentChat?.id) {
            setMessages([]);
        }
    }, [messageData, currentChat?.id, setMessages]);

    // Focus on open
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => textareaRef.current?.focus(), 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const handleSuggestionClick = async (text: string) => {
        if (status === "streaming" || status === "submitted") return;
        setLocalPrompt("");
        setPrompt("");
        const validId = currentChatIdRef.current && isUUID(currentChatIdRef.current) ? currentChatIdRef.current : null;
        const finalText = enrichPromptWithTranslation(text);
        await sendMessage(
            { text: finalText },
            {
                body: {
                    conversation_id: validId,
                    ...(validId ? {} : { action: "INIT_CHAT" }),
                }
            }
        );
    };

    const handleSubmit: PromptInputProps["onSubmit"] = async (message, event) => {
        event.preventDefault();
        if (status === "streaming" || status === "submitted") return;
        const { text, files } = message;
        if (!text && (!files || files.length === 0)) return;
        setLocalPrompt("");
        setPrompt("");
        console.log("[handleSubmit]", message);
        const finalText = enrichPromptWithTranslation(text ?? "");

        const validId = currentChatIdRef.current && isUUID(currentChatIdRef.current) ? currentChatIdRef.current : null;
        await sendMessage(
            {
                text: finalText,
                files: files.map(f => ({
                    type: 'file',
                    mediaType: f.mediaType,
                    filename: f.filename,
                    url: f.url,
                }))
            },
            {
                body: {
                    conversation_id: validId,
                    ...(validId ? {} : { action: "INIT_CHAT" }),
                }
            }
        );
    };

    const handleApplyTableFilterPrompt = (nextPrompt: string) => {
        setLocalPrompt(nextPrompt);
        setPrompt(nextPrompt);
        setProviderKey((prev) => prev + 1);
        setTimeout(() => textareaRef.current?.focus(), 0);
    };

    const handleClearChat = () => {
        setMessages([]);
        toast.success("Chat history cleared");
    };

    const handleCopyChat = () => {
        if (!messages.length) return;
        const text = messages
            .map((m) => {
                const textParts = m.parts
                    .filter((p): p is TextUIPart => p.type === "text")
                    .map(p => p.text)
                    .join("");
                return `${m.role}: ${textParts}`;
            })
            .join("\n\n");
        navigator.clipboard.writeText(text);
        toast.success("Chat copied to clipboard");
    };

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 shrink-0">
                <div className="flex items-center gap-1.5">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                onClick={clearCurrentChat}
                                size="icon"
                                className="h-7 w-7"
                                variant="ghost"
                            >
                                <ArrowLeft className="size-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Back to conversations</TooltipContent>
                    </Tooltip>
                    <span className="text-sm font-semibold truncate max-w-[140px]">
                        {currentChat?.name ?? "New Chat"}
                    </span>
                </div>
                <div className="flex items-center">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                disabled={messages.length === 0}
                                onClick={handleCopyChat}
                                size="icon"
                                className="h-7 w-7"
                                variant="ghost"
                            >
                                <Copy className="size-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy chat</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                disabled={messages.length === 0}
                                onClick={handleClearChat}
                                size="icon"
                                className="h-7 w-7"
                                variant="ghost"
                            >
                                <Trash className="size-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Clear chat</TooltipContent>
                    </Tooltip>
                    <div className="w-px h-4 bg-border mx-0.5" />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                onClick={onClose}
                                size="icon"
                                className="h-7 w-7"
                                variant="ghost"
                            >
                                <X className="size-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Close assistant</TooltipContent>
                    </Tooltip>
                </div>
            </div>

            <Separator />

            {/* Messages */}
            <Conversation className="flex-1">
                <ConversationContent>
                    {messages.map((message) => {
                        const fileParts = message.parts.filter((p): p is FileUIPart => p.type === "file");
                        const textParts = message.parts.filter((p): p is TextUIPart => p.type === "text");
                        const toolParts = message.parts.filter(
                            (p) =>
                                isToolUIPart(p)
                        );

                        const parsedTextParts = textParts.map((part) => parseTextWithCharts(part.text));
                        const textSegments = parsedTextParts.flatMap((segments) =>
                            segments
                                .filter((segment) => segment.type === "text")
                                .map((segment) => segment.content)
                        );
                        const chartSegments = parsedTextParts.flatMap((segments) =>
                            segments
                                .filter((segment) => segment.type === "chart")
                                .map((segment) => segment.content)
                        );

                        return (
                            <Message
                                className={cn(
                                    message.role === "assistant" && chartSegments.length > 0
                                        ? "max-w-full"
                                        : "max-w-[92%]"
                                )}
                                from={message.role}
                                key={message.id}
                            >
                                {/* File Attachments */}
                                {fileParts.length > 0 && (
                                    <Attachments
                                        variant="grid"
                                        className={cn(
                                            "mb-px gap-1 w-fit",
                                            message.role === "user" ? "ml-auto" : "mr-auto"
                                        )}
                                    >
                                        {fileParts.map((file, idx) => (
                                            <Attachment
                                                key={`${message.id}-file-${idx}`}
                                                data={{ ...file, id: `${message.id}-file-${idx}` }}
                                                className="size-32"
                                            >
                                                <AttachmentPreview />
                                            </Attachment>
                                        ))}
                                    </Attachments>
                                )}

                                {/* Text content bubble */}
                                {textSegments.length > 0 && (
                                    <MessageContent className="overflow-visible">
                                        <div className="flex flex-col gap-2 w-full">
                                            {textSegments.map((content, index) => {
                                                if (!content.trim()) return null;
                                                return (
                                                    <MessageResponse key={index} className="text-wrap">
                                                        {content}
                                                    </MessageResponse>
                                                );
                                            })}
                                        </div>
                                    </MessageContent>
                                )}

                                {chartSegments.length > 0 && (
                                    <div
                                        className={cn(
                                            "mt-2 w-full",
                                            message.role === "user" ? "ml-auto max-w-[92%]" : "max-w-full"
                                        )}
                                    >
                                        {chartSegments.map((chartJson, idx) => (
                                            <ChartRenderer key={`${message.id}-chart-${idx}`} rawJson={chartJson} />
                                        ))}
                                    </div>
                                )}

                                {toolParts.length > 0 && (
                                    <div className="mt-2 flex flex-col gap-2">
                                        {toolParts.map((part, idx) => (
                                            <ToolResultRenderer key={`${message.id}-tool-${idx}`} part={part} />
                                        ))}
                                    </div>
                                )}
                            </Message>
                        );
                    })}
                    {(status === "submitted" || status === "streaming") && <ChatThinkingLoader />}
                </ConversationContent>
                <ConversationScrollButton className="border-none bg-foreground text-background hover:bg-foreground/80" />
            </Conversation>

            {/* Input area */}
            <div className="shrink-0 p-3 border-t">
                <ChatTableFilters onApply={handleApplyTableFilterPrompt} />
                <div className="mb-3 flex items-center justify-between rounded-md border bg-card/60 px-2.5 py-2">
                    <Label htmlFor="chat-translate-en" className="text-xs text-muted-foreground">
                        Добавлять перевод ответа на английский
                    </Label>
                    <Switch
                        id="chat-translate-en"
                        checked={translateToEnglish}
                        onCheckedChange={setTranslateToEnglish}
                    />
                </div>
                {!messages.length && (
                    <div className="mb-3">
                        <Suggestions className="flex-col items-start gap-0.5">
                            {suggestions.map((text) => (
                                <Suggestion
                                    className="rounded-none p-0 text-left text-xs"
                                    key={text}
                                    onClick={handleSuggestionClick}
                                    suggestion={text}
                                    variant="link"
                                />
                            ))}
                        </Suggestions>
                        <p className="text-muted-foreground text-xs mt-2">
                            Tip: Toggle with{" "}
                            <kbd className="rounded border bg-transparent px-1 py-0.5 text-[10px] font-mono">⌘</kbd>
                            {" "}<kbd className="rounded border bg-transparent px-1 py-0.5 text-[10px] font-mono">I</kbd>
                        </p>
                    </div>
                )}
                <PromptInputProvider initialInput={localPrompt} key={providerKey}>
                    <PromptInput globalDrop multiple onSubmit={handleSubmit}>
                        <PromptInputHeader>
                            <PromptInputAttachmentsDisplay />
                        </PromptInputHeader>
                        <PromptInputBody>
                            <PromptInputTextarea
                                maxLength={1000}
                                onChange={(e) => {
                                    setLocalPrompt(e.target.value);
                                    setPrompt(e.target.value);
                                }}
                                ref={textareaRef}
                            />
                        </PromptInputBody>
                        <PromptInputFooter>
                            <div className="flex items-center gap-1">
                                <FileUploadButton />
                                <p className="text-muted-foreground text-xs">{localPrompt.length} / 1000</p>
                            </div>
                            <PromptInputSubmit
                                onClick={
                                    status === "streaming"
                                        ? (e) => { e.preventDefault(); stop(); }
                                        : undefined
                                }
                                status={status}
                            />
                        </PromptInputFooter>
                    </PromptInput>
                </PromptInputProvider>
            </div>
        </div>
    );
}
