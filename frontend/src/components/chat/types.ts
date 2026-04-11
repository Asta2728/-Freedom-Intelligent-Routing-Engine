// Types responsible for message response format from streams

export interface StreamDataPayload {
    conversation_id?: string;
    [key: string]: any;
}

export interface ChatMessage {
    id: string;
    role: "user" | "assistant" | "system" | "data";
    content: string;
    createdAt?: Date;
}

export interface ChatCompletionRequest {
    message: string;
    history: ChatMessage[];
    conversation_id?: string;
}
