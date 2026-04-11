import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserRead } from "@/lib/api/client";
import { AuthService, UsersService } from "@/lib/api/client";

interface LoginCredentials {
    username: string;
    password: string;
}

interface AuthState {
    user: UserRead | null;
    token: string | null;
    isInitialized: boolean;
    isAuthenticated: boolean;
    initialize: (user: UserRead | null) => void;
    login: (credentials: LoginCredentials) => Promise<UserRead>;
    logout: (options?: AuthOptions) => Promise<void>;
}

interface AuthOptions {
    redirect?: boolean;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            isInitialized: false,
            isAuthenticated: false,
            initialize: (user) => {
                set({
                    isInitialized: true,
                    isAuthenticated: !!user,
                    user,
                });
            },
            login: async (credentials) => {
                // 1. Call login endpoint to get access token
                const tokenResponse = await AuthService.loginApiV1AuthLoginPost({
                    body: credentials,
                });
                const accessToken = tokenResponse.data.access_token;

                // 2. Set the token first so the interceptor can use it
                set({ token: accessToken });

                // 3. Fetch user profile using the new token
                const userResponse = await UsersService.readCurrentUserApiV1UsersMeGet();
                const user = userResponse.data;

                // 4. Set the full auth state
                set({ user, isAuthenticated: true });

                return user;
            },
            logout: async (options = { redirect: true }) => {
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                });
                if (options.redirect) {
                    const currentPath = window.location.pathname + window.location.search;

                    if (!currentPath.includes("/auth/")) {
                        const loginUrl = `/auth/login?redirectTo=${encodeURIComponent(currentPath)}`;
                        window.location.href = loginUrl;
                    } else {
                        window.location.href = "/auth/login";
                    }
                }
            },
        }),
        {
            name: "auth-storage",
        }
    )
);
