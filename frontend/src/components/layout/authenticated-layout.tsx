"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getCookie } from "@/lib/cookies";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AppSidebar } from "./app-sidebar";
import { LayoutProvider } from "./providers/layout-provider";
import { SearchProvider } from "./providers/search-provider";
// import { useFCM } from "@/hooks/use-fcm";

export function AuthenticatedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { isAuthenticated } = useAuthStore();
    const router = useRouter();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted && !isAuthenticated) {
            router.replace(`/auth/login?redirectTo=${encodeURIComponent(pathname)}`);
        }
    }, [mounted, isAuthenticated, router, pathname]);

    // Show nothing until hydrated to avoid flash
    if (!mounted) return null;

    // Redirect is in-flight; don't render dashboard content
    if (!isAuthenticated) return null;

    // The org store might not exist or be wired up yet since we deleted everything
    // Temporarily bypassing the org initialize until we've rebuilt it

    const defaultOpen = getCookie("sidebar_state") !== "false";

    return (
        <SearchProvider>
            <LayoutProvider>
                <SidebarProvider defaultOpen={defaultOpen}>
                    {/* <SkipToMain /> */}
                    <AppSidebar />
                    <SidebarInset
                        className={cn(
                            // Set content container, so we can use container queries
                            "@container/content",

                            // If layout is fixed, set the height
                            // to 100svh to prevent overflow
                            "has-data-[layout=fixed]:h-svh",

                            // If layout is fixed and sidebar is inset,
                            // set the height to 100svh - spacing (total margins) to prevent overflow
                            "peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]",
                        )}
                    >
                        {children}
                    </SidebarInset>
                </SidebarProvider>
            </LayoutProvider>
        </SearchProvider>
    );
}