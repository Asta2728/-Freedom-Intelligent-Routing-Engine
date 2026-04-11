"use client";

import { NotificationsBell } from "@/components/notifications/notification-bell";
import { useAuthStore } from "@/store/auth-store";
import { AlertTriangle, Palette, UserCog } from "lucide-react";
import { useMemo } from "react";
import { SidebarNav } from "./_components/sidebar-nav";
import { Header } from "@/components/layout/dashboard/header";
import { Search } from "@/components/layout/dashboard/search";
import { ThemeSwitch } from "@/components/layout/dashboard/theme-switch";
import { Main } from "@/components/layout/dashboard/main";


export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user } = useAuthStore();

    const sidebarNavItems = useMemo(() => {
        const items = [
            {
                title: "Profile",
                href: "/dashboard/settings/profile",
                icon: <UserCog size={18} />,
            },
            {
                title: "Appearance",
                href: "/dashboard/settings/appearance",
                icon: <Palette size={18} />,
            },
        ];

        items.push({
            title: "Account Danger",
            href: "/settings/account-danger",
            icon: <AlertTriangle size={18} />,
        });

        return items;
    }, [user?.role]);

    return (
        <>
            {/* ===== Top Heading ===== */}
            <Header fixed>
                <Search />
                <div className="ms-auto flex items-center space-x-4">
                    <NotificationsBell />
                    <ThemeSwitch />
                    {/* <ConfigDrawer />
                    <ProfileDropdown /> */}
                </div>
            </Header>

            <Main fixed>
                <div className="flex flex-1 flex-col space-y-2 overflow-hidden md:space-y-2 lg:flex-row lg:space-y-0 lg:space-x-12">
                    <aside className="top-0 lg:sticky lg:w-1/5">
                        <SidebarNav items={sidebarNavItems} />
                    </aside>
                    <div className="flex w-full overflow-y-hidden p-1">{children}</div>
                </div>
            </Main>
        </>
    );
}