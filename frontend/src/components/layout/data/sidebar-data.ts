import type { UserRead } from "@/lib/api/client";
import { LayoutDashboard, UserCircle, Settings, Users, Command, CheckSquare, Ticket, Building2 } from "lucide-react";

type Team = {
    name: string;
    logo: React.ElementType;
    plan: string;
};

type BaseNavItem = {
    title: string;
    badge?: string;
    icon?: React.ElementType;
};

type NavLink = BaseNavItem & {
    url: string;
    items?: never;
};

type NavCollapsible = BaseNavItem & {
    items: (BaseNavItem & { url: string })[];
    url?: never;
};

type NavItem = NavCollapsible | NavLink;

type NavGroup = {
    title: string;
    items: NavItem[];
};

type SidebarData = {
    teams: Team[];
    navGroups: NavGroup[];
};

export type { NavCollapsible, NavGroup, NavItem, NavLink, SidebarData, Team };

export function getFilteredSidebarData(user: UserRead | null): SidebarData {
    return {
        teams: [
            {
                name: "Datasaur",
                logo: Command,
                plan: "Enterprise",
            },
        ],
        navGroups: [
            {
                title: "Обзор",
                items: [
                    {
                        title: "Главная",
                        url: "/dashboard",
                        icon: LayoutDashboard,
                    },
                ],
            },
            {
                title: "FIRE",
                items: [
                    {
                        title: "Задачи",
                        url: "/fire/tasks",
                        icon: CheckSquare,
                    },
                    {
                        title: "Обращения",
                        url: "/fire/tickets",
                        icon: Ticket,
                    },
                    {
                        title: "AI-аналитика",
                        url: "/fire/ai-analytics",
                        icon: LayoutDashboard,
                    },
                    {
                        title: "Менеджеры",
                        url: "/fire/managers",
                        icon: Users,
                    },
                    {
                        title: "Бизнес-подразделения",
                        url: "/fire/business-units",
                        icon: Building2,
                    },
                ],
            },
            ...(user?.role === "admin"
                ? [
                    {
                        title: "Администрация",
                        items: [
                            {
                                title: "Пользователи",
                                url: "/admin/users",
                                icon: Users,
                            },
                        ],
                    },
                ]
                : []),
        ],
    };
}
