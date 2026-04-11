import { env } from "@/env";
import type { CreateClientConfig } from "./client/client.gen";

export const createClientConfig: CreateClientConfig = (config) => ({
    ...config,
    baseUrl: env.NEXT_PUBLIC_API_URL,
});