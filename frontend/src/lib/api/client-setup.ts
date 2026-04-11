"use client";

import { useAuthStore } from "@/store/auth-store";
import { client } from "./client/client.gen";

/**
 * Setup the Hey API client with authentication interceptors.
 * This should be called once when the app initializes.
 *
 * The interceptor automatically adds the Bearer token from the auth store
 * to all requests that require authentication.
 *
 * You can control authentication behavior using the `meta` property:
 *
 * @example
 * // Skip auth for public endpoints
 * await AuthService.login({ body: credentials, meta: { skipAuth: true } });
 *
 * @example
 * // Use custom token
 * await AdminService.action({ meta: { customToken: "admin-token" } });
 */
export function setupApiClient() {
    client.interceptors.request.use(async (request) => {
        const meta = (request as any).meta as
            | { skipAuth?: boolean; customToken?: string }
            | undefined;
        if (meta?.skipAuth) {
            return; // Skip adding token
        }
        const customToken = meta?.customToken;
        const token = customToken || useAuthStore.getState().token;
        if (token && request.headers instanceof Headers) {
            request.headers.set("Authorization", `Bearer ${token}`);
        }
    });

    // Response interceptor for error handling, especially 401 unauthorized
    client.interceptors.response.use(async (response) => {
        if (response.status === 401) {
            console.warn("Unauthorized request - token may be expired");
            const currentPath = window.location.pathname + window.location.search;
            if (!currentPath.includes("/auth/")) {
                // Use auth store logout with redirect enabled
                // This will clear state and redirect to login with redirectTo parameter
                await useAuthStore.getState().logout();
            }
        }
        return response;
    });
}